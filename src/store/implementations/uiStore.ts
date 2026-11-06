import { Store } from '../store';
import { logger } from '@open-dcp/utilities';
import { createWatchedStore } from '../../helpers/createWatchedStore';
import { WatchableStoreConfig } from '../../types/watchableStoreConfig';
import {UiState, MessageType, ActiveModules} from '@/types/stores';
import { initialUiState } from './states/initialUiState';
import StoreRegistry from '@/utilities/storeRegistry';

const storageKey = 'ui';

function normalizeSiteId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

class UiStore extends Store<UiState> {
  constructor() {
    const config: WatchableStoreConfig<UiState> = {
      keysToWatch: [storageKey], // The keys to watch in localStorage
      mapStateFromStorage: (key, storageData): Partial<UiState> => {
        if (key === storageKey) {
          const activeModules = (storageData.activeModules && storageData.activeModules[0] && 'ID' in storageData.activeModules[0] ?
              storageData.activeModules?.map((el: any) => ({
                id: el.ID,
                name: el.ModuleName,
                siteId: el.SiteID,
                enabled: el.IsEnable
              }))
              : storageData.activeModules) || [];
          // Transitional read path: prefer canonical `site` data, but keep legacy root fields for compatibility.
          const siteFromObject = storageData.site || {};
          const siteContextId = normalizeSiteId(storageData.siteContext);
          const siteObjectId = normalizeSiteId(siteFromObject.id);
          const resolvedSiteId = siteContextId ?? siteObjectId;
          const isStaleSiteObject =
            siteContextId !== null &&
            siteObjectId !== null &&
            siteObjectId !== siteContextId;
          const resolvedSiteName =
            storageData.siteShortName
            ?? (isStaleSiteObject ? null : siteFromObject.name)
            ?? null;
          const resolvedTimeZone =
            storageData.siteTimeZoneName
            ?? storageData.siteTimeZOneName
            ?? (isStaleSiteObject ? null : siteFromObject.timeZone)
            ?? null;
          const resolvedUtcOffset =
            storageData.siteUTCOffset
            ?? (isStaleSiteObject ? null : siteFromObject.utcOffset)
            ?? null;

          return {
            language: storageData.language ?? 'en',
            menu: storageData.menu ?? { expanded: {} },
            redirectTo: storageData.redirectTo ?? '',
            activeModules,
            site: {
              id: resolvedSiteId,
              name: resolvedSiteName,
              timeZone: resolvedTimeZone,
              utcOffset: resolvedUtcOffset
            },
            loading: {},
            messages: [],
            enableSiteSelection: true,
          };
        }
        return {};
      }
    };

    let initialState = initialUiState;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        initialState = {
          ...initialUiState,
          ...config.mapStateFromStorage(storageKey, parsed)
        };
      } catch (e) {
        logger.error('Failed to parse ui from localStorage:', e);
        // fallback to default initialUiState
      }
    }
    super(initialState, config);
  }

  setRedirectTo(url: string) {
    this.update('redirectTo', url, storageKey);
  }

  setActiveModules(activeModuels: ActiveModules[]) {
    this.update('activeModules', activeModuels, storageKey);
  }

  setCurrentSite(site: {
    id: number;
    name: string;
    timeZone: string;
    utcOffset: number;
  }) {
    // Update in-memory state first, then persist canonical + legacy fields in one storage write.
    // Remove legacy root fields once all apps use uiStore.site as the only source of truth.
    this.update('site', site);

    const currentRaw = localStorage.getItem(storageKey);
    let currentStorage: Record<string, any> = {};
    if (currentRaw) {
      try {
        currentStorage = JSON.parse(currentRaw);
      } catch {
        currentStorage = {};
      }
    }

    localStorage.setItem(storageKey, JSON.stringify({
      ...currentStorage,
      site,
      siteContext: site.id,
      siteShortName: site.name,
      siteTimeZoneName: site.timeZone,
      siteTimeZOneName: site.timeZone,
      siteUTCOffset: site.utcOffset,
    }));
  }

  setMenu(menu: { expanded: { [key: string]: boolean } }) {
    this.update('menu', {
      ...this.getState().menu,
      ...menu,
      expanded: {
        ...this.getState().menu.expanded ?? {},
        ...menu.expanded
      }
    }, storageKey);
  }

  setLanguage(language: string) {
    this.update('language', language, storageKey);
  }

  /* Temporary state properties - not synced to localStorage */
  enableSiteSelection() {
    this.update('enableSiteSelection', true);
  }

  disableSiteSelection() {
    this.update('enableSiteSelection', false);
  }

  setLoading(key: string) {
    this.update('loading', { ...this.getState().loading, [key]: true });
  }

  removeLoading(key: string) {
    const currentLoading = this.getState().loading;
    if (typeof currentLoading === 'object' && currentLoading !== null) {
      const { [key]: _, ...newLoaders } = currentLoading;
      this.update('loading', newLoaders);
    }
  }

  setMessage(type: MessageType, message: string) {
    this.update('messages', [
      ...this.getState().messages,
      { type, message }
    ]);
  }

  dequeueMessage(): { type: MessageType, message: string } | undefined {
    const messages = this.getState().messages;
    if (messages.length > 0) {
      const [removed, ...rest] = messages;
      this.update('messages', rest);
      return removed;
    }
    return undefined;
  }

  clearMessages() {
    this.update('messages', []);
  }
}

export const registerUiStore = () => createWatchedStore('uiStore', new UiStore());

// Initialize the store (creates or gets from registry)
export const uiStoreRegistration = registerUiStore();

// Export a Proxy that ALWAYS gets from registry
export const uiStore = new Proxy({} as UiStore, {
  get(_target, prop) {
    const store = StoreRegistry.getStore<UiState>('uiStore');
    if (!store) {
      throw new Error('uiStore not initialized');
    }
    const value = (store as any)[prop];
    return typeof value === 'function' ? value.bind(store) : value;
  }
});

export { UiStore };
