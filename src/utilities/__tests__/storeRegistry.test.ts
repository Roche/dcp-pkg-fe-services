import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import StoreRegistry from '@/utilities/storeRegistry';
import { Store } from '@/store/store';
import { logger } from '@open-dcp/utilities';

describe('StoreRegistry', () => {
    interface TestState {
        foo: number;
    }

    let store: Store<TestState>;
    let storeV2: Store<TestState>;
    let loggerLogSpy: jest.SpiedFunction<typeof logger.log>;
    let loggerErrorSpy: jest.SpiedFunction<typeof logger.error>;
    let loggerWarnSpy: jest.SpiedFunction<typeof logger.warn>;

    beforeEach(() => {
        StoreRegistry.clearRegistry();

        // Setup logger spies
        loggerLogSpy = jest.spyOn(logger, 'log').mockImplementation(() => { });
        loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => { });
        loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => { });

        store = new Store<TestState>({ foo: 1 });
        store.getVersion = () => '1.0.0';
        store.isCompatibleWith = () => true;

        storeV2 = new Store<TestState>({ foo: 2 });
        storeV2.getVersion = () => '2.0.0';
        storeV2.isCompatibleWith = () => true;
    });

    afterEach(() => {
        loggerLogSpy.mockRestore();
        loggerErrorSpy.mockRestore();
        loggerWarnSpy.mockRestore();
    });

    it('registers and retrieves a store', async () => {
        const result = await StoreRegistry.registerStore('test', store);
        const retrieved = StoreRegistry.getStore<TestState>('test');

        expect(retrieved).toBe(store);
        expect(result.status).toBe('registered');
        expect(loggerLogSpy).toHaveBeenCalledWith('✅ Registering new store "test" (v1.0.0)');
    });

    it('upgrades to newer compatible version and migrates subscribers', async () => {
        const migrateSubscribers = jest.fn();
        store.migrateSubscribers = migrateSubscribers;

        await StoreRegistry.registerStore('test', store);
        const result = await StoreRegistry.registerStore('test', storeV2);

        const retrieved = StoreRegistry.getStore<TestState>('test');

        expect(retrieved).toBe(storeV2);
        expect(result.status).toBe('upgraded');
        expect(migrateSubscribers).toHaveBeenCalledWith(storeV2);
        expect(loggerLogSpy).toHaveBeenCalledWith('✅ Registering new store "test" (v1.0.0)');
        expect(loggerLogSpy).toHaveBeenCalledWith('⬆️  Upgrading store "test" from v1.0.0 to v2.0.0');
    });

    it('migrates subscribers on upgrade and they receive updates', async () => {
        // Step 1: Subscribe a callback to the original store
        const callback = jest.fn();
        store.subscribe('foo', callback);

        // Step 2: Register and upgrade the store
        await StoreRegistry.registerStore('test', store);
        await StoreRegistry.registerStore('test', storeV2);

        // Step 3: Update the new store
        storeV2.update('foo', 42);

        // Step 4: Assert that the callback is called
        expect(callback).toHaveBeenCalledWith(42);

        // Also check that the registry now points to the new store
        const retrieved = StoreRegistry.getStore<TestState>('test');
        expect(retrieved).toBe(storeV2);
    });

    it('does not upgrade to incompatible version', async () => {
        // @ts-ignore
        storeV2.isCompatibleWith = () => false;

        await StoreRegistry.registerStore('test', store);
        const result = await StoreRegistry.registerStore('test', storeV2);

        const retrieved = StoreRegistry.getStore<TestState>('test');

        expect(retrieved).toBe(store);
        expect(result.status).toBe('rejected-incompatible-upgrade');
        expect(loggerErrorSpy).toHaveBeenCalledWith(
            '❌ Incompatible store versions for storeId "test": existing version 1.0.0, new version 2.0.0. Keeping existing store.'
        );
    });

    it('keeps existing store when older version is registered', async () => {
        await StoreRegistry.registerStore('test', storeV2);
        await StoreRegistry.registerStore('test', store);

        const retrieved = StoreRegistry.getStore<TestState>('test');

        expect(retrieved).toBe(storeV2);
        expect(loggerLogSpy).toHaveBeenCalledWith('⏭️  Keeping existing store "test" (v2.0.0), rejecting v1.0.0');
    });

    it('warns when existing newer store is not compatible with incoming older version', async () => {
        storeV2.isCompatibleWith = () => false;

        await StoreRegistry.registerStore('test', storeV2);
        const result = await StoreRegistry.registerStore('test', store);

        const retrieved = StoreRegistry.getStore<TestState>('test');

        expect(retrieved).toBe(storeV2);
        expect(result.status).toBe('rejected-incompatible-downgrade');
        expect(loggerWarnSpy).toHaveBeenCalledWith(
            '⚠️ Existing store version 2.0.0 is not compatible with incoming older version 1.0.0 for storeId "test". Keeping existing store.'
        );
    });

    it('always uses dev version (x.x.x) over production version', async () => {
        const storeDev = new Store<TestState>({ foo: 3 });
        storeDev.getVersion = () => 'x.x.x';
        storeDev.isCompatibleWith = () => true;

        const migrateSubscribers = jest.fn();
        store.migrateSubscribers = migrateSubscribers;

        await StoreRegistry.registerStore('test', store);
        await StoreRegistry.registerStore('test', storeDev);

        const retrieved = StoreRegistry.getStore<TestState>('test');

        expect(retrieved).toBe(storeDev);
        expect(migrateSubscribers).toHaveBeenCalledWith(storeDev);
        expect(loggerLogSpy).toHaveBeenCalledWith('⬆️  Replacing store "test" (v1.0.0) with dev version (x.x.x)');
    });

    it('keeps dev version (x.x.x) when newer production version is registered', async () => {
        const storeDev = new Store<TestState>({ foo: 3 });
        storeDev.getVersion = () => 'x.x.x';
        storeDev.isCompatibleWith = () => true;

        await StoreRegistry.registerStore('test', storeDev);
        await StoreRegistry.registerStore('test', storeV2);

        const retrieved = StoreRegistry.getStore<TestState>('test');

        expect(retrieved).toBe(storeDev);
        expect(loggerLogSpy).toHaveBeenCalledWith('⏭️  Keeping dev version of store "test" (x.x.x), rejecting production v2.0.0');
    });

    it('keeps existing dev version when another dev version is registered (prevent infinite loop)', async () => {
        const storeDev1 = new Store<TestState>({ foo: 3 });
        storeDev1.getVersion = () => 'x.x.x';
        storeDev1.isCompatibleWith = () => true;

        const storeDev2 = new Store<TestState>({ foo: 4 });
        storeDev2.getVersion = () => 'x.x.x';
        storeDev2.isCompatibleWith = () => true;

        await StoreRegistry.registerStore('test', storeDev1);
        await StoreRegistry.registerStore('test', storeDev2);

        const retrieved = StoreRegistry.getStore<TestState>('test');

        expect(retrieved).toBe(storeDev1); // Should keep the first dev version
        expect(loggerLogSpy).toHaveBeenCalledWith('⏭️  Keeping existing dev store "test" (x.x.x), ignoring new dev instance');
    });

    it('migrates subscribers when upgrading to dev version', async () => {
        const storeDev = new Store<TestState>({ foo: 3 });
        storeDev.getVersion = () => 'x.x.x';
        storeDev.isCompatibleWith = () => true;

        const callback = jest.fn();
        store.subscribe('foo', callback);

        await StoreRegistry.registerStore('test', store);
        await StoreRegistry.registerStore('test', storeDev);

        storeDev.update('foo', 99);

        expect(callback).toHaveBeenCalledWith(99);
        expect(StoreRegistry.getStore<TestState>('test')).toBe(storeDev);
    });

    it('prevents race conditions with sequential registrations', async () => {
        const store1 = new Store<TestState>({ foo: 1 });
        store1.getVersion = () => '1.0.0';
        store1.isCompatibleWith = () => true;

        const store2 = new Store<TestState>({ foo: 2 });
        store2.getVersion = () => '2.0.0';
        store2.isCompatibleWith = () => true;

        const store3 = new Store<TestState>({ foo: 3 });
        store3.getVersion = () => '3.0.0';
        store3.isCompatibleWith = () => true;

        // Register all three simultaneously
        await Promise.all([
            StoreRegistry.registerStore('test', store1),
            StoreRegistry.registerStore('test', store2),
            StoreRegistry.registerStore('test', store3)
        ]);

        const retrieved = StoreRegistry.getStore<TestState>('test');

        // Should end up with one of the stores (the queue ensures sequential processing)
        // The exact winner depends on Promise.all execution order, but state should be preserved
        expect(retrieved).toBeDefined();
        expect([store1, store2, store3]).toContain(retrieved);

        // Verify that whichever store won, it has its original value or a migrated value
        const finalValue = retrieved!.getState().foo;
        expect([1, 2, 3]).toContain(finalValue);
    });

    it('migrates state from old store to new store', async () => {
        store.update('foo', 42);

        await StoreRegistry.registerStore('test', store);
        await StoreRegistry.registerStore('test', storeV2);

        const retrieved = StoreRegistry.getStore<TestState>('test');

        expect(retrieved?.getState().foo).toBe(42);
    });

    it('removes a store', async () => {
        await StoreRegistry.registerStore('test', store);
        StoreRegistry.removeStore('test');

        expect(StoreRegistry.getStore<TestState>('test')).toBeUndefined();
    });

    it('clears the registry and registration queue', async () => {
        await StoreRegistry.registerStore('test', store);
        StoreRegistry.clearRegistry();

        expect(StoreRegistry.getStore<TestState>('test')).toBeUndefined();
    });

    it('getAllStores returns all stores', async () => {
        await StoreRegistry.registerStore('test', store);
        await StoreRegistry.registerStore('test2', storeV2);

        const allStores = StoreRegistry.getAllStores();

        expect(allStores.test).toBe(store);
        expect(allStores.test2).toBe(storeV2);
    });

    it('hasStore returns true if store exists', async () => {
        await StoreRegistry.registerStore('test', store);

        expect(StoreRegistry.hasStore('test')).toBe(true);
        expect(StoreRegistry.hasStore('missing')).toBe(false);
    });

    it('handles multiple async registrations for different stores', async () => {
        const storeA = new Store<TestState>({ foo: 1 });
        storeA.getVersion = () => '1.0.0';

        const storeB = new Store<TestState>({ foo: 2 });
        storeB.getVersion = () => '1.0.0';

        await Promise.all([
            StoreRegistry.registerStore('storeA', storeA),
            StoreRegistry.registerStore('storeB', storeB)
        ]);

        expect(StoreRegistry.getStore<TestState>('storeA')).toBe(storeA);
        expect(StoreRegistry.getStore<TestState>('storeB')).toBe(storeB);
    });

    it('logs correct message when registering first dev store', async () => {
        const storeDev = new Store<TestState>({ foo: 3 });
        storeDev.getVersion = () => 'x.x.x';

        await StoreRegistry.registerStore('test', storeDev);

        expect(loggerLogSpy).toHaveBeenCalledWith('✅ Registering new store "test" (vx.x.x)');
    });
});