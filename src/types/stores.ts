import { PermissionEntry, SiteEntry } from "@/types/jwt";

export type MessageType = 'success' | 'error' | 'warning' | 'info';

export interface ActiveModules {
    id: number;
    name: string;
    siteId: number;
    enabled: boolean;
}

export interface UiState {
    language: string;
    loading: Record<string, boolean> | false;
    redirectTo: string;
    messages: Array<{ type: MessageType, message: string }>;
    enableSiteSelection: boolean;
    site: {
        id: number | null;
        name: string | null;
        timeZone: string | null;
        utcOffset: number | null;
    }
    activeModules: ActiveModules[];
    menu: {
        expanded: {
            [key: string]: boolean;
        }
    }
}

export interface UserState {
    token: string | null;
    refreshToken: string | null;
    username: string | null;
    userId: number | null;
    displayName: string | null;
    settings: {
        timeFormat: string | null;
        dateFormat: string | null;
    };
    permissions: PermissionEntry[];
    sites: SiteEntry[];
    logoutLink: string;
    logout: boolean;
}

export interface GxpAppHistoryEntry {
    url: string;
    method: string;
    tag?: string;
    ignore?: boolean;
    backend?: boolean;
    dataSource?: boolean;
    calculationEngine?: boolean;
    entity?: boolean;
}

export interface GxpApp {
    name: string;
    isValidated: boolean;
    requestHistory: GxpAppHistoryEntry[];
    enableAutoClearHistory: boolean;
    version?: string;
}

export interface GxpState {
    disableIndicator: boolean;
    activeApps: Record<string, GxpApp>;
}

export type StoreRegistrationStatus =
    | 'registered'
    | 'upgraded'
    | 'replaced-with-dev'
    | 'kept-existing'
    | 'duplicate'
    | 'kept-existing-dev'
    | 'kept-existing-dev-dev'
    | 'rejected-incompatible-upgrade'
    | 'rejected-incompatible-downgrade';

export interface StoreRegistrationResult {
    storeId: string;
    existingVersion?: string;
    newVersion: string;
    status: StoreRegistrationStatus;
    message: string;
}