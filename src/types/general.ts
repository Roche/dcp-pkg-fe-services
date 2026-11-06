import { BackendResponseInfoType } from "../enums/BackendResponseInfoType"

export type BackendResponseData = {
    info: {
        params: string |null;
        text: string;
        type: BackendResponseInfoType;
    },
    data: any;
}