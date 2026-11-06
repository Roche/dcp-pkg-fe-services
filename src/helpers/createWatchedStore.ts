import { Store } from '../store/store';
import SingletonWatcher from '../utilities/singletonWatcher';
import StoreRegistry from '../utilities/storeRegistry';
import { StoreRegistrationResult } from '@/types/stores';

export async function createWatchedStore<State extends Record<string, any>, StoreType extends Store<State>>(
    storeId: string,
    storeInstance: StoreType
): Promise<{ store: StoreType; registration: StoreRegistrationResult }> {
    const registration = await StoreRegistry.registerStore(storeId, storeInstance);
    const registeredStore = StoreRegistry.getStore<State>(storeId);

    if (!registeredStore) {
        throw new Error(`Failed to get store "${storeId}" from registry after registration`);
    }

    const config = registeredStore.getConfig();

    // Only setup localStorage watching if config exists and not already watched
    if (config && config.keysToWatch && config.mapStateFromStorage) {
        const watcherInstance = SingletonWatcher.getInstance();

        // Check if isKeyWatched method exists (backward compatibility)
        let isAlreadyWatched = false;
        if (typeof watcherInstance.isKeyWatched === 'function') {
            isAlreadyWatched = config.keysToWatch.some(key =>
                watcherInstance.isKeyWatched!(key, storeId)
            );
        }

        if (!isAlreadyWatched) {
            try {
                watcherInstance.addKeys(config.keysToWatch as string[], storeId, config.mapStateFromStorage);

                // Sync initial state from localStorage
                config.keysToWatch.forEach((key) => {
                    const storageData = localStorage.getItem(key);
                    if (storageData) {
                        try {
                            const parsedData = config.mapStateFromStorage(key, JSON.parse(storageData));
                            Object.entries(parsedData).forEach(([propKey, value]) => {
                                registeredStore!.update(propKey as keyof State, value as State[keyof State]);
                            });
                        } catch (error) {
                            console.error(`Error parsing localStorage key "${key}":`, error);
                        }
                    }
                });
            } catch (error) {
                console.warn(`Failed to setup localStorage watching for store "${storeId}":`, error);
            }
        }
    }

    return {
        store: registeredStore as StoreType,
        registration,
    };
}
