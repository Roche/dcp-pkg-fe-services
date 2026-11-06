import { UiState } from '@/types/stores';

export const initialUiState: UiState = {
    language: 'en',
    loading: {},
    redirectTo: '',
    messages: [],
    enableSiteSelection: true,
    site: {
        id: null,
        name: null,
        timeZone: null,
        utcOffset: null
    },
    activeModules: [],
    menu: {
        expanded: {}
    }
};