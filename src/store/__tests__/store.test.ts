import { describe, it, expect } from '@jest/globals';
import { Store } from '@/store/store';

describe('Store', () => {
    interface TestState {
        foo: number;
        bar: string;
    }

    let store: Store<TestState>;
    let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
    let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

    beforeEach(() => {
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

        store = new Store<TestState>({ foo: 1, bar: 'baz' });
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    it('initializes with default state', () => {
        expect(store.getState()).toEqual({ foo: 1, bar: 'baz' });
    });

    it('updates state and notifies subscribers', () => {
        const callback = jest.fn();
        store.subscribe('foo', callback);
        store.update('foo', 42);
        expect(store.getState().foo).toBe(42);
        expect(callback).toHaveBeenCalledWith(42);
    });

    it('returns unsubscribe function for key subscriptions', () => {
        const callback = jest.fn();
        const unsubscribe = store.subscribe('foo', callback);
        unsubscribe();
        store.update('foo', 99);
        expect(callback).not.toHaveBeenCalled();
    });

    it('subscribes to entire state', () => {
        const callback = jest.fn();
        const unsubscribe = store.subscribe(callback);
        store.update('foo', 2);
        store.update('bar', 'qux');
        expect(callback).toHaveBeenCalledWith({ foo: 2, bar: 'qux' });
        unsubscribe();
    });

    it('throws error for invalid subscribe arguments', () => {
        expect(() => store.subscribe('foo')).toThrow('Invalid arguments for subscribe method.');
    });

    it('persists to localStorage when a key is provided', () => {
        const storageKey = 'testKey';
        localStorage.removeItem(storageKey);
        store.update('foo', 123, storageKey);
        const stored = JSON.parse(localStorage.getItem(storageKey)!);
        expect(stored).toEqual({ foo: 123 });
        localStorage.removeItem(storageKey);
    });

    it('migrates subscribers to another store', () => {
        const callback = jest.fn();
        store.subscribe('foo', callback);

        const newStore = new Store<TestState>({ foo: 0, bar: 'init' });
        store.migrateSubscribers(newStore);

        newStore.update('foo', 77);
        expect(callback).toHaveBeenCalledWith(77);
    });

    it('does not throw when updating an unknown key', () => {
        // No need to spy here, already done in beforeEach
        // @ts-expect-error
        expect(() => store.update('unknown', 5)).not.toThrow();
        expect(consoleErrorSpy).toHaveBeenCalled();
    });
});