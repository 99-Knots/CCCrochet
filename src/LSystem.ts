export function rule(successor: string, weight: number) {
    return {"successor": successor, "weight": weight}
}


class Stitch {
    protected _symbol: string;
    protected _rules: {successor: Stitch[], weight: number}[];


    get symbol() {
        return this._symbol;
    }

    constructor(symbol: string, rules?: {successor: Stitch[], weight: number}[]) {
        this._symbol = symbol;
        this._rules = rules ?? [];
    }

    addRule(successor: Stitch[], weight: number) {
        this._rules.push({"successor": successor, "weight": weight});
    }

    selectWeightedRandom() {
        let total = 0;
        for(const r of this._rules) {
            total += r.weight;
        }
        const selection = Math.random() * total;
        let cumulative = 0;
        for(const r of this._rules) {
            cumulative += r.weight;
            if(cumulative >= selection) {
                return r;
            }
        }
    }
}

export class LSystem
{
    rules: Stitch[] = [];
    sentence: Stitch[] = [];
    prevSentences: Stitch[][] = [];

    constructor() {
        const singleCrochet = new Stitch("sc");
        const increase = new Stitch("sc2inc");
        const scBase = new Stitch("sc6inc");
        // const hdcBase = new Stitch("hdc8inc");
        // const dcBase = new Stitch("dc12inc");
        const magicCircle = new Stitch("ring");

        singleCrochet.addRule([singleCrochet], 1);
        increase.addRule([singleCrochet, increase], 1);
        scBase.addRule([increase, increase, increase, increase, increase, increase], 1)
        magicCircle.addRule([scBase], 1);
        this.rules = this.rules.concat([magicCircle, increase, singleCrochet]);
        this.sentence = [magicCircle];
    }

    generate(iterations: number=1) {
        if(iterations <= 0) {
            return this.sentence;
        }
        else {
            let newSAxiom: Stitch[] = [];
            for(let i=0; i < this.sentence.length; i++) {
                const stitch = this.sentence[i];
                const successor = stitch.selectWeightedRandom()?.successor;
                if(successor)
                    newSAxiom = newSAxiom.concat(successor);
            }
            this.prevSentences.push(this.sentence);
            this.sentence = newSAxiom;
            this.generate(iterations-1);
        }
        
    }

    formatToGrammar() {
        let instructions = "";
        for(const sent of this.prevSentences) {
            for(const stitch of sent) {
                instructions+= stitch.symbol + ",";
            }
            instructions += "\n";
        }
        return instructions;
    }
}