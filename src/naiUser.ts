export class NaiUser {
    key: string;
    token: string; 

    constructor(key:string, token?: string) {
        this.key = key;
        this.token = token ?? '';
    }
}