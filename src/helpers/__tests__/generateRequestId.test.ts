import { generateRequestId } from '@/helpers/generateRequestId';

beforeAll(() => {
    if (!window.crypto) {
        // @ts-ignore
        window.crypto = {
            getRandomValues: <T extends ArrayBufferView>(arr: T): T => {
                const uintArray = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
                for (let i = 0; i < uintArray.length; i++) {
                    // sonarjs:S2245
                    uintArray[i] = Math.floor(Math.random() * 256);
                }
                return arr;
            }
        };
    }
});

describe('generateRequestId', () => {
    it('returns deterministic id if unique is false', () => {
        expect(generateRequestId('foo', false)).toBe('req_foo');
    });

    it('returns unique id if unique is true', () => {
        const id1 = generateRequestId('foo');
        const id2 = generateRequestId('foo');
        expect(id1).not.toBe(id2);
        expect(id1.startsWith('req_')).toBe(true);
    });
});