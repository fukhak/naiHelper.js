export class Tools {
    static isInt(n: number){
        return Number(n) === n && n % 1 === 0;
    }
    
    static isFloat(n: number){
        return Number(n) === n && n % 1 !== 0;
    }

    static ramdomInt(n: number) {
        return Math.floor(Math.random()*n);
    }


}