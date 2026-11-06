export function generateRequestId(requestSlug: string, unique: boolean = true): string {
    if (!unique) {
        return `req_${requestSlug}`;
    }
    
    const array = new Uint32Array(2);
    window.crypto.getRandomValues(array);
    return `req_${array[0].toString(36)}_${array[1].toString(36)}_${Date.now()}`;
}