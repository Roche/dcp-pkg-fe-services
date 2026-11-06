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
        return a > b ? 1 : -1;
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