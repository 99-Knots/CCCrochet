import restrictions from "./assets/metaRestrictions.json";
import { type Stitch } from "./Stitches"
import * as random from "./random"
import { min } from "three/tsl";

type RuleStitchMod = {type: "" | "l" | "p", position: "f" | "b"}
type RuleStitch = {
    topology: "simple" | "decrease" | "chain",
    type: Stitch,
    modifier?: RuleStitchMod,
    into: number[],
    parameters: {
        size?: number
    }
}

type RuleCategory = "ring" | "insert"

type ConsumeCandidate = { type: "consume", idx: number, min: number; max: number };
type StitchTypeCandidate = { type: "stitchType", idx: number };
type ModifierCandidate = { type: "modifier", idx: number };
type HoleSizeCandidate = { type: "holeSize", idx: number };
type WeightCandidate = { type: "weight" };

type MutationTarget = ConsumeCandidate
                    | StitchTypeCandidate
                    | ModifierCandidate
                    | HoleSizeCandidate
                    | WeightCandidate;

type Mutation = {
    getCandidates: (rule: Rule) => MutationTarget[],
    apply: (rule: Rule, candidate: MutationTarget) => void,
    weight: number
}

const mutations: Mutation[] = [
    {   // consume
        getCandidates: r => {
            const candidates = r.consume.flatMap( (c, i) => {
                const upperConsumeLimit = 5 //
                if(i === 0) return [];
                if(getNudge(c, r.consume[i-1], r.consume[i+1] ?? 5) == 0) return [];
                return [{ type: "consume", idx: i, min: r.consume[i-1], max: r.consume[i+1] ?? upperConsumeLimit} as ConsumeCandidate];
            });
            return candidates;
        },
        apply: (r, candidate) => {
            if(candidate.type == "consume") {
                r.consume[candidate.idx] += getNudge(r.consume[candidate.idx], candidate.min,  candidate.max);
            }
        },
        weight: 1
    },
    {   // stitch type
        getCandidates: r => {
            r.produce.flatMap((p, i) =>
            p.topology !== "chain"
                ? [{ type: "stitchType", idx: i } as StitchTypeCandidate]
                : []
        )
            return r.produce.flatMap( (p, i) => { 
                if(p.topology !== "chain") 
                    return [{type: "stitchType", idx: i} as StitchTypeCandidate]; 
                else 
                    return [];
            });
        },
        apply: (r, candidate) => {
            if(candidate.type == "stitchType"){
                const stitch = r.produce[candidate.idx];
                const options = restrictions["stitchTypes"].filter( s => s.value !== stitch.type);
                const selection = options[random.selectWeightedRandom(options)];
                stitch.type = selection.value as Stitch;
            }
        },
        weight: 3
    },
    {   // modifier
        getCandidates: r => {
            return r.produce.flatMap( (p, i) => { 
                if(p.topology !== "chain") 
                    return [{type: "modifier", idx: i} as ModifierCandidate]; 
                else 
                    return [];
            });
        },
        apply: (r, candidate) => {
            if(candidate.type == "modifier") {
                const stitch = r.produce[candidate.idx];
                // only consider different modifiers from current one
                const options = restrictions["modifiers"].filter( m => m.position !== stitch.modifier?.position || m.type !== stitch.modifier.type);
                const selection = options[random.selectWeightedRandom(options)] as RuleStitchMod;
                stitch.modifier = selection;
            }
        },
        weight: 1
    },
    {   // hole size
        getCandidates: r => {
            //return r.produce.filter( p => p.topology === "chain" && p.parameters.size !== undefined).map( (p, i) => ({type: "holeSize", idx: i } as HoleSizeCandidate));
            return r.produce.flatMap( (p, i) => { 
                if(p.topology !== "chain" && p.parameters.size !== undefined) 
                    return [{type: "holeSize", idx: i} as HoleSizeCandidate]; 
                else 
                    return [];
            });
        },
        apply: (r, candidate) => {
            if(candidate.type == "holeSize") {
                const stitch = r.produce[candidate.idx];
                stitch.parameters.size! += getNudge(stitch.parameters.size!, 0, 5)
            }
        },
        weight: 2
    },
    {
        getCandidates: r => {
            return [{type: "weight"} as WeightCandidate];
        },
        apply: (r, candidate) => {
            if(candidate.type == "weight")
                r.weight += getNudge(r.weight, 1, 5);
        },
        weight: 3
    }
]

function getNudge(value: number, min: number, max: number) {
    let change = 0;
    if( value > min && value < max)
        change = (random.random() >= 0.5 ? 1 : -1);
    else 
        if (value < max) 
            change = + 1;
        else 
            if (value > min) 
                change = - 1;
    return change;
}

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

    copy() {
        return new Rule(
            this.name,
            this.category,
            [...this.consume],
            this.produce.map(s => ({
                ...s,
                into: [...s.into],
                parameters: { ...s.parameters },
                ...(s.modifier ? { modifier: { ...s.modifier } } : {})
            })),
            this.weight
        );
    }

    mutate() {
        const mutantRule = this.copy();
        const mutationCandidates = mutations.flatMap( m => {
            const candidates = m.getCandidates(mutantRule);
            if(candidates.length > 0)
                return [{mutation: m, candidates: candidates, weight: m.weight}]
            else
                return [];
        } );

        if (mutationCandidates.length === 0) return mutantRule;
        // select the kind of mutation
        const selectedMutation = mutationCandidates[random.selectWeightedRandom(mutationCandidates)];
        // select where to apply it
        const candidate = selectedMutation.candidates[random.randInt(0, selectedMutation.candidates.length-1)];
        selectedMutation.mutation.apply(mutantRule, candidate)
        console.log(candidate.type)
        return mutantRule;
    }

    crossbreed(other: Rule) {
        // 
    }
}

function selectStitchType(): Stitch {
    const options = restrictions["stitchTypes"];
    const idx = random.selectWeightedRandom(options);
    return options[idx].value as Stitch;
}

function selectStitchModifier(): RuleStitchMod {
    const options = restrictions["modifiers"];
    const idx = random.selectWeightedRandom(options);
    return options[idx] as RuleStitchMod;
}

function createRingRule() {
    const options = [
        { type: "sc", weight: 1 },
        { type: "hdc", weight: 1 },
        { type: "dc", weight: 1}
    ]
    const idx = random.selectWeightedRandom(options);
    const produce: RuleStitch[] = [];
    switch(options[idx].type) {
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
        modifier: selectStitchModifier(),
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
    const modifier = selectStitchModifier();
    const produce: RuleStitch[] = [];
    for(let i=0; i<repeat; i++) {
        const stitch: RuleStitch = {
            topology: "simple",
            type: stitchType,
            modifier: modifier,
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
    const modifier = selectStitchModifier();
    const consume: number[] = [];
    const into: number[] = [];

    for(let i=0; i<size; i++) {
        consume.push(i);
        into.push(consume.length-1);
    }

    const stitch: RuleStitch = {
        topology: "decrease",
        type: stitchType,
        modifier: modifier,
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
    const modifier = selectStitchModifier();
    const size = random.randInt(0, 5);
    const left: RuleStitch = {
        topology: "simple",
        type: stitchType,
        modifier: modifier,
        into: [0],
        parameters: {}
    };
    const right: RuleStitch = {
        topology: "simple",
        type: stitchType,
        modifier: modifier,
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
        const rule = createFlatRule()
        ruleset.push(rule);
        console.log("mutation", rule, rule.mutate());
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
        ruleset.push(weigthtedRules[idx].createRule());
    }
    return ruleset;
}

//console.log("flat rule", createIncreaseRule());