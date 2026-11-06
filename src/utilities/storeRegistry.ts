import { Store } from '../store/store';
import { logger } from '@open-dcp/utilities';
import StoreVersion from './storeVersion';
import { StoreRegistrationResult } from '@/types/stores';

class StoreRegistry {
    private static registrationQueue: Map<string, Promise<StoreRegistrationResult>> = new Map();

    private static ensureRegistryExists(): void {
        window.__DCP_STORE_REGISTRY__ ??= {};
    }

    private static isDevVersion(version: string): boolean {
        return version === 'x.x.x';
    }

    /**
 * Register a store with queue to prevent race conditions
 */
    static async registerStore<T extends Record<string, any>>(
        storeId: string,
        storeInstance: Store<T>
    ): Promise<StoreRegistrationResult> {
        // Wait for any pending registration of the same store to complete
        while (this.registrationQueue.has(storeId)) {
            await this.registrationQueue.get(storeId);
        }

        // Create a new registration promise
        const registrationPromise = this.performRegistration(storeId, storeInstance);
        this.registrationQueue.set(storeId, registrationPromise);

        try {
            return await registrationPromise;
        } finally {
            // Clean up the queue entry once done
            this.registrationQueue.delete(storeId);
        }
    }

    private static async performRegistration<T extends Record<string, any>>(
        storeId: string,
        storeInstance: Store<T>
    ): Promise<StoreRegistrationResult> {
        this.ensureRegistryExists();
        const registry = window.__DCP_STORE_REGISTRY__!;

        // Re-check the registry after waiting in queue (it might have been updated)
        const oldStore = registry[storeId] as Store<any> | undefined;

        if (!oldStore) {
            const message = `✅ Registering new store "${storeId}" (v${storeInstance.getVersion()})`;
            logger.log(message);
            registry[storeId] = storeInstance as Store<any>;
            return {
                storeId,
                newVersion: storeInstance.getVersion() ?? '0',
                status: 'registered',
                message,
            };
        }

        const storeVersion = oldStore.getVersion() ?? '0';
        const newVersion = storeInstance.getVersion() ?? '0';

        // If both are dev versions, keep the existing one (avoid infinite loop)
        if (this.isDevVersion(storeVersion) && this.isDevVersion(newVersion)) {
            const message = `⏭️  Keeping existing dev store "${storeId}" (x.x.x), ignoring new dev instance`;
            logger.log(message);
            return {
                storeId,
                existingVersion: storeVersion,
                newVersion,
                status: 'kept-existing-dev-dev',
                message,
            };
        }

        // If new version is x.x.x (dev), replace production version
        if (this.isDevVersion(newVersion) && !this.isDevVersion(storeVersion)) {
            const message = `⬆️  Replacing store "${storeId}" (v${storeVersion}) with dev version (x.x.x)`;
            logger.log(message);
            await this.replaceStore(registry, storeId, oldStore, storeInstance);
            return {
                storeId,
                existingVersion: storeVersion,
                newVersion,
                status: 'replaced-with-dev',
                message,
            };
        }

        // If old version is x.x.x (dev), keep it (production can't replace dev)
        if (this.isDevVersion(storeVersion) && !this.isDevVersion(newVersion)) {
            const message = `⏭️  Keeping dev version of store "${storeId}" (x.x.x), rejecting production v${newVersion}`;
            logger.log(message);
            return {
                storeId,
                existingVersion: storeVersion,
                newVersion,
                status: 'kept-existing-dev',
                message,
            };
        }

        // Compare production versions
        const comparison = new StoreVersion(storeVersion).compareTo(new StoreVersion(newVersion));

        if (comparison < 0) {
            // Old version is lower - upgrade
            if (!storeInstance.isCompatibleWith(storeVersion)) {
                const message = `❌ Incompatible store versions for storeId "${storeId}": existing version ${storeVersion}, new version ${newVersion}. Keeping existing store.`;
                logger.error(message);
                return {
                    storeId,
                    existingVersion: storeVersion,
                    newVersion,
                    status: 'rejected-incompatible-upgrade',
                    message,
                };
            }

            const message = `⬆️  Upgrading store "${storeId}" from v${storeVersion} to v${newVersion}`;
            logger.log(message);
            await this.replaceStore(registry, storeId, oldStore, storeInstance);
            return {
                storeId,
                existingVersion: storeVersion,
                newVersion,
                status: 'upgraded',
                message,
            };
        } else if (comparison === 0) {
            // Same version - keep existing
            const message = `⏭️  Store "${storeId}" already at v${storeVersion}, ignoring duplicate registration`;
            logger.log(message);
            return {
                storeId,
                existingVersion: storeVersion,
                newVersion,
                status: 'duplicate',
                message,
            };
        } else {
            // Old version is higher - keep existing. Validate backwards compatibility.
            if (!oldStore.isCompatibleWith(newVersion)) {
                const message = `⚠️ Existing store version ${storeVersion} is not compatible with incoming older version ${newVersion} for storeId "${storeId}". Keeping existing store.`;
                logger.warn(message);
                return {
                    storeId,
                    existingVersion: storeVersion,
                    newVersion,
                    status: 'rejected-incompatible-downgrade',
                    message,
                };
            }

            const message = `⏭️  Keeping existing store "${storeId}" (v${storeVersion}), rejecting v${newVersion}`;
            logger.log(message);
            return {
                storeId,
                existingVersion: storeVersion,
                newVersion,
                status: 'kept-existing',
                message,
            };
        }
    }

    private static async replaceStore<T extends Record<string, any>>(
        registry: Record<string, Store<any>>,
        storeId: string,
        oldStore: Store<any>,
        newStore: Store<T>
    ): Promise<void> {
        // Use Promise.resolve to ensure async execution and prevent blocking
        await Promise.resolve();

        // Migrate state from old to new
        const oldState = oldStore.getState();
        Object.keys(oldState).forEach((key) => {
            newStore.update(key, oldState[key]);
        });

        // Migrate subscribers from old to new
        if (typeof oldStore.migrateSubscribers === 'function') {
            (oldStore as any).migrateSubscribers(newStore);
        }

        // Replace in registry
        registry[storeId] = newStore as Store<any>;
    }

    static getStore<T extends Record<string, any>>(storeId: string): Store<T> | undefined {
        this.ensureRegistryExists();
        return window.__DCP_STORE_REGISTRY__![storeId] as Store<T> | undefined;
    }

    static removeStore(storeId: string): void {
        this.ensureRegistryExists();
        delete window.__DCP_STORE_REGISTRY__![storeId];
    }

    static clearRegistry(): void {
        delete window.__DCP_STORE_REGISTRY__;
        this.registrationQueue.clear();
    }

    static getAllStores(): Record<string, Store<any>> {
        this.ensureRegistryExists();
        return window.__DCP_STORE_REGISTRY__!;
    }

    static hasStore(storeId: string): boolean {
        this.ensureRegistryExists();
        return storeId in window.__DCP_STORE_REGISTRY__!;
    }
}

export default StoreRegistry;