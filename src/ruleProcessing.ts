import restrictions from "./assets/metaRestrictions.json";
import { type Stitch } from "./Stitches"
import * as random from "./random"

type RuleStitch = {
    topology: "simple" | "decrease" | "chain",
    type: Stitch,
    into: number[],
    parameters: {
        size?: number
    }
}

type RuleCategory = "ring" | "insert"

export class Rule {
    name: string;
    category: RuleCategory;
    consume: number[];
    produce: RuleStitch[];
    weight: number;

    constructor(name: string, category: RuleCategory, consume: number[], produce: RuleStitch[], weight: number) {
        this.name = name;
        this.category = category;
        this.consume = consume;
        this.produce = produce;
        this.weight = weight;
    }
}

function selectStitchType(): Stitch {
    const options = restrictions["stitchTypes"];
    const idx = random.selectWeightedRandom(options);
    if(idx !== undefined)
        return options[idx].value as Stitch;
    else
        return "sc";    // just as a backup default, should never be needed
}

function createRingRule() {
    const options = [
        { type: "sc", weight: 1 },
        { type: "hdc", weight: 1 },
        { type: "dc", weight: 1}
    ]
    const idx = random.selectWeightedRandom(options);
    const produce: RuleStitch[] = [];
    switch(idx && options[idx].type) {
        case "dc": 
            for(let i=0; i<12; i++) {
                const stitch: RuleStitch = {
                    topology: "simple",
                    type: "dc",
                    into: [0],
                    parameters: {}
                };
                produce.push(stitch);
            }
            break;
        case "hdc":
            for(let i=0; i<8; i++) {
                const stitch: RuleStitch = {
                    topology: "simple",
                    type: "hdc",
                    into: [0],
                    parameters: {}
                };
                produce.push(stitch);
            }
            break;
        default:
            for(let i=0; i<6; i++) {
                const stitch: RuleStitch = {
                    topology: "simple",
                    type: "sc",
                    into: [0],
                    parameters: {}
                };
                produce.push(stitch);
            }
            break;
    }

    const rule = new Rule("magic-circle", "ring", [0], produce, 1);
    return rule;
}

function createFlatRule() {
    const stitch: RuleStitch = {
        topology: "simple",
        type: selectStitchType(),
        into: [0],
        parameters: {}
    };

    const weight = random.randInt(1, 5);

    const rule = new Rule("flat", "insert", [0], [stitch], weight)
    return rule;
}

function createIncreaseRule() {
    const repeat = random.randInt(1, 4);
    const stitchType = selectStitchType();
    const produce: RuleStitch[] = [];
    for(let i=0; i<repeat; i++) {
        const stitch: RuleStitch = {
            topology: "simple",
            type: stitchType,
            into: [0],
            parameters: {}
        };
        produce.push(stitch);
    }
    const weight = random.randInt(1, 5);
    const rule = new Rule(`increase-${stitchType}`, "insert", [0], produce, weight);
    return rule;
}

function createDecreaseRule(maxLimit: number = 4) {
    const size = random.randInt(2, Math.min(maxLimit, 4));
    const stitchType = selectStitchType();
    const consume: number[] = [];
    const into: number[] = [];

    for(let i=0; i<size; i++) {
        consume.push(i);
        into.push(consume.length-1);
    }

    const stitch: RuleStitch = {
        topology: "decrease",
        type: stitchType,
        into: into,
        parameters: {}
    }
    const weight = random.randInt(1, 5);
    const rule = new Rule(`decrease-${stitchType}-${size}`, "insert", consume, [stitch], weight);
    return rule;
}

function createHoleRule(maxLimit: number = 4) {
    const consume = [0, random.randInt(0, Math.min(maxLimit, 4))];
    const stitchType = selectStitchType();
    const size = random.randInt(0, 5);
    const left: RuleStitch = {
        topology: "simple",
        type: stitchType,
        into: [0],
        parameters: {}
    };
    const right: RuleStitch = {
        topology: "simple",
        type: stitchType,
        into: [1],
        parameters: {}
    };
    const chain: RuleStitch = {
        topology: "chain",
        type: "ch",
        into: [],
        parameters: {
            size: size
        }
    };
    const produce = [left, chain, right];
    const weight = random.randInt(1, 5);

    const rule = new Rule(`hole-${stitchType}-${size}`, "insert", consume, produce, weight);
    return rule;
}

export function createRuleset(numRules: number, row: number) {
    const ruleset: Rule[] = [];
    const minNumFlatRules = 1;
    const minNumStartRules = 1;
    for(let i=0; i<minNumFlatRules; i++) {
        ruleset.push(createFlatRule());
    }
    for(let i=0; i<minNumStartRules; i++) {
        ruleset.push(createRingRule());
    }

    const weigthtedRules = [
        { createRule: createFlatRule, weight: 3},
        { createRule: createIncreaseRule, weight: 2},
        { createRule: () => createDecreaseRule(row), weight: 1},
        { createRule: () => createHoleRule(row), weight: 1}
    ]

    for(let i=0; i<numRules-minNumFlatRules-minNumStartRules; i++) {
        const idx = random.selectWeightedRandom(weigthtedRules);
        if(idx !== undefined)
            ruleset.push(weigthtedRules[idx].createRule());
    }
    return ruleset;
}

//console.log("flat rule", createIncreaseRule());