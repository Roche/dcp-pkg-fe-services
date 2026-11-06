import StoreRegistry from '@/utilities/storeRegistry';
import { registerGxpStore } from '@/store/implementations/gxpStore';
import { registerUiStore } from '@/store/implementations/uiStore';
import { registerUserStore } from '@/store/implementations/userStore';
import { gxpStoreRegistration } from '@/store/implementations/gxpStore';
import { uiStoreRegistration } from '@/store/implementations/uiStore';
import { userStoreRegistration } from '@/store/implementations/userStore';

const CORE_STORE_IDS = ['userStore', 'uiStore', 'gxpStore'] as const;

let bootstrapPromise: Promise<void> | null = null;

function areCoreStoresRegistered(): boolean {
    return CORE_STORE_IDS.every((storeId) => StoreRegistry.hasStore(storeId));
}

async function ensureCoreStoresRegistered(): Promise<void> {
    // Reuse module-level eager registration promises first to avoid duplicate attempts.
    await Promise.all([
        userStoreRegistration,
        uiStoreRegistration,
        gxpStoreRegistration,
    ]);

    // Registry can be cleared at runtime; register only stores that are missing.
    await Promise.all([
        StoreRegistry.hasStore('userStore') ? Promise.resolve() : registerUserStore().then(() => undefined),
        StoreRegistry.hasStore('uiStore') ? Promise.resolve() : registerUiStore().then(() => undefined),
        StoreRegistry.hasStore('gxpStore') ? Promise.resolve() : registerGxpStore().then(() => undefined),
    ]);
}

export function initializeStores(): Promise<void> {
    if (bootstrapPromise) {
        return bootstrapPromise;
    }

    if (areCoreStoresRegistered()) {
        return Promise.resolve();
    }

    bootstrapPromise = ensureCoreStoresRegistered()
        .catch((error) => {
            throw error;
        })
        .finally(() => {
            bootstrapPromise = null;
        });

    return bootstrapPromise;
}
