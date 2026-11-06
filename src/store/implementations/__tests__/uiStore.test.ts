import { describe, it, expect } from '@jest/globals';
import { uiStore, UiStore } from '@/store/implementations/uiStore';
import { initialUiState } from '@/store/implementations/states/initialUiState';

describe('UiStore', () => {
    const storageKey = 'ui';
    let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
    let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

    beforeEach(() => {
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        localStorage.clear();
    });

    afterEach(() => {
        // Restore console methods after each test
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    it('initializes with default state if localStorage is empty', () => {
        expect(uiStore.getState()).toEqual(initialUiState);
    });

    it('initializes with mapped state from localStorage', () => {
        localStorage.setItem(storageKey, JSON.stringify({ language: 'de' }));
        const freshUiStore = new UiStore();
        expect(freshUiStore.getState().language).toBe('de');
    });

    it('prefers fresh siteContext over stale nested site object', () => {
        localStorage.setItem(storageKey, JSON.stringify({
            siteContext: 200,
            siteShortName: 'New Site',
            siteTimeZoneName: 'UTC',
            siteUTCOffset: 0,
            site: {
                id: 100,
                name: 'Old Site',
                timeZone: 'CET',
                utcOffset: 1,
            },
        }));

        const freshUiStore = new UiStore();
        expect(freshUiStore.getState().site).toEqual({
            id: 200,
            name: 'New Site',
            timeZone: 'UTC',
            utcOffset: 0,
        });
    });

    it('initializes with mapped state for legacy activeModules localStorage', () => {
        localStorage.setItem(storageKey, JSON.stringify({ activeModules:
                [{ID: 12, ModuleName: 'Name', SiteID: 12, IsEnable: true}]
        }));
        const freshUiStore = new UiStore();
        expect(freshUiStore.getState().activeModules[0].id).toBe(12);
    });

    it('initializes with mapped state for uiStore activeModules localStorage', () => {
        localStorage.setItem(storageKey, JSON.stringify({ activeModules:
                [{id: 12, name: 'Name', siteId: 12, enabled: true}]
        }));
        const freshUiStore = new UiStore();
        expect(freshUiStore.getState().activeModules[0].id).toBe(12);
    });

    it('initializes with mapped state for activeModules from localStorage', () => {
        localStorage.setItem(storageKey, JSON.stringify({ activeModules:
                [{ID: 12, ModuleName: 'Name', SiteID: 12, IsEnable: true}]
        }));
        const freshUiStore = new UiStore();
        expect(freshUiStore.getState().activeModules[0].id).toBe(12);
    });

    it('falls back to default state on invalid localStorage', () => {
        localStorage.setItem(storageKey, '{invalid json');
        const freshUiStore = new UiStore();
        expect(freshUiStore.getState()).toEqual(initialUiState);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('Failed to parse ui from localStorage:'),
            expect.any(SyntaxError)
        );
    });

    it('setRedirectTo updates state and persists', () => {
        uiStore.setRedirectTo('/dashboard');
        expect(uiStore.getState().redirectTo).toBe('/dashboard');
        expect(JSON.parse(localStorage.getItem(storageKey)!)).toMatchObject({ redirectTo: '/dashboard' });
    });

    it('setLoading adds a loading key', () => {
        uiStore.setLoading('foo');
        expect(uiStore.getState().loading).toHaveProperty('foo', true);
    });

    it('removeLoading removes a loading key', () => {
        uiStore.setLoading('foo');
        uiStore.removeLoading('foo');
        expect(uiStore.getState().loading).not.toHaveProperty('foo');
    });

    it('setMenu merges expanded keys', () => {
        uiStore.setMenu({ expanded: { a: true } });
        uiStore.setMenu({ expanded: { b: true } });
        expect(uiStore.getState().menu.expanded).toEqual({ a: true, b: true });
    });

    it('enableSiteSelection and disableSiteSelection toggle the flag', () => {
        uiStore.disableSiteSelection();
        expect(uiStore.getState().enableSiteSelection).toBe(false);
        uiStore.enableSiteSelection();
        expect(uiStore.getState().enableSiteSelection).toBe(true);
    });

    it('setMessage updates the correct alert type', () => {
        uiStore.setMessage('success', 'ok!');
        expect(uiStore.getState().messages).toEqual([
            { type: 'success', message: 'ok!' }
        ]);
        uiStore.clearMessages();
        expect(uiStore.getState().messages).toEqual([]);
    });

    it('reacts to new messages via subscription', () => {
        const processed: Array<{ type: string, message: string }> = [];

        const unsubscribe = uiStore.subscribe('messages', (messages) => {
            if (messages.length > 0) {
                const msg = uiStore.dequeueMessage();
                if (msg) processed.push(msg);
            }
        });

        uiStore.setMessage('info', 'Hello!');
        uiStore.setMessage('error', 'Oops!');

        expect(processed).toEqual([
            { type: 'info', message: 'Hello!' },
            { type: 'error', message: 'Oops!' }
        ]);

        if (unsubscribe) unsubscribe();
    });

    it('setLanguage updates language', () => {
        uiStore.setLanguage('fr');
        expect(uiStore.getState().language).toBe('fr');
    });

    it('setCurrentSite persists nested and legacy site fields atomically', () => {
        const freshUiStore = new UiStore();
        freshUiStore.setCurrentSite({
            id: 14,
            name: 'BS',
            timeZone: 'Europe/Berlin',
            utcOffset: 2,
        });

        const storedUi = JSON.parse(localStorage.getItem(storageKey)!);
        expect(storedUi).toMatchObject({
            site: {
                id: 14,
                name: 'BS',
                timeZone: 'Europe/Berlin',
                utcOffset: 2,
            },
            siteContext: 14,
            siteShortName: 'BS',
            siteTimeZoneName: 'Europe/Berlin',
            siteUTCOffset: 2,
        });
    });

    it('setCurrentSite emits one effective site update', () => {
        let notifications = 0;
        const unsubscribe = uiStore.subscribe('site', () => {
            notifications += 1;
        });

        const currentId = uiStore.getState().site.id;
        const nextId = typeof currentId === 'number' ? currentId + 1 : 101;

        uiStore.setCurrentSite({
            id: nextId,
            name: 'Callback Site',
            timeZone: 'Europe/Berlin',
            utcOffset: 2,
        });

        expect(uiStore.getState().site.id).toBe(nextId);
        expect(notifications).toBe(1);
        unsubscribe();
    });
});
