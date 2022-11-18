import { Tools } from "./tools";

export class NaiImage {
    seed: number;
    imagesBase64?: string;

    constructor(
        seed: number
    ) {
        this.seed = seed;
    }
} 