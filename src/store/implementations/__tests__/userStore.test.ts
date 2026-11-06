import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { UserStore } from '@/store/implementations/userStore';
import { initialUserState } from '@/store/implementations/states/initialUserState';

const createMockJwt = (payload: Record<string, unknown>) => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${header}.${encodedPayload}.mockSignature`;
};

// Mock JWT tokens for testing
const mockJwtToken = createMockJwt({
    userName: 'testuser',
    userId: 123,
    displayName: 'Test User',
    permissions: ['read', 'write']
});

const mockLegacyJwtToken = createMockJwt({
    userName: 'legacyuser',
    currentLoggedUserId: '123',
    displayName: 'Legacy User'
});

const mockJwtTokenWithoutCollections = createMockJwt({
    userName: 'testuser',
    userId: 123,
    displayName: 'Test User'
});

const mockJwtTokenWithSitePermissions = createMockJwt({
    userName: 'permissions-user',
    userId: 456,
    displayName: 'Permissions User',
    permissions: [
        { Permission: 'read', SiteId: 1, SiteName: 'Site 1', Module: 'Users' },
        { Permission: 'write', SiteId: 1, SiteName: 'Site 1', Module: 'Users' },
        { Permission: 'approve', SiteId: 2, SiteName: 'Site 2', Module: 'Workflow' }
    ]
});

describe('UserStore', () => {
    const storageKey = 'user';
    let consoleWarnSpy: jest.SpiedFunction<typeof console.warn>;
    let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;
    let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

    beforeEach(() => {
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
        localStorage.clear();
    });

    afterEach(() => {
        consoleWarnSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
    });

    it('initializes with default state when localStorage is empty', () => {
        const store = new UserStore();
        const state = store.getState();

        expect(state).toEqual(initialUserState);
    });

    it('loads user data from localStorage with valid JWT', () => {
        const storedData = {
            current: {
                access_token: mockJwtToken,
                refresh_token: 'refresh-token',
                permissions: ['read', 'write'],
                sites: [{ id: 1, name: 'Site 1' }],
            },
            settings: {
                timeFormat: '24h',
                dateFormat: 'DD/MM/YYYY'
            }
        };

        localStorage.setItem(storageKey, JSON.stringify(storedData));
        const store = new UserStore();
        const state = store.getState();

        expect(state.token).toBe(mockJwtToken);
        expect(state.refreshToken).toBe('refresh-token');
        expect(state.username).toBe('testuser');
        expect(state.userId).toBe(123);
        expect(state.displayName).toBe('Test User');
        expect(state.settings.timeFormat).toBe('24h');
        expect(state.settings.dateFormat).toBe('DD/MM/YYYY');
        expect(state.sites).toHaveLength(1);
        expect(state.permissions).toEqual(['read', 'write']);
    });

    it('converts legacy string currentLoggedUserId to numeric userId', () => {
        const storedData = {
            current: {
                access_token: mockLegacyJwtToken
            }
        };

        localStorage.setItem(storageKey, JSON.stringify(storedData));
        const store = new UserStore();
        const state = store.getState();

        expect(state.username).toBe('legacyuser');
        expect(state.userId).toBe(123);
        expect(state.displayName).toBe('Legacy User');
    });

    it('falls back to default state on invalid JSON in localStorage', () => {
        localStorage.setItem(storageKey, '{invalid json');
        const store = new UserStore();

        expect(store.getState().token).toBeNull();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('Failed to parse user from localStorage:'),
            expect.any(SyntaxError)
        );
    });

    it('falls back to default state on invalid JWT token', () => {
        const storedData = {
            current: {
                access_token: 'invalid-jwt-token'
            }
        };

        localStorage.setItem(storageKey, JSON.stringify(storedData));
        const store = new UserStore();

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('Error decoding JWT:'),
            expect.any(Error)
        );
    });

    it('sets and persists access token', () => {
        const store = new UserStore();
        store.setToken(mockJwtToken);

        expect(store.getState().token).toBe(mockJwtToken);
        const stored = JSON.parse(localStorage.getItem(storageKey)!);
        expect(stored.current.access_token).toBe(mockJwtToken);
    });

    it('clears access token', () => {
        const store = new UserStore();
        store.setToken(mockJwtToken);
        store.setToken(null);

        expect(store.getState().token).toBeNull();
        const stored = JSON.parse(localStorage.getItem(storageKey)!);
        expect(stored.current.access_token).toBeNull();
    });

    it('sets and persists refresh token', () => {
        const store = new UserStore();
        store.setRefreshToken('new-refresh-token');

        expect(store.getState().refreshToken).toBe('new-refresh-token');
        const stored = JSON.parse(localStorage.getItem(storageKey)!);
        expect(stored.current.refresh_token).toBe('new-refresh-token');
    });

    it('sets and persists username', () => {
        const store = new UserStore();
        store.setUsername('newuser');

        expect(store.getState().username).toBe('newuser');
        const stored = JSON.parse(localStorage.getItem(storageKey)!);
        expect(stored.current.userName).toBe('newuser');
    });

    it('sets and persists time format', () => {
        const store = new UserStore();
        store.setTimeFormat('12h');

        expect(store.getState().settings.timeFormat).toBe('12h');
        const stored = JSON.parse(localStorage.getItem(storageKey)!);
        expect(stored.settings.timeFormat).toBe('12h');
    });

    it('sets and persists date format', () => {
        const store = new UserStore();
        store.setDateFormat('MM/DD/YYYY');

        expect(store.getState().settings.dateFormat).toBe('MM/DD/YYYY');
        const stored = JSON.parse(localStorage.getItem(storageKey)!);
        expect(stored.settings.dateFormat).toBe('MM/DD/YYYY');
    });

    it('updates setting using setSetting method', () => {
        const store = new UserStore();
        store.setSetting('timeFormat', '24h');

        expect(store.getState().settings.timeFormat).toBe('24h');
        const stored = JSON.parse(localStorage.getItem(storageKey)!);
        expect(stored.settings.timeFormat).toBe('24h');
    });

    it('preserves other settings when updating one', () => {
        const store = new UserStore();
        store.setTimeFormat('24h');
        store.setDateFormat('DD/MM/YYYY');

        const settings = store.getState().settings;
        expect(settings.timeFormat).toBe('24h');
        expect(settings.dateFormat).toBe('DD/MM/YYYY');
    });

    it('handles missing permissions array', () => {
        const storedData = {
            current: {
                access_token: mockJwtTokenWithoutCollections
            }
        };

        localStorage.setItem(storageKey, JSON.stringify(storedData));
        const store = new UserStore();

        expect(store.getState().permissions).toEqual([]);
    });

    it('returns permissions for a specific site', () => {
        const storedData = {
            current: {
                access_token: mockJwtTokenWithSitePermissions
            }
        };

        localStorage.setItem(storageKey, JSON.stringify(storedData));
        const store = new UserStore();

        expect(store.getPermissionsPerSite(1)).toEqual(['read', 'write']);
        expect(store.getPermissionsPerSite(2)).toEqual(['approve']);
        expect(store.getPermissionsPerSite(999)).toEqual([]);
    });

    it('notifies subscribers on token change', () => {
        const store = new UserStore();
        const tokenValues: (string | null)[] = [];

        const unsubscribe = store.subscribe('token', (token) => {
            tokenValues.push(token);
        });

        store.setToken('token1');
        store.setToken('token2');
        store.setToken(null);

        expect(tokenValues).toEqual(['token1', 'token2', null]);

        if (unsubscribe) unsubscribe();
    });

    it('notifies subscribers on settings change', () => {
        const store = new UserStore();
        const settingsValues: any[] = [];

        const unsubscribe = store.subscribe('settings', (settings) => {
            settingsValues.push({ ...settings });
        });

        store.setTimeFormat('24h');
        store.setDateFormat('DD/MM/YYYY');

        expect(settingsValues).toHaveLength(2);
        expect(settingsValues[0].timeFormat).toBe('24h');
        expect(settingsValues[1].dateFormat).toBe('DD/MM/YYYY');

        if (unsubscribe) unsubscribe();
    });
});