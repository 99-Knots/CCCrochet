// source: https://github.com/bryc/code/blob/master/jshash/PRNGs.md

function mulberry32(a: any) {
    return function() {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}


// hash function for generating seed
function xmur3(str: string) {
    for(var i = 0, h = 1779033703 ^ str.length; i < str.length; i++)
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353),
        h = h << 13 | h >>> 19;
    return function() {
        h = Math.imul(h ^ h >>> 16, 2246822507),
        h = Math.imul(h ^ h >>> 13, 3266489909);
        return (h ^= h >>> 16) >>> 0;
    }
}
let seed = xmur3("crochet");
export const random = mulberry32(seed());

export function setSeed(seedString: string) {
    seed = xmur3(seedString);
}
export function getSeed() {
    return seed;
}

export function randInt(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    let rand = random();
    rand *= (max-min + 1);
    rand = Math.floor(rand);
    rand += min;
    return rand;
}

export function selectWeightedRandom(rules: {weight: number}[]) {
    let total = 0;
    for(const r of rules) {
        total += r.weight;
    }
    const rand = random();
    //console.log(rand);
    const selection = rand * total;
    let cumulative = 0;
    for(let i=0; i<rules.length; i++) {
        cumulative += rules[i].weight;
        if(cumulative >= selection) {
            return i;
        }
    }
}