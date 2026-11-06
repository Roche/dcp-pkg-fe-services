import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { gxpStore } from '@/store/implementations/gxpStore';
import { initialGxpState } from '@/store/implementations/states/initialGxpState';
import { GxpAppHistoryEntry } from '@/types/stores';

describe('GxpStore', () => {
    let consoleWarnSpy: jest.SpiedFunction<typeof console.warn>;
    let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
    let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

    beforeEach(() => {
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

        // Clear all apps before each test
        const appNames = gxpStore.getAppNames();
        appNames.forEach(appName => gxpStore.unregisterApp(appName));
    });

    afterEach(() => {
        consoleWarnSpy.mockRestore();
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    const createMockEntry = (overrides?: Partial<GxpAppHistoryEntry>): GxpAppHistoryEntry => ({
        url: '/api/test',
        method: 'GET',
        backend: true,
        dataSource: false,
        calculationEngine: false,
        entity: false,
        ...overrides
    });

    it('initializes with default state', () => {
        expect(gxpStore.getState()).toEqual(initialGxpState);
    });

    it('registers a new app', () => {
        gxpStore.registerApp('testApp', true, true, '1.0.0');

        const state = gxpStore.getState();
        expect(state.activeApps['testApp']).toBeDefined();
        expect(state.activeApps['testApp'].name).toBe('testApp');
        expect(state.activeApps['testApp'].isValidated).toBe(true);
        expect(state.activeApps['testApp'].version).toBe('1.0.0');
        expect(state.activeApps['testApp'].enableAutoClearHistory).toBe(true);
        expect(state.activeApps['testApp'].requestHistory).toEqual([]);
    });

    it('registers app with custom enableAutoClearHistory', () => {
        gxpStore.registerApp('testApp', true, false, '1.0.0');

        const state = gxpStore.getState();
        expect(state.activeApps['testApp'].enableAutoClearHistory).toBe(false);
    });

    it('sets app auto clear history', async () => {
        gxpStore.registerApp('testApp', true);
        gxpStore.setAppAutoClearHistory('testApp', false);

        await new Promise(resolve => setTimeout(resolve, 10));

        expect(gxpStore.getState().activeApps['testApp'].enableAutoClearHistory).toBe(false);
    });

    it('warns when setting auto clear history for non-existent app', async () => {
        gxpStore.setAppAutoClearHistory('nonExistent', true);
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(consoleWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining('Cannot set auto clear history for unregistered app: nonExistent')
        );
    });

    it('does not re-register an existing app', () => {
        gxpStore.registerApp('testApp', true);
        gxpStore.registerApp('testApp', false);

        expect(gxpStore.getState().activeApps['testApp'].isValidated).toBe(true);
    });

    it('unregisters an app', () => {
        gxpStore.registerApp('testApp', true);
        gxpStore.unregisterApp('testApp');

        expect(gxpStore.getState().activeApps['testApp']).toBeUndefined();
    });

    it('warns when unregistering non-existent app', () => {
        gxpStore.unregisterApp('nonExistent');

        expect(consoleWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining("Cannot unregister app that doesn't exist: nonExistent")
        );
    });

    it('checks if app is registered', () => {
        expect(gxpStore.isAppRegistered('testApp')).toBe(false);

        gxpStore.registerApp('testApp', true);
        expect(gxpStore.isAppRegistered('testApp')).toBe(true);

        gxpStore.unregisterApp('testApp');
        expect(gxpStore.isAppRegistered('testApp')).toBe(false);
    });

    it('sets app validated status', async () => {
        gxpStore.registerApp('testApp', false);
        gxpStore.setAppValidated('testApp', true);

        await new Promise(resolve => setTimeout(resolve, 10));

        expect(gxpStore.getState().activeApps['testApp'].isValidated).toBe(true);
    });

    it('warns when setting validation for non-existent app', async () => {
        gxpStore.setAppValidated('nonExistent', true);
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(consoleWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining('Cannot set validation for unregistered app: nonExistent')
        );
    });

    it('adds request history entry', async () => {
        gxpStore.registerApp('testApp', true);
        const entry = createMockEntry();

        gxpStore.addRequestHistoryEntry('testApp', entry);
        await new Promise(resolve => setTimeout(resolve, 10));

        const history = gxpStore.getRequestHistory('testApp');
        expect(history).toHaveLength(1);
        expect(history[0]).toEqual(entry);
    });

    it('adds request history entry with tag', async () => {
        gxpStore.registerApp('testApp', true);
        const entry = createMockEntry({ tag: 'user-action' });

        gxpStore.addRequestHistoryEntry('testApp', entry);
        await new Promise(resolve => setTimeout(resolve, 10));

        const history = gxpStore.getRequestHistory('testApp');
        expect(history).toHaveLength(1);
        expect(history[0].tag).toBe('user-action');
    });

    it('warns when adding history for non-existent app', async () => {
        const entry = createMockEntry();
        gxpStore.addRequestHistoryEntry('nonExistent', entry);
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(consoleWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining('Cannot add history for unregistered app: nonExistent')
        );
    });

    it('gets request history', async () => {
        gxpStore.registerApp('testApp', true);
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry());
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test2' }));

        await new Promise(resolve => setTimeout(resolve, 10));

        const history = gxpStore.getRequestHistory('testApp');
        expect(history).toHaveLength(2);
    });

    it('returns empty array for non-existent app history', () => {
        const history = gxpStore.getRequestHistory('nonExistent');
        expect(history).toEqual([]);
        expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('clears request history', async () => {
        gxpStore.registerApp('testApp', true);
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry());
        await new Promise(resolve => setTimeout(resolve, 10));

        gxpStore.clearRequestHistory('testApp');
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(gxpStore.getRequestHistory('testApp')).toHaveLength(0);
    });

    it('filters history by method (case-insensitive)', async () => {
        gxpStore.registerApp('testApp', true);
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ method: 'GET' }));
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ method: 'POST' }));
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ method: 'get' }));

        await new Promise(resolve => setTimeout(resolve, 10));

        const getHistory = gxpStore.getRequestHistoryByMethod('testApp', 'GET');
        expect(getHistory).toHaveLength(2);

        const postHistory = gxpStore.getRequestHistoryByMethod('testApp', 'post');
        expect(postHistory).toHaveLength(1);
    });

    it('filters history by method and tag', async () => {
        gxpStore.registerApp('testApp', true);
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ method: 'GET', tag: 'analytics' }));
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ method: 'POST', tag: 'form-submit' }));
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ method: 'GET', tag: 'data-fetch' }));
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ method: 'GET', tag: 'analytics' }));

        await new Promise(resolve => setTimeout(resolve, 10));

        const analyticsGet = gxpStore.getRequestHistoryByMethod('testApp', 'GET', 'analytics');
        expect(analyticsGet).toHaveLength(2);
        expect(analyticsGet.every(entry => entry.tag === 'analytics')).toBe(true);
    });

    it('gets last request history entry', async () => {
        gxpStore.registerApp('testApp', true);
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/first' }));
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/last' }));

        await new Promise(resolve => setTimeout(resolve, 10));

        const last = gxpStore.getLastRequestHistoryEntry('testApp');
        expect(last?.url).toBe('/last');
    });

    it('gets last request history entry by method', async () => {
        gxpStore.registerApp('testApp', true);
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ method: 'GET', url: '/first' }));
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ method: 'POST', url: '/post' }));
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ method: 'GET', url: '/last' }));

        await new Promise(resolve => setTimeout(resolve, 10));

        const lastGet = gxpStore.getLastRequestHistoryEntry('testApp', 'GET');
        expect(lastGet?.url).toBe('/last');
    });

    it('gets last request history entry by method and tag', async () => {
        gxpStore.registerApp('testApp', true);
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ method: 'GET', url: '/first', tag: 'analytics' }));
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ method: 'POST', url: '/post', tag: 'form-submit' }));
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ method: 'GET', url: '/middle', tag: 'data-fetch' }));
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ method: 'GET', url: '/last', tag: 'analytics' }));

        await new Promise(resolve => setTimeout(resolve, 10));

        const lastAnalyticsGet = gxpStore.getLastRequestHistoryEntry('testApp', 'GET', 'analytics');
        expect(lastAnalyticsGet?.url).toBe('/last');
        expect(lastAnalyticsGet?.tag).toBe('analytics');
    });

    it('returns undefined when no history entries exist', () => {
        gxpStore.registerApp('testApp', true);

        const last = gxpStore.getLastRequestHistoryEntry('testApp');
        expect(last).toBeUndefined();
    });

    it('removes history entry by exact string pattern', async () => {
        gxpStore.registerApp('testApp', true);
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test' }));
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/other' }));

        await new Promise(resolve => setTimeout(resolve, 10));

        gxpStore.removeRequestHistoryEntry('testApp', '/api/test');
        await new Promise(resolve => setTimeout(resolve, 10));

        const history = gxpStore.getRequestHistory('testApp');
        expect(history).toHaveLength(1);
        expect(history[0].url).toBe('/api/other');
    });

    it('removes history entry by wildcard pattern', async () => {
        gxpStore.registerApp('testApp', true);
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test/123' }));
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test/456' }));
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/other' }));

        await new Promise(resolve => setTimeout(resolve, 10));

        gxpStore.removeRequestHistoryEntry('testApp', '/api/test/*');
        await new Promise(resolve => setTimeout(resolve, 10));

        const history = gxpStore.getRequestHistory('testApp');
        expect(history).toHaveLength(1);
        expect(history[0].url).toBe('/api/other');
    });

    it('removes history entry by regex', async () => {
        gxpStore.registerApp('testApp', true);
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test/123' }));
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test/456' }));
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/other' }));

        await new Promise(resolve => setTimeout(resolve, 10));

        gxpStore.removeRequestHistoryEntry('testApp', /\/api\/test\/\d+/);
        await new Promise(resolve => setTimeout(resolve, 10));

        const history = gxpStore.getRequestHistory('testApp');
        expect(history).toHaveLength(1);
        expect(history[0].url).toBe('/api/other');
    });

    it('removes history entry by multiple patterns', async () => {
        gxpStore.registerApp('testApp', true);
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test' }));
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/other' }));
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/third' }));

        await new Promise(resolve => setTimeout(resolve, 10));

        gxpStore.removeRequestHistoryEntry('testApp', ['/api/test', '/api/other']);
        await new Promise(resolve => setTimeout(resolve, 10));

        const history = gxpStore.getRequestHistory('testApp');
        expect(history).toHaveLength(1);
        expect(history[0].url).toBe('/api/third');
    });

    it('removes history entry by pattern and method', async () => {
        gxpStore.registerApp('testApp', true);
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test', method: 'GET' }));
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test', method: 'POST' }));

        await new Promise(resolve => setTimeout(resolve, 10));

        gxpStore.removeRequestHistoryEntry('testApp', '/api/test', 'GET');
        await new Promise(resolve => setTimeout(resolve, 10));

        const history = gxpStore.getRequestHistory('testApp');
        expect(history).toHaveLength(1);
        expect(history[0].method).toBe('POST');
    });

    it('removes history entry by pattern, method, and tag', async () => {
        gxpStore.registerApp('testApp', true);
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test', method: 'GET', tag: 'analytics' }));
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test', method: 'GET', tag: 'data-fetch' }));
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test', method: 'POST', tag: 'analytics' }));

        await new Promise(resolve => setTimeout(resolve, 10));

        gxpStore.removeRequestHistoryEntry('testApp', '/api/test', 'GET', 'analytics');
        await new Promise(resolve => setTimeout(resolve, 10));

        const history = gxpStore.getRequestHistory('testApp');
        expect(history).toHaveLength(2);
        expect(history.some(entry => entry.method === 'GET' && entry.tag === 'data-fetch')).toBe(true);
        expect(history.some(entry => entry.method === 'POST' && entry.tag === 'analytics')).toBe(true);
    });

    it('removes all entries with specific tag regardless of URL', async () => {
        gxpStore.registerApp('testApp', true);
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test', tag: 'analytics' }));
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/other', tag: 'analytics' }));
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/third', tag: 'data-fetch' }));

        await new Promise(resolve => setTimeout(resolve, 10));

        gxpStore.removeRequestHistoryEntry('testApp', '/*', null, 'analytics');
        await new Promise(resolve => setTimeout(resolve, 10));

        const history = gxpStore.getRequestHistory('testApp');
        expect(history).toHaveLength(1);
        expect(history[0].tag).toBe('data-fetch');
    });

    it('gets last request history entry by URL pattern', async () => {
        gxpStore.registerApp('testApp', true);
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test/123' }));
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/other' }));
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test/456' }));

        await new Promise(resolve => setTimeout(resolve, 10));

        const last = gxpStore.getLastRequestHistoryEntryByUrl('testApp', '/api/test/*');
        expect(last?.url).toBe('/api/test/456');
    });

    it('gets last request history entry by URL pattern and method', async () => {
        gxpStore.registerApp('testApp', true);
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test', method: 'GET' }));
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test', method: 'POST' }));
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test', method: 'GET' }));

        await new Promise(resolve => setTimeout(resolve, 10));

        const lastGet = gxpStore.getLastRequestHistoryEntryByUrl('testApp', '/api/test', 'GET');
        expect(lastGet?.method).toBe('GET');
    });

    it('gets last request history entry by URL pattern, method, and tag', async () => {
        gxpStore.registerApp('testApp', true);
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test', method: 'GET', tag: 'analytics' }));
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test', method: 'GET', tag: 'data-fetch' }));
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test', method: 'GET', tag: 'analytics' }));

        await new Promise(resolve => setTimeout(resolve, 10));

        const lastAnalytics = gxpStore.getLastRequestHistoryEntryByUrl('testApp', '/api/test', 'GET', 'analytics');
        expect(lastAnalytics?.tag).toBe('analytics');
        expect(lastAnalytics?.method).toBe('GET');
    });

    it('returns undefined when no matching URL pattern found', async () => {
        gxpStore.registerApp('testApp', true);
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/other' }));

        await new Promise(resolve => setTimeout(resolve, 10));

        const result = gxpStore.getLastRequestHistoryEntryByUrl('testApp', '/api/test/*');
        expect(result).toBeUndefined();
    });

    it('gets request history by tag', async () => {
        gxpStore.registerApp('testApp', true);
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test1', tag: 'analytics' }));
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test2', tag: 'form-submit' }));
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test3', tag: 'analytics' }));

        await new Promise(resolve => setTimeout(resolve, 10));

        const analyticsHistory = gxpStore.getRequestHistoryByTag('testApp', 'analytics');
        expect(analyticsHistory).toHaveLength(2);
        expect(analyticsHistory.every(entry => entry.tag === 'analytics')).toBe(true);
    });

    it('returns empty array when no entries match tag', async () => {
        gxpStore.registerApp('testApp', true);
        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ tag: 'analytics' }));

        await new Promise(resolve => setTimeout(resolve, 10));

        const result = gxpStore.getRequestHistoryByTag('testApp', 'non-existent-tag');
        expect(result).toEqual([]);
    });

    it('gets all app names', () => {
        gxpStore.registerApp('app1', true);
        gxpStore.registerApp('app2', false);

        const names = gxpStore.getAppNames();
        expect(names).toContain('app1');
        expect(names).toContain('app2');
        expect(names.length).toBeGreaterThanOrEqual(2);
    });

    it('gets all apps', () => {
        gxpStore.registerApp('app1', true);
        gxpStore.registerApp('app2', false);

        const apps = gxpStore.getAllApps();
        expect(apps.some(app => app.name === 'app1')).toBe(true);
        expect(apps.some(app => app.name === 'app2')).toBe(true);
    });

    it('processes operations sequentially in queue', async () => {
        gxpStore.registerApp('testApp', true);

        // Add multiple operations quickly
        for (let i = 0; i < 5; i++) {
            gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: `/api/test/${i}` }));
        }

        // Wait for queue to process
        await new Promise(resolve => setTimeout(resolve, 50));

        const history = gxpStore.getRequestHistory('testApp');
        expect(history).toHaveLength(5);

        // Verify all entries are present
        history.forEach((entry, index) => {
            expect(entry.url).toBe(`/api/test/${index}`);
        });
    });

    it('tracks different types of requests (backend, dataSource, etc.)', async () => {
        gxpStore.registerApp('testApp', true);

        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({
            backend: true,
            dataSource: false,
            calculationEngine: false,
            entity: false
        }));

        gxpStore.addRequestHistoryEntry('testApp', createMockEntry({
            backend: false,
            dataSource: true,
            calculationEngine: true,
            entity: false
        }));

        await new Promise(resolve => setTimeout(resolve, 10));

        const history = gxpStore.getRequestHistory('testApp');
        expect(history[0].backend).toBe(true);
        expect(history[0].dataSource).toBe(false);
        expect(history[1].dataSource).toBe(true);
        expect(history[1].calculationEngine).toBe(true);
    });

    describe('Ignore Flag', () => {
        it('sets ignore flag by URL pattern', async () => {
            gxpStore.registerApp('testApp', true);
            gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test' }));
            gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/other' }));

            await new Promise(resolve => setTimeout(resolve, 10));

            gxpStore.setIgnoreFlag('testApp', { urlPattern: '/api/test' }, true);
            await new Promise(resolve => setTimeout(resolve, 10));

            const history = gxpStore.getRequestHistory('testApp');
            expect(history[0].ignore).toBe(true);
            expect(history[1].ignore).toBeUndefined();
        });

        it('sets ignore flag by wildcard URL pattern', async () => {
            gxpStore.registerApp('testApp', true);
            gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test/123' }));
            gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test/456' }));
            gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/other' }));

            await new Promise(resolve => setTimeout(resolve, 10));

            gxpStore.setIgnoreFlag('testApp', { urlPattern: '/api/test/*' }, true);
            await new Promise(resolve => setTimeout(resolve, 10));

            const history = gxpStore.getRequestHistory('testApp');
            expect(history[0].ignore).toBe(true);
            expect(history[1].ignore).toBe(true);
            expect(history[2].ignore).toBeUndefined();
        });

        it('sets ignore flag by tag only', async () => {
            gxpStore.registerApp('testApp', true);
            gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test1', tag: 'analytics' }));
            gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test2', tag: 'analytics' }));
            gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test3', tag: 'data-fetch' }));

            await new Promise(resolve => setTimeout(resolve, 10));

            gxpStore.setIgnoreFlag('testApp', { tag: 'analytics' }, true);
            await new Promise(resolve => setTimeout(resolve, 10));

            const history = gxpStore.getRequestHistory('testApp');
            expect(history[0].ignore).toBe(true);
            expect(history[1].ignore).toBe(true);
            expect(history[2].ignore).toBeUndefined();
        });

        it('sets ignore flag by method only', async () => {
            gxpStore.registerApp('testApp', true);
            gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test1', method: 'GET' }));
            gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test2', method: 'POST' }));
            gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test3', method: 'GET' }));

            await new Promise(resolve => setTimeout(resolve, 10));

            gxpStore.setIgnoreFlag('testApp', { requestMethod: 'GET' }, true);
            await new Promise(resolve => setTimeout(resolve, 10));

            const history = gxpStore.getRequestHistory('testApp');
            expect(history[0].ignore).toBe(true);
            expect(history[1].ignore).toBeUndefined();
            expect(history[2].ignore).toBe(true);
        });

        it('sets ignore flag by URL pattern and method', async () => {
            gxpStore.registerApp('testApp', true);
            gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test', method: 'GET' }));
            gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test', method: 'POST' }));
            gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/other', method: 'GET' }));

            await new Promise(resolve => setTimeout(resolve, 10));

            gxpStore.setIgnoreFlag('testApp', { urlPattern: '/api/test', requestMethod: 'GET' }, true);
            await new Promise(resolve => setTimeout(resolve, 10));

            const history = gxpStore.getRequestHistory('testApp');
            expect(history[0].ignore).toBe(true);
            expect(history[1].ignore).toBeUndefined();
            expect(history[2].ignore).toBeUndefined();
        });

        it('sets ignore flag by all criteria', async () => {
            gxpStore.registerApp('testApp', true);
            gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test', method: 'GET', tag: 'analytics' }));
            gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test', method: 'GET', tag: 'data-fetch' }));
            gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test', method: 'POST', tag: 'analytics' }));

            await new Promise(resolve => setTimeout(resolve, 10));

            gxpStore.setIgnoreFlag('testApp', {
                urlPattern: '/api/test',
                requestMethod: 'GET',
                tag: 'analytics'
            }, true);
            await new Promise(resolve => setTimeout(resolve, 10));

            const history = gxpStore.getRequestHistory('testApp');
            expect(history[0].ignore).toBe(true);
            expect(history[1].ignore).toBeUndefined();
            expect(history[2].ignore).toBeUndefined();
        });

        it('sets ignore flag to false', async () => {
            gxpStore.registerApp('testApp', true);
            gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test', ignore: true }));

            await new Promise(resolve => setTimeout(resolve, 10));

            gxpStore.setIgnoreFlag('testApp', { urlPattern: '/api/test' }, false);
            await new Promise(resolve => setTimeout(resolve, 10));

            const history = gxpStore.getRequestHistory('testApp');
            expect(history[0].ignore).toBe(false);
        });

        it('toggles ignore flag by URL pattern', async () => {
            gxpStore.registerApp('testApp', true);
            gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test', ignore: false }));
            gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/other' }));

            await new Promise(resolve => setTimeout(resolve, 10));

            gxpStore.toggleIgnoreFlag('testApp', { urlPattern: '/api/test' });
            await new Promise(resolve => setTimeout(resolve, 10));

            let history = gxpStore.getRequestHistory('testApp');
            expect(history[0].ignore).toBe(true);
            expect(history[1].ignore).toBeUndefined();

            // Toggle again
            gxpStore.toggleIgnoreFlag('testApp', { urlPattern: '/api/test' });
            await new Promise(resolve => setTimeout(resolve, 10));

            history = gxpStore.getRequestHistory('testApp');
            expect(history[0].ignore).toBe(false);
        });

        it('toggles ignore flag by tag', async () => {
            gxpStore.registerApp('testApp', true);
            gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test1', tag: 'analytics' }));
            gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test2', tag: 'analytics' }));

            await new Promise(resolve => setTimeout(resolve, 10));

            gxpStore.toggleIgnoreFlag('testApp', { tag: 'analytics' });
            await new Promise(resolve => setTimeout(resolve, 10));

            const history = gxpStore.getRequestHistory('testApp');
            expect(history[0].ignore).toBe(true);
            expect(history[1].ignore).toBe(true);
        });

        it('toggles ignore flag by multiple URL patterns', async () => {
            gxpStore.registerApp('testApp', true);
            gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test1' }));
            gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test2' }));
            gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/other' }));

            await new Promise(resolve => setTimeout(resolve, 10));

            gxpStore.toggleIgnoreFlag('testApp', { urlPattern: ['/api/test1', '/api/test2'] });
            await new Promise(resolve => setTimeout(resolve, 10));

            const history = gxpStore.getRequestHistory('testApp');
            expect(history[0].ignore).toBe(true);
            expect(history[1].ignore).toBe(true);
            expect(history[2].ignore).toBeUndefined();
        });

        it('warns when setting ignore flag for non-existent app', async () => {
            gxpStore.setIgnoreFlag('nonExistent', { urlPattern: '/api/test' }, true);
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Cannot update ignore flag for unregistered app: nonExistent')
            );
        });

        it('warns when toggling ignore flag for non-existent app', async () => {
            gxpStore.toggleIgnoreFlag('nonExistent', { tag: 'analytics' });
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Cannot update ignore flag for unregistered app: nonExistent')
            );
        });

        it('handles ignore flag with regex patterns', async () => {
            gxpStore.registerApp('testApp', true);
            gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test/123' }));
            gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test/456' }));
            gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/other' }));

            await new Promise(resolve => setTimeout(resolve, 10));

            gxpStore.setIgnoreFlag('testApp', { urlPattern: /\/api\/test\/\d+/ }, true);
            await new Promise(resolve => setTimeout(resolve, 10));

            const history = gxpStore.getRequestHistory('testApp');
            expect(history[0].ignore).toBe(true);
            expect(history[1].ignore).toBe(true);
            expect(history[2].ignore).toBeUndefined();
        });

        it('does not modify entries when no criteria match', async () => {
            gxpStore.registerApp('testApp', true);
            gxpStore.addRequestHistoryEntry('testApp', createMockEntry({ url: '/api/test' }));

            await new Promise(resolve => setTimeout(resolve, 10));

            gxpStore.setIgnoreFlag('testApp', { urlPattern: '/api/nonexistent' }, true);
            await new Promise(resolve => setTimeout(resolve, 10));

            const history = gxpStore.getRequestHistory('testApp');
            expect(history[0].ignore).toBeUndefined();
        });
    });
});