export {};

import { SingletonWatcher } from "../utilities/singletonWatcher";

declare global {
    interface Window {
        __DCP_SINGLETON_WATCHER__?: SingletonWatcher;
        __DCP_STORE_REGISTRY__?: Record<string, Store<any>>;
    }
}