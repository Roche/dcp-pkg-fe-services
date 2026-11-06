import { Store } from '../store';
import { logger } from '@open-dcp/utilities';
import { createWatchedStore } from '../../helpers/createWatchedStore';
import { GxpState, GxpApp } from '@/types/stores';
import { initialGxpState } from './states/initialGxpState';
import StoreRegistry from '@/utilities/storeRegistry';

type QueuedOperation = () => void | Promise<void>;

class GxpStore extends Store<GxpState> {
    private operationQueue: Map<string, QueuedOperation[]> = new Map();
    private processingQueue: Set<string> = new Set();

    constructor() {
        super(initialGxpState);
    }

    private async processQueue(appName: string): Promise<void> {
        if (this.processingQueue.has(appName)) {
            return;
        }

        this.processingQueue.add(appName);

        try {
            const queue = this.operationQueue.get(appName);
            if (!queue || queue.length === 0) {
                return;
            }

            while (queue.length > 0) {
                const operation = queue.shift();
                if (operation) {
                    try {
                        await Promise.resolve(operation());
                    } catch (error) {
                        logger.error(`Error processing queued operation for ${appName}:`, error);
                    }
                }
            }
        } finally {
            this.processingQueue.delete(appName);

            const queue = this.operationQueue.get(appName);
            if (queue && queue.length > 0) {
                setImmediate(() => this.processQueue(appName));
            }
        }
    }

    private enqueueOperation(appName: string, operation: QueuedOperation): void {
        if (!this.operationQueue.has(appName)) {
            this.operationQueue.set(appName, []);
        }

        this.operationQueue.get(appName)!.push(operation);
        this.processQueue(appName);
    }

    registerApp(appName: string, isValidated: boolean, enableAutoClearHistory: boolean = true, version?: string) {
        const state = this.getState();

        if (!state.activeApps[appName]) {
            this.update('activeApps', {
                ...state.activeApps,
                [appName]: {
                    name: appName,
                    isValidated,
                    enableAutoClearHistory,
                    requestHistory: [],
                    version
                }
            });
        }
    }

    unregisterApp(appName: string) {
        const state = this.getState();
        const app = state.activeApps[appName];

        if (!app) {
            logger.warn(`Cannot unregister app that doesn't exist: ${appName}`);
            return;
        }

        // Clear queues for this app
        this.operationQueue.delete(appName);
        this.processingQueue.delete(appName);

        const { [appName]: _, ...remainingApps } = state.activeApps;
        this.update('activeApps', remainingApps);
    }

    setAppValidated(appName: string, isValidated: boolean) {
        this.enqueueOperation(appName, () => {
            const state = this.getState();
            const app = state.activeApps[appName];

            if (!app) {
                logger.warn(`Cannot set validation for unregistered app: ${appName}`);
                return;
            }

            this.update('activeApps', {
                ...state.activeApps,
                [appName]: {
                    ...app,
                    isValidated
                }
            });
        });
    }

    setAppAutoClearHistory(appName: string, enableAutoClearHistory: boolean) {
        this.enqueueOperation(appName, () => {
            const state = this.getState();
            const app = state.activeApps[appName];

            if (!app) {
                logger.warn(`Cannot set auto clear history for unregistered app: ${appName}`);
                return;
            }

            this.update('activeApps', {
                ...state.activeApps,
                [appName]: {
                    ...app,
                    enableAutoClearHistory
                }
            });
        });
    }

    addRequestHistoryEntry(appName: string, entry: GxpApp['requestHistory'][0]) {
        this.enqueueOperation(appName, () => {
            const state = this.getState();
            const app = state.activeApps[appName];

            if (!app) {
                logger.warn(`Cannot add history for unregistered app: ${appName}. Please register first.`);
                return;
            }

            this.update('activeApps', {
                ...state.activeApps,
                [appName]: {
                    ...app,
                    requestHistory: [...app.requestHistory, entry]
                }
            });
        });
    }

    getRequestHistory(appName: string): GxpApp['requestHistory'] {
        const state = this.getState();
        const app = state.activeApps[appName];

        if (!app) {
            logger.warn(`Cannot get history for unregistered app: ${appName}`);
            return [];
        }

        return app.requestHistory;
    }

    clearRequestHistory(appName: string) {
        this.enqueueOperation(appName, () => {
            const state = this.getState();
            const app = state.activeApps[appName];

            if (!app) {
                logger.warn(`Cannot clear history for unregistered app: ${appName}`);
                return;
            }

            this.update('activeApps', {
                ...state.activeApps,
                [appName]: {
                    ...app,
                    requestHistory: []
                }
            });
        });
    }

    private createRegexFromPattern(pattern: string): RegExp {
        // Escape special regex characters except * and ?
        let regexPattern = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape special chars
            .replace(/\*/g, '.*')                    // Convert * to .*
            .replace(/\?/g, '.');                    // Convert ? to .

        // Anchor the pattern to match the entire string
        return new RegExp(`^${regexPattern}$`);
    }

    removeRequestHistoryEntry(
        appName: string,
        urlPattern: string | RegExp | (string | RegExp)[],
        requestMethod: string | null = null,
        tag: string | null = null
    ) {
        this.enqueueOperation(appName, () => {
            const state = this.getState();
            const app = state.activeApps[appName];

            if (!app) {
                logger.warn(`Cannot remove history entry for unregistered app: ${appName}`);
                return;
            }

            // Normalize to array
            const patterns = Array.isArray(urlPattern) ? urlPattern : [urlPattern];

            // Convert all patterns to RegExp
            const regexes = patterns.map(pattern =>
                typeof pattern === 'string'
                    ? this.createRegexFromPattern(pattern)
                    : pattern
            );

            // Normalize request method to lowercase for comparison (if provided)
            const normalizedMethod = requestMethod?.toLowerCase() ?? null;

            // Filter out entries that match ANY of the patterns AND the method (if specified) AND the tag (if specified)
            this.update('activeApps', {
                ...state.activeApps,
                [appName]: {
                    ...app,
                    requestHistory: app.requestHistory.filter(entry => {
                        // Check if URL matches any pattern
                        const urlMatches = regexes.some(regex => regex.test(entry.url));

                        if (!urlMatches) {
                            return true; // Keep entry if URL doesn't match
                        }

                        // If URL matches and no method filter specified, check tag
                        if (normalizedMethod !== null && entry.method?.toLowerCase() !== normalizedMethod) {
                            return true; // Keep entry if method doesn't match
                        }

                        // If URL (and optionally method) matches and no tag filter specified, remove it
                        if (tag === null) {
                            return false;
                        }

                        // If tag filter specified, only remove if tag also matches
                        return entry.tag !== tag;
                    })
                }
            });
        });
    }

    getLastRequestHistoryEntry(
        appName: string,
        requestMethod: string | null = null,
        tag: string | null = null
    ): GxpApp['requestHistory'][0] | undefined {
        const state = this.getState();
        const app = state.activeApps[appName];

        if (!app) {
            logger.warn(`Cannot get last history entry for unregistered app: ${appName}`);
            return undefined;
        }

        let history = app.requestHistory;

        // Filter by method if specified
        if (requestMethod !== null) {
            const normalizedMethod = requestMethod.toLowerCase();
            history = history.filter(entry => entry.method?.toLowerCase() === normalizedMethod);
        }

        // Filter by tag if specified
        if (tag !== null) {
            history = history.filter(entry => entry.tag === tag);
        }

        return history.length > 0 ? history[history.length - 1] : undefined;
    }

    getRequestHistoryByMethod(
        appName: string,
        requestMethod: string,
        tag: string | null = null
    ): GxpApp['requestHistory'] {
        const state = this.getState();
        const app = state.activeApps[appName];

        if (!app) {
            logger.warn(`Cannot get history for unregistered app: ${appName}`);
            return [];
        }

        const normalizedMethod = requestMethod.toLowerCase();
        let history = app.requestHistory.filter(entry => entry.method?.toLowerCase() === normalizedMethod);

        // Filter by tag if specified
        if (tag !== null) {
            history = history.filter(entry => entry.tag === tag);
        }

        return history;
    }

    getLastRequestHistoryEntryByUrl(
        appName: string,
        urlPattern: string | RegExp,
        requestMethod: string | null = null,
        tag: string | null = null
    ): GxpApp['requestHistory'][0] | undefined {
        const state = this.getState();
        const app = state.activeApps[appName];

        if (!app) {
            logger.warn(`Cannot get last history entry for unregistered app: ${appName}`);
            return undefined;
        }

        const regex = typeof urlPattern === 'string'
            ? this.createRegexFromPattern(urlPattern)
            : urlPattern;

        const normalizedMethod = requestMethod?.toLowerCase() ?? null;

        // Filter by URL pattern and optionally by method and tag
        const filtered = app.requestHistory.filter(entry => {
            const urlMatches = regex.test(entry.url);

            if (!urlMatches) {
                return false;
            }

            if (normalizedMethod !== null && entry.method?.toLowerCase() !== normalizedMethod) {
                return false;
            }

            if (tag !== null && entry.tag !== tag) {
                return false;
            }

            return true;
        });

        return filtered.length > 0 ? filtered[filtered.length - 1] : undefined;
    }

    getRequestHistoryByTag(appName: string, tag: string): GxpApp['requestHistory'] {
        const state = this.getState();
        const app = state.activeApps[appName];

        if (!app) {
            logger.warn(`Cannot get history for unregistered app: ${appName}`);
            return [];
        }

        return app.requestHistory.filter(entry => entry.tag === tag);
    }

    private updateIgnoreFlag(
        appName: string,
        options: {
            urlPattern?: string | RegExp | (string | RegExp)[];
            requestMethod?: string | null;
            tag?: string | null;
        },
        ignoreValue: boolean | 'toggle'
    ) {
        this.enqueueOperation(appName, () => {
            const state = this.getState();
            const app = state.activeApps[appName];

            if (!app) {
                logger.warn(`Cannot update ignore flag for unregistered app: ${appName}`);
                return;
            }

            const { urlPattern, requestMethod, tag } = options;

            // Convert URL patterns to RegExp if provided
            const regexes = urlPattern
                ? (Array.isArray(urlPattern) ? urlPattern : [urlPattern]).map(pattern =>
                    typeof pattern === 'string'
                        ? this.createRegexFromPattern(pattern)
                        : pattern
                )
                : null;

            const normalizedMethod = requestMethod?.toLowerCase() ?? null;

            // Update entries that match the criteria
            this.update('activeApps', {
                ...state.activeApps,
                [appName]: {
                    ...app,
                    requestHistory: app.requestHistory.map(entry => {
                        // Check URL if pattern provided
                        if (regexes !== null) {
                            const urlMatches = regexes.some(regex => regex.test(entry.url));
                            if (!urlMatches) {
                                return entry;
                            }
                        }

                        // Check method if specified
                        if (normalizedMethod !== null && entry.method?.toLowerCase() !== normalizedMethod) {
                            return entry;
                        }

                        // Check tag if specified
                        if (tag !== null && entry.tag !== tag) {
                            return entry;
                        }

                        // Match found, update ignore flag
                        const newIgnoreValue = ignoreValue === 'toggle' ? !entry.ignore : ignoreValue;
                        return { ...entry, ignore: newIgnoreValue };
                    })
                }
            });
        });
    }

    setIgnoreFlag(
        appName: string,
        options: {
            urlPattern?: string | RegExp | (string | RegExp)[];
            requestMethod?: string | null;
            tag?: string | null;
        },
        ignore: boolean
    ) {
        this.updateIgnoreFlag(appName, options, ignore);
    }

    toggleIgnoreFlag(
        appName: string,
        options: {
            urlPattern?: string | RegExp | (string | RegExp)[];
            requestMethod?: string | null;
            tag?: string | null;
        }
    ) {
        this.updateIgnoreFlag(appName, options, 'toggle');
    }

    getAppNames(): string[] {
        return Object.keys(this.getState().activeApps);
    }

    getAllApps(): GxpApp[] {
        return Object.values(this.getState().activeApps);
    }

    isAppRegistered(appName: string): boolean {
        return !!this.getState().activeApps[appName];
    }
}

export const registerGxpStore = () => createWatchedStore('gxpStore', new GxpStore());

// Initialize the store (creates or gets from registry)
export const gxpStoreRegistration = registerGxpStore();

// Export a Proxy that ALWAYS gets from registry
export const gxpStore = new Proxy({} as GxpStore, {
    get(_target, prop) {
        const store = StoreRegistry.getStore<GxpState>('gxpStore');
        if (!store) {
            throw new Error('gxpStore not initialized');
        }
        const value = (store as any)[prop];
        return typeof value === 'function' ? value.bind(store) : value;
    }
});

export { GxpStore };