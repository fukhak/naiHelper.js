
import { NaiImage } from './naiImage';
import { NaiUser } from './naiUser';
import { Tools } from './tools';

export class NaiHelper {
    static host: string = 'api.novelai.net';
    static defaultModels: Array<string> = ['nai-diffusion'];
    static defailtSamplers: Array<string> = ['k_euler_ancestral', 'k_euler', 'k_lms', 'plms', 'ddim'];
    static defaultQualityTag: string = 'masterpiece, best quality';
    static defaultNegPrompt: string = 'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry';
    static persetLayout(): Map<string, Array<number | string>> {
        var map: Map<string, Array<number | string>> = new Map();
        map.set('ss', [512, 512, 'Small Square']);
        map.set('sp', [384, 640, 'Small Portrait']);
        map.set('sl', [640, 384, 'Small Landscape']);
        map.set('ns', [640, 640, 'Normal Square']);
        map.set('np', [512, 768, 'Normal Portrait']);
        map.set('nl', [768, 512, 'Normal Landscape']);
        map.set('ls', [1024, 1024, 'Large Square']);
        map.set('lp', [512, 1024, 'Large Portrait']);
        map.set('ll', [1024, 512, 'Large Landscape']);
        return map;
    }

    prompt: string;
    negPrompt: string;
    width: number;
    height: number;
    seed: number;
    steps: number;
    scale: number;
    batch_size: number;
    images: Array<NaiImage> = [];
    sampler: string;

    naiUser: NaiUser;
    model: string;

    constructor(
        naiUser: NaiUser,
        prompt: string,
        qualityToggle?: boolean,
        negPrompt?: string,
        width?: number,
        height?: number,
        seed?: number,
        steps?: number,
        scale?: number,
        model?: string,
        sampler?: string,
        batch_size?: number
    ) {
        if (prompt === '') throw new Error('Empty prompt');
        
        this.prompt = qualityToggle ? NaiHelper.defaultQualityTag + ', ' + prompt : prompt;
        this.negPrompt = negPrompt ?? NaiHelper.defaultNegPrompt;
        this.width = width ?? NaiHelper.persetLayout().get('np')![0] as number;
        this.height = height ?? NaiHelper.persetLayout().get('np')![1] as number;
        this.seed = seed ?? Tools.ramdomInt(Math.pow(2,32)+1);
        this.steps = steps ?? 28;
        this.scale = scale ?? 11;
        this.batch_size = batch_size ?? 1;
        this.sampler = sampler ?? NaiHelper.defailtSamplers[0];
        this.model = model ?? NaiHelper.defaultModels[0];
        this.naiUser = naiUser;

        if (!Tools.isInt(this.width)) throw new Error("Wrong Width input type");
        if (!Tools.isInt(this.height)) throw new Error("Wrong Height input type");
        if (!Tools.isInt(this.seed)) throw new Error("Wrong Seed input type");
        if (!Tools.isInt(this.steps)) throw new Error("Wrong Steps input type");
        if (this.width < 64 || this.width > 1024 || this.height < 64 || this.height > 1024) throw new Error('Wrong width/height range');
        if (this.seed < 0 || this.seed > Math.pow(2,32)) throw new Error('Wrong seed range');
        if (this.steps !== null && (this.steps < 1 || this.steps > 50)) throw new Error('Wrong Steps range');
        if (this.scale !== null && (this.scale < 1.1 || this.scale > 100)) throw new Error('Wrong Scale range');
        if (this.batch_size < 1 || this.batch_size > 10) throw new Error('Wrong batch_size range')
        if (!NaiHelper.defaultModels.includes(this.model)) throw new Error('Wrong model select');
        if (!NaiHelper.defailtSamplers.includes(this.sampler)) throw new Error('Wrong Samplers');

        for (let i = 0; i < this.batch_size; i++) {
            this.seed = this.seed % Math.pow(2,32);
            this.images.push(new NaiImage(this.seed));
            this.seed++;
        }
    }

    removeEmptyImages() {
        var tmpImages: Array<NaiImage> = [];
        for (const image of this.images) {
            if (image.imagesBase64 !== undefined && image.imagesBase64 !== null) {
                tmpImages.push(image);
            }
        }
        this.images = tmpImages;
    }

    getDesctipion(): String {
        return this.prompt + '\nNegative prompt: ' + this.negPrompt
            + '\nwidth: ' + this.width + ', height: ' + this.height
            + ', seed: ' + this.seed + ', steps: ' + this.steps
            + ', scale: ' + this.scale + ', sampler: ' + this.sampler
            + ', model: ' + this.model
    }

    async fetch(): Promise<void> {
        if (!await NaiHelper.checkLogon(this.naiUser.token)) {
            var token = NaiHelper.login(this.naiUser.key);
        }

        for (let i = 0; i < this.batch_size && !NaiHelper.checkAllDownloaded(this.images); i++) {
            try {
                var task: Array<Promise<void>> = [];
                for (const image of this.images) {
                    if(image.imagesBase64 === undefined || image.imagesBase64 === null) {
                        task.push(this.downloadImage(image));
                    }
                }
                await Promise.all(task);
            } catch (error) {
                if (error instanceof Error) {
                    console.log(error.message);
                }
            }
        }

        if (!NaiHelper.checkAllDownloaded(this.images)) {
            // throw new Error('download error');
            this.removeEmptyImages();
        }

        if (NaiHelper.checkAllDownloaded(this.images)) {

        } else {
            throw new Error('No any image downloaded');
        }
    }

    async downloadImage(image: NaiImage): Promise<void> {
        var response = await fetch('https://' + NaiHelper.host + '/ai/generate-image', {
            'body': JSON.stringify({
                'input': this.prompt,
                'model': this.model,
                'parameters': {
                    'width': this.width,
                    'height': this.height,
                    'scale': this.scale,
                    'sampler': this.sampler,
                    'steps': this.steps,
                    'seed': image.seed,
                    'n_samples': 1,
                    'ucPreset': 0,
                    'qualityToggle': false,
                    'uc': this.negPrompt
                }
            }),
            'headers': {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + this.naiUser.token,

            },
            'method': 'POST',
        })

        if (response.status === 201) {
            var body = await response.text();
            for (const line of body.split('\n')) {
                if(line.startsWith('data:')) {
                    image.imagesBase64 = line.substring('data:'.length);
                    return
                }
            }
        } 

        if (response.status === 429) {
            throw new Error('429');
        }

        throw new Error(await response.text());
    }

    static async login(key: string): Promise<string> {
        var response = await fetch('https://' + NaiHelper.host + '/user/login', {
            'body': '{"key":"' + key + '"}',
            'headers': {
                'Content-Type': 'application/json',
            },
            'method': 'POST',
        })

        if (response.status === 201) {
            return (await response.json()).accessToken
        } else if (response.status === 401) {
            throw new Error('Account key is wrong, it maybe changed password');
        }

        throw new Error(await response.text());
    }

    static async checkLogon(token: string): Promise<boolean> {
        var response = await fetch('https://' + NaiHelper.host + '/user/subscription', {
            'headers': {
                'Authorization': 'Bearer '+token,
                'Content-Type': 'application/json',
            },
            'method': 'GET'
        })

        return response.status === 200;
    }

    static checkAllDownloaded(images: Array<NaiImage>): boolean {
        for (const image of images) {
            if (image.imagesBase64 === undefined) {
                return false;
            }
        }
        return true;
    }
}

