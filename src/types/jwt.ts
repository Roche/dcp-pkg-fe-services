export interface PermissionEntry {
    Permission: string;
    SiteId: number;
    SiteName: string;
    Module: string;
};

export interface SiteEntry {
    Name: string;
    ShortName: string;
    SiteId: number;
    TimeZone: string;
    IsEnable: boolean;
};

export interface Jwt {
    permissions: PermissionEntry[];
    userId: number;
    displayName: string;
    persistedGrantsType: number;
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': string;

    /** @deprecated Legacy field. Use `userId` instead. */
    currentLoggedUserId: string;
    /** @deprecated Legacy field. Check in `permissions` instead. */
    isGlobalAdmin: string;
    /** @deprecated Legacy field.  Check in `permissions` instead. */
    isGlobalApiUser: string;
    /** @deprecated Legacy field.  Use in `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name` instead. */
    userName: string;
}