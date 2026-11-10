import { describe, it, expect } from '@jest/globals';
import StoreVersion from '@/utilities/storeVersion';

describe('StoreVersion', () => {
    it('compares equal versions', () => {
        expect(new StoreVersion('1.2.3').compareTo(new StoreVersion('1.2.3'))).toBe(0);
    });

    it('detects greater version', () => {
        expect(new StoreVersion('1.2.4').compareTo(new StoreVersion('1.2.3'))).toBe(1);
    });

    it('detects lesser version', () => {
        expect(new StoreVersion('1.2.2').compareTo(new StoreVersion('1.2.3'))).toBe(-1);
    });

    it('handles different length versions', () => {
        expect(new StoreVersion('1.2').compareTo(new StoreVersion('1.2.0'))).toBe(0);
        expect(new StoreVersion('1.2.1').compareTo(new StoreVersion('1.2'))).toBe(1);
        expect(new StoreVersion('1.2').compareTo(new StoreVersion('1.2.1'))).toBe(-1);
    });

    it('handles empty and invalid version strings', () => {
        expect(new StoreVersion('').compareTo(new StoreVersion('0'))).toBe(0);
        expect(new StoreVersion('1..2').compareTo(new StoreVersion('1.0.2'))).toBe(0);
    });

    it('handles leading zeros', () => {
        expect(new StoreVersion('01.02.03').compareTo(new StoreVersion('1.2.3'))).toBe(0);
    });

    it('handles long versions', () => {
        expect(new StoreVersion('1.2.3.4.5').compareTo(new StoreVersion('1.2.3.4.5'))).toBe(0);
        // sonarjs:S1313 - not a IP address, just a version number
        expect(new StoreVersion('1.2.3.4.5').compareTo(new StoreVersion('1.2.3.4'))).toBe(1);
    });

    it('treats release as greater than pre-release', () => {
        expect(new StoreVersion('1.2.3').compareTo(new StoreVersion('1.2.3-alpha'))).toBe(1);
        expect(new StoreVersion('1.2.3-beta').compareTo(new StoreVersion('1.2.3'))).toBe(-1);
    });

    it('compares pre-release tags by precedence', () => {
        expect(new StoreVersion('1.2.3-rc').compareTo(new StoreVersion('1.2.3-beta'))).toBe(1);
        expect(new StoreVersion('1.2.3-beta').compareTo(new StoreVersion('1.2.3-alpha'))).toBe(1);
        expect(new StoreVersion('1.2.3-alpha').compareTo(new StoreVersion('1.2.3-beta'))).toBe(-1);
        expect(new StoreVersion('1.2.3-beta').compareTo(new StoreVersion('1.2.3-rc'))).toBe(-1);
    });

    it('compares unknown pre-release tags lexically', () => {
        expect(new StoreVersion('1.2.3-dev').compareTo(new StoreVersion('1.2.3-test'))).toBe(-1);
        expect(new StoreVersion('1.2.3-test').compareTo(new StoreVersion('1.2.3-dev'))).toBe(1);
    });

    it('compares equal pre-release tags as equal', () => {
        expect(new StoreVersion('1.2.3-alpha').compareTo(new StoreVersion('1.2.3-alpha'))).toBe(0);
        expect(new StoreVersion('1.2.3-beta').compareTo(new StoreVersion('1.2.3-beta'))).toBe(0);
    });

    it('compares numeric pre-release identifiers numerically, not lexically', () => {
        expect(new StoreVersion('1.2.3-alpha.2').compareTo(new StoreVersion('1.2.3-alpha.10'))).toBe(-1);
        expect(new StoreVersion('1.2.3-alpha.10').compareTo(new StoreVersion('1.2.3-alpha.2'))).toBe(1);
        expect(new StoreVersion('1.2.3-alpha.2').compareTo(new StoreVersion('1.2.3-alpha.2'))).toBe(0);
    });

    it('treats a pre-release with more identifiers as greater when the shared prefix is equal', () => {
        expect(new StoreVersion('1.2.3-alpha.1.1').compareTo(new StoreVersion('1.2.3-alpha.1'))).toBe(1);
        expect(new StoreVersion('1.2.3-alpha.1').compareTo(new StoreVersion('1.2.3-alpha.1.1'))).toBe(-1);
    });

    it('matches the real-world backward compatibility scenario', () => {
        // VERSION = '1.2.0-alpha.2' introduced alongside stable 1.1.x/1.0.x releases
        expect(new StoreVersion('1.2.0-alpha.2').compareTo(new StoreVersion('1.2.0-alpha.1'))).toBe(1);
        expect(new StoreVersion('1.2.0-alpha.1').compareTo(new StoreVersion('1.2.0-alpha.2'))).toBe(-1);
        expect(new StoreVersion('1.2.0-alpha.2').compareTo(new StoreVersion('1.1.4'))).toBe(1);
        expect(new StoreVersion('1.1.4').compareTo(new StoreVersion('1.0.5'))).toBe(1);
        expect(new StoreVersion('1.2.0-alpha.2').compareTo(new StoreVersion('1.0.0'))).toBe(1);
    });
});