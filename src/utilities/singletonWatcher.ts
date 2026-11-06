import { logger } from '@open-dcp/utilities';
import StoreRegistry from './storeRegistry';

class SingletonWatcher {
    private readonly watchedKeys: Map<string, Set<string>> = new Map(); // key -> Set of storeIds
    private storageListeners: Map<string, (event: StorageEvent) => void> = new Map();

    private constructor() {
        if (!window.__DCP_SINGLETON_WATCHER__) {
            this.overrideLocalStorageMethods();
            window.__DCP_SINGLETON_WATCHER__ = this;
        }
    }

    static getInstance(): SingletonWatcher {
        window.__DCP_SINGLETON_WATCHER__ ??= new SingletonWatcher();
        return window.__DCP_SINGLETON_WATCHER__!;
    }

    static resetInstance() {
        delete window.__DCP_SINGLETON_WATCHER__;
    }

    isKeyWatched(key: string, storeId: string): boolean {
        const storeIds = this.watchedKeys.get(key);
        return storeIds ? storeIds.has(storeId) : false;
    }

    addKeys<State extends Record<string, any>>(
        keys: string[],
        storeId: string,
        mapStateFromStorage: (key: string, storageData: any) => Partial<State>
    ) {
        keys.forEach((key) => {
            // Track which stores are watching this key
            if (!this.watchedKeys.has(key)) {
                this.watchedKeys.set(key, new Set());
            }
            this.watchedKeys.get(key)!.add(storeId);

            // Only add storage listener once per key
            if (!this.storageListeners.has(key)) {
                const listener = (event: StorageEvent) => {
                    if (event.key === key) {
                        const newValue = event.newValue ? JSON.parse(event.newValue) : null;
                        if (newValue) {
                            const storeInstance = StoreRegistry.getStore<State>(storeId);
                            if (storeInstance) {
                                const mappedState = mapStateFromStorage(event.key!, newValue);
                                Object.entries(mappedState).forEach(([propKey, value]) => {
                                    storeInstance.update(propKey as keyof State, value);
                                });
                            } else {
                                logger.warn(`Store with ID "${storeId}" not found.`);
                            }
                        }
                    }
                };

                window.addEventListener('storage', listener);
                this.storageListeners.set(key, listener);
            }
        });
    }

    private overrideLocalStorageMethods(): void {
        const originalSetItem = localStorage.setItem;
        const originalRemoveItem = localStorage.removeItem;
        let inProgress = false;

        localStorage.setItem = (key: string, value: string) => {
            if (!inProgress) {
                inProgress = true;
                originalSetItem.call(localStorage, key, value);
                window.dispatchEvent(new StorageEvent('storage', { key, newValue: value }));
                inProgress = false;
            }
        };

        localStorage.removeItem = (key: string) => {
            if (!inProgress) {
                inProgress = true;
                originalRemoveItem.call(localStorage, key);
                window.dispatchEvent(new StorageEvent('storage', { key }));
                inProgress = false;
            }
        };
    }
}

export default SingletonWatcher;