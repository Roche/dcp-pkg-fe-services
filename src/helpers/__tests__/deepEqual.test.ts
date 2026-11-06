import { describe, it, expect } from '@jest/globals';
import { deepEqual } from '@/helpers/deepEqual';

describe('deepEqual', () => {
    it('returns true for equal primitives', () => {
        expect(deepEqual(1, 1)).toBe(true);
        expect(deepEqual('a', 'a')).toBe(true);
    });

    it('returns false for different primitives', () => {
        expect(deepEqual(1, 2)).toBe(false);
        expect(deepEqual('a', 'b')).toBe(false);
    });

    it('returns true for deeply equal objects', () => {
        expect(deepEqual({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } })).toBe(true);
    });

    it('returns false for different objects', () => {
        expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
        expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false);
    });

    it('handles arrays', () => {
        expect(deepEqual([1, 2], [1, 2])).toBe(true);
        expect(deepEqual([1, 2], [2, 1])).toBe(false);
    });
});