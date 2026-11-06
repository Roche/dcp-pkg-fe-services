export interface WatchableStoreConfig<State> {
    keysToWatch: string[];
    mapStateFromStorage: (key: string, storageData: any) => Partial<State>;
}