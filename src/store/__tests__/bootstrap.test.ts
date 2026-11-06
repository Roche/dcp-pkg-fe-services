import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('store bootstrap', () => {
    beforeEach(() => {
        jest.resetModules();
    });

    it('registers all core stores on first initialize call', async () => {
        const { default: StoreRegistry } = await import('@/utilities/storeRegistry');
        const registerSpy = jest.spyOn(StoreRegistry, 'registerStore');
        const { initializeStores } = await import('@/store/bootstrap');

        await initializeStores();

        expect(StoreRegistry.hasStore('userStore')).toBe(true);
        expect(StoreRegistry.hasStore('uiStore')).toBe(true);
        expect(StoreRegistry.hasStore('gxpStore')).toBe(true);
        expect(registerSpy).toHaveBeenCalledTimes(3);
    });

    it('does not re-register stores on repeated initialize calls', async () => {
        const { default: StoreRegistry } = await import('@/utilities/storeRegistry');
        const registerSpy = jest.spyOn(StoreRegistry, 'registerStore');
        const { initializeStores } = await import('@/store/bootstrap');

        await initializeStores();
        await initializeStores();

        expect(StoreRegistry.hasStore('userStore')).toBe(true);
        expect(StoreRegistry.hasStore('uiStore')).toBe(true);
        expect(StoreRegistry.hasStore('gxpStore')).toBe(true);
        expect(registerSpy).toHaveBeenCalledTimes(3);
    });

    it('reuses the same in-flight initialization for parallel callers', async () => {
        const { default: StoreRegistry } = await import('@/utilities/storeRegistry');
        const registerSpy = jest.spyOn(StoreRegistry, 'registerStore');
        const { initializeStores } = await import('@/store/bootstrap');

        // Ensure eager registrations are settled, then force a fresh init path.
        await initializeStores();
        StoreRegistry.clearRegistry();

        const firstCall = initializeStores();
        const secondCall = initializeStores();
        const thirdCall = initializeStores();

        expect(firstCall).toBe(secondCall);
        expect(secondCall).toBe(thirdCall);

        await Promise.all([firstCall, secondCall, thirdCall]);

        expect(StoreRegistry.hasStore('userStore')).toBe(true);
        expect(StoreRegistry.hasStore('uiStore')).toBe(true);
        expect(StoreRegistry.hasStore('gxpStore')).toBe(true);
        expect(registerSpy).toHaveBeenCalledTimes(6);
    });

    it('does not trigger duplicate registration when stores were imported first', async () => {
        const { default: StoreRegistry } = await import('@/utilities/storeRegistry');
        const registerSpy = jest.spyOn(StoreRegistry, 'registerStore');

        await import('@/store/implementations/userStore');
        await import('@/store/implementations/uiStore');
        await import('@/store/implementations/gxpStore');

        const callsAfterImports = registerSpy.mock.calls.length;

        const { initializeStores } = await import('@/store/bootstrap');
        await initializeStores();

        expect(StoreRegistry.hasStore('userStore')).toBe(true);
        expect(StoreRegistry.hasStore('uiStore')).toBe(true);
        expect(StoreRegistry.hasStore('gxpStore')).toBe(true);
        expect(registerSpy).toHaveBeenCalledTimes(callsAfterImports);
    });

    it('re-registers stores after registry is cleared', async () => {
        const { default: StoreRegistry } = await import('@/utilities/storeRegistry');
        const registerSpy = jest.spyOn(StoreRegistry, 'registerStore');
        const { initializeStores } = await import('@/store/bootstrap');

        await initializeStores();
        StoreRegistry.clearRegistry();

        await initializeStores();

        expect(StoreRegistry.hasStore('userStore')).toBe(true);
        expect(StoreRegistry.hasStore('uiStore')).toBe(true);
        expect(StoreRegistry.hasStore('gxpStore')).toBe(true);
        expect(registerSpy).toHaveBeenCalledTimes(6);
    });
});
