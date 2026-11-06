import { jwtDecode } from "jwt-decode";
import { Store } from "@/store/store";
import { logger } from "@open-dcp/utilities";
import { createWatchedStore } from "@/helpers/createWatchedStore";
import { WatchableStoreConfig } from '@/types/watchableStoreConfig';
import { Jwt } from "@/types/jwt";
import { UserState } from "@/types/stores";
import { initialUserState } from "@/store/implementations/states/initialUserState";
import StoreRegistry from '@/utilities/storeRegistry';

const storageKey = 'user';

class UserStore extends Store<UserState> {
  constructor() {
    const config: WatchableStoreConfig<UserState> = {
      keysToWatch: [storageKey], // The keys to watch in localStorage
      mapStateFromStorage: (key: string, storageData: any): Partial<UserState> => {
        if (key === storageKey && storageData?.current?.access_token) {
          try {
            let tokenPayload: Jwt = jwtDecode(storageData.current.access_token);
            const legacyUserId = Number(tokenPayload.currentLoggedUserId);
            const resolvedUserId = tokenPayload.userId ?? (Number.isFinite(legacyUserId) ? legacyUserId : null);

            return {
              username: tokenPayload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name']
                ?? tokenPayload.userName ?? null,
              userId: resolvedUserId,
              displayName: tokenPayload.displayName ?? null,
              permissions: tokenPayload.permissions ?? [],

              token: storageData.token ?? storageData.current?.access_token ?? null,
              refreshToken: storageData.refreshToken ?? storageData.current?.refresh_token ?? null,
              sites: storageData.sites ?? storageData.current?.sites ?? [],
              settings: {
                timeFormat: storageData.settings?.timeFormat ?? null,
                dateFormat: storageData.settings?.dateFormat ?? null,
              },
              logoutLink: storageData.logoutLink || '',
              logout: false
            };
          } catch (error) {
            logger.error('Error decoding JWT:', error);
            return {};
          }
        }

        return {};  // Default: no mapping for other keys
      }
    };

    let initialState = initialUserState;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        initialState = {
          ...initialUserState,
          ...config.mapStateFromStorage(storageKey, parsed)
        };
      } catch (e) {
        logger.error('Failed to parse user from localStorage:', e);
        // fallback to default initialUserState
      }
    }

    super(initialState, config);
  }

  // Additional methods specific to user store
  setToken(token: string | null) {
    this.update('token', token, `${storageKey}.current.access_token`);
  }

  // Additional methods specific to user store
  setRefreshToken(token: string | null) {
    this.update('refreshToken', token, `${storageKey}.current.refresh_token`);
  }

  setUsername(username: string | null) {
    this.update('username', username, `${storageKey}.current.userName`);
  }

  // Update time format in settings
  setTimeFormat(timeFormat: string | null) {
    this.update('settings', { ...this.getState().settings, timeFormat }, `${storageKey}.settings`);
  }

  // Update date format in settings
  setDateFormat(dateFormat: string | null) {
    this.update('settings', { ...this.getState().settings, dateFormat }, `${storageKey}.settings`);
  }

  // Update any specific setting in settings (optional utility method)
  setSetting<K extends keyof UserState['settings']>(key: K, value: UserState['settings'][K]) {
    this.update('settings', { ...this.getState().settings, [key]: value }, `${storageKey}.settings`);
  }

  getPermissionsPerSite(siteId: number): string[] {
    return this.getState().permissions
      .filter(
        permission =>
            permission.SiteId === siteId ||
            (permission.SiteId === 0 && permission.SiteName === 'GLOBAL')
      )
      .map(permission => permission.Permission);
  }

  resetLogoutLink() {
    this.update('logoutLink', '', storageKey);
  }

  logout() {
    this.update('logout', true);
  }

  clearLogout() {
    this.update('logout', false);
  }
}

export const registerUserStore = () => createWatchedStore('userStore', new UserStore());

// Initialize the store (creates or gets from registry)
export const userStoreRegistration = registerUserStore();

// Export a Proxy that ALWAYS gets from registry
export const userStore = new Proxy({} as UserStore, {
  get(_target, prop) {
    const store = StoreRegistry.getStore<UserState>('userStore');
    if (!store) {
      throw new Error('userStore not initialized');
    }
    const value = (store as any)[prop];
    return typeof value === 'function' ? value.bind(store) : value;
  }
});

export { UserStore };
