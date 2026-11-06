import { UserState } from "@/types/stores";

export const initialUserState: UserState = {
    token: null,
    refreshToken: null,
    username: null,
    userId: null,
    displayName: null,
    settings: {
        timeFormat: null,
        dateFormat: null,
    },
    sites: [],
    permissions: [],
    logoutLink: '',
    logout: false
};
