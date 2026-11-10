class StoreVersion {
    arr: number[] = [];
    preRelease: string | null = null;

    constructor(s: string) {
        const [main, pre] = s.split('-');
        this.arr = main.split('.').map(Number);
        this.preRelease = pre ?? null;
    }

    static readonly preReleaseOrder = ['rc', 'beta', 'alpha'];

    private static comparePreRelease(a: string | null, b: string | null): number {
        if (a === b) return 0;
        if (a === null) return 1;
        if (b === null) return -1;

        const aIndex = StoreVersion.preReleaseOrder.findIndex(tag => a.startsWith(tag));
        const bIndex = StoreVersion.preReleaseOrder.findIndex(tag => b.startsWith(tag));
        if (aIndex !== -1 && bIndex !== -1 && aIndex !== bIndex) {
            return aIndex > bIndex ? -1 : 1;
        }
        return StoreVersion.comparePreReleaseIdentifiers(a, b);
    }

    // Compares dot-separated identifiers, treating numeric segments numerically (e.g. "alpha.10" > "alpha.2")
    private static comparePreReleaseIdentifiers(a: string, b: string): number {
        const aParts = a.split('.');
        const bParts = b.split('.');
        const maxLen = Math.max(aParts.length, bParts.length);

        for (let i = 0; i < maxLen; i++) {
            const aPart = aParts[i];
            const bPart = bParts[i];
            if (aPart === bPart) continue;
            if (aPart === undefined) return -1;
            if (bPart === undefined) return 1;

            const aIsNum = aPart !== '' && !Number.isNaN(Number(aPart));
            const bIsNum = bPart !== '' && !Number.isNaN(Number(bPart));

            if (aIsNum && bIsNum) {
                if (Number(aPart) !== Number(bPart)) return Number(aPart) > Number(bPart) ? 1 : -1;
                continue;
            }
            if (aIsNum !== bIsNum) return aIsNum ? -1 : 1;
            return aPart > bPart ? 1 : -1;
        }
        return 0;
    }

    compareTo(v: StoreVersion) {
        const maxLen = Math.max(this.arr.length, v.arr.length);
        for (let i = 0; i < maxLen; i++) {
            const a = this.arr[i] ?? 0;
            const b = v.arr[i] ?? 0;
            if (a !== b) return a > b ? 1 : -1;
        }
        return StoreVersion.comparePreRelease(this.preRelease, v.preRelease);
    }
}

export default StoreVersion;