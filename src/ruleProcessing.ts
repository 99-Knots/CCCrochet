import restrictions from "./assets/metaRestrictions.json";
import { type Stitch, Modifier } from "./Stitches"
import * as random from "./random"


const upperConsumeLimit = restrictions.limits.consume;
const upperHoleSizeLimit = restrictions.limits.holeSize;
const upperWeightLimit = restrictions.limits.weight;
const upperIncreaseLimit = restrictions.limits.increase;
const upperDecreaseLimit = restrictions.limits.decrease;
const upperStitchSkipLimit = restrictions.limits.stitchSkip;

// TODO
const limitMutations = true;


type RuleStitchMod = {type: "" | "l" | "p", position: "f" | "b"}
type RuleStitch = {
    topology: "simple" | "decrease" | "chain",
    type: Stitch,
    modifier?: Modifier,
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

type CrossConsumeCandidate = { type: "consume" };
type CrossStitchTypeCandidate = { type: "stitchType", idx: number, options: Set<Stitch> };
type CrossModifierCandidate = { type: "modifier", idx: number, options: Set<Modifier> };
type CrossHoleSizeCandidate = { type: "holeSize", idx1: number, idx2: number[] };
type CrossWeightCandidate = { type: "weight" };

type CrossbreedTarget = CrossConsumeCandidate 
                      | CrossStitchTypeCandidate
                      | CrossModifierCandidate
                      | CrossHoleSizeCandidate
                      | CrossWeightCandidate;

type Crossbreed = {
    getCandidates: (rule1: Rule, rule2: Rule) => CrossbreedTarget[],
    apply: (rule1: Rule, rule2: Rule, candidate: CrossbreedTarget) => void,
    weight: number
};






function getAllReplacableStitches(rule: Rule) {
    return rule.produce.flatMap( (p, i) => {
        if(p.topology !== "chain")
            return [i];
        else
            return [];
    });
}

function getAllExpandableChains(rule: Rule) {
    return rule.produce.flatMap( (p, i) => {
        if(p.topology === "chain" && p.parameters.size !== undefined)
            return [i];
        else
            return [];
    });
}

function getNudge(value: number, min: number, max?: number) {
    let change = 0;
    if(max !== undefined) {
        if( value > min && value < max)
            change = (random.random() >= 0.5 ? 1 : -1);
        else 
            if (value < max) 
                change = + 1;
            else 
                if (value > min) 
                    change = - 1;
    }
    else {
        if (value > min)
            change = (random.random() >= 0.5 ? 1 : -1);
        else change = + 1;
    }
    return change;
}







const mutations: Mutation[] = [
    {   // consume
        getCandidates: r => {
            const candidates = r.consume.flatMap( (c, i) => {
                if(i === 0) return [];
                if(getNudge(c, r.consume[i-1], r.consume[i+1] ?? upperConsumeLimit) == 0) return [];
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
            const replaceableIdcs = getAllReplacableStitches(r);
            return replaceableIdcs.flatMap( i => {
                return [{type: "stitchType", idx: i} as StitchTypeCandidate];
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
            const replaceableIdcs = getAllReplacableStitches(r);
            return replaceableIdcs.flatMap( i => {
                return [{type: "modifier", idx: i} as ModifierCandidate];
            });
        },
        apply: (r, candidate) => {
            if(candidate.type == "modifier") {
                const stitch = r.produce[candidate.idx];
                // only consider different modifiers from current one
                const options = restrictions["modifiers"].filter( m => {
                    const param = stitch.modifier?.getParam();
                    return (m.position !== param?.position || m.type !== param?.type);
                });
                const selection = options[random.selectWeightedRandom(options)] as RuleStitchMod;
                stitch.modifier = Modifier.fromParam(selection.type, selection.position);
            }
        },
        weight: 1
    },
    {   // hole size
        getCandidates: r => {
            const expandable = getAllExpandableChains(r);
            return expandable.flatMap( i => {
                return [{type: "holeSize", idx: i} as HoleSizeCandidate];
            });
        },
        apply: (r, candidate) => {
            if(candidate.type == "holeSize") {
                const stitch = r.produce[candidate.idx];
                stitch.parameters.size! += getNudge(stitch.parameters.size!, 0, upperHoleSizeLimit)
            }
        },
        weight: 2
    },
    {   // weight
        getCandidates: (r) => {
            return [{type: "weight"} as WeightCandidate];
        },
        apply: (r, candidate) => {
            if(candidate.type == "weight")
                r.weight += getNudge(r.weight, 1, upperWeightLimit);
        },
        weight: 3
    }
]

const crosses: Crossbreed[] = [
    {   // consume
        getCandidates: (r1: Rule, r2:Rule) => {
            if(r1.category === r2.category && r1.consume.length === r2.category.length)
                return [{ type: "consume" } as CrossConsumeCandidate];
            else 
                return [];
        },
        apply: (r1, r2, candidate) => {
            if(candidate.type === "consume")
                r1.consume = r2.consume;
        },
        weight: 2
    },
    {   // stitch type
        getCandidates: (r1: Rule, r2: Rule) => {
            const replaceable1 = getAllReplacableStitches(r1);
            const replaceable2 = getAllReplacableStitches(r2);

            return replaceable1.flatMap( i => {
                const options = new Set<Stitch>;
                replaceable2.forEach( j => {  options.add(r2.produce[j].type) });
                options.delete(r1.produce[i].type);
                if(options.size > 0)
                    return [{type: "stitchType", idx: i, options: options} as CrossStitchTypeCandidate];
                else return [];
            });
        },
        apply: (r1, r2, candidate) => {
            if(candidate.type == "stitchType"){
                const stitch = r1.produce[candidate.idx];
                const options = Array.from(candidate.options);
                const selection = options[random.randInt(0, options.length)];
                stitch.type = selection as Stitch;
            }
        },
        weight: 3
    },
    {   // modifiers
        getCandidates: (r1: Rule, r2: Rule) => {
            const replaceable1 = getAllReplacableStitches(r1);
            const replaceable2 = getAllReplacableStitches(r2);

            return replaceable1.flatMap( i => {
                const options = new Set<Modifier>;
                replaceable2.forEach( j => {  
                    if(r2.produce[j].modifier) 
                        options.add(r2.produce[j].modifier);
                    else
                        options.add(Modifier.NO); 
                    });
                    
                if(r1.produce[i].modifier)
                    options.delete(r1.produce[i].modifier);
                else
                    options.delete(Modifier.NO); 
                if(options.size > 0)
                    return [{type: "modifier", idx: i, options: options} as CrossModifierCandidate];
                else return [];
            })
        },
        apply: (r1, r2, candidate) => {
            if(candidate.type == "modifier"){
                const stitch = r1.produce[candidate.idx];
                const options = Array.from(candidate.options);
                const selection = options[random.randInt(0, options.length)];
                stitch.modifier = selection;
            }
        },
        weight: 2
    },
    {   // hole size
        getCandidates: (r1, r2) => {
            const expandable1 = getAllExpandableChains(r1);
            const expandable2 = getAllExpandableChains(r2);
            
            return expandable1.flatMap( i => {
                const options: number[] = [];
                expandable2.forEach( j => {
                    if(r2.produce[j].parameters.size !== r1.produce[i].parameters.size)
                        options.push(j);
                });
                if(options.length > 0)
                    return [{type: "holeSize", idx1: i, idx2: options}];
                else
                    return [];
            });
        },
        apply: (r1, r2, candidate) => {
            if(candidate.type == "holeSize") {
                const stitch = r1.produce[candidate.idx1];
                const selection = candidate.idx2[random.randInt(0, candidate.idx2.length)];
                stitch.parameters.size! = r2.produce[selection].parameters.size!;
            }
        },
        weight: 2
    },
    {   // weight
        getCandidates: (r1, r2) => {
            return [{type: "weight"} as WeightCandidate];
        },
        apply: (r1, r2, candidate) => {
            if(candidate.type == "weight")
                r1.weight = r2.weight;
        },
        weight: 1
    }
]


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
                //...(s.modifier ? { modifier: { ...s.modifier } } : {})
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
        //console.log(candidate.type)
        return mutantRule;
    }

    crossbreed(other: Rule) {
        // 
        const crossRule = this.copy();
        const crossCandidates = crosses.flatMap( c => {
            const candidates = c.getCandidates(crossRule, other);
            if (candidates.length > 0)
                return [{cross: c, candidates: candidates, weight: c.weight}]
            else 
                return [];
        });

        if (crossCandidates.length === 0)
            return crossRule;
        const selectedCross = crossCandidates[random.selectWeightedRandom(crossCandidates)];
        const candidate = selectedCross.candidates[random.randInt(0, selectedCross.candidates.length-1)];
        selectedCross.cross.apply(crossRule, other, candidate);
        //console.log(candidate.type, candidate);
        return crossRule;
    }
}

function selectStitchType(): Stitch {
    const options = restrictions["stitchTypes"];
    const idx = random.selectWeightedRandom(options);
    return options[idx].value as Stitch;
}

function selectStitchModifier(): Modifier {
    const options = restrictions["modifiers"];
    const idx = random.selectWeightedRandom(options);
    const mod = Modifier.fromParam(options[idx].type, options[idx].position)
    return mod;
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

    const weight = random.randInt(1, upperWeightLimit);

    const rule = new Rule("flat", "insert", [0], [stitch], weight)
    return rule;
}

function createIncreaseRule() {
    const repeat = random.randInt(2, upperIncreaseLimit);
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
    const weight = random.randInt(1, upperWeightLimit);
    const rule = new Rule(`increase-${stitchType}`, "insert", [0], produce, weight);
    return rule;
}

function createDecreaseRule(maxLimit: number = upperDecreaseLimit) {
    const size = random.randInt(2, Math.min(maxLimit, upperDecreaseLimit));
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
    const weight = random.randInt(1, upperWeightLimit);
    const rule = new Rule(`decrease-${stitchType}-${size}`, "insert", consume, [stitch], weight);
    return rule;
}

function createHoleRule(maxLimit: number = upperStitchSkipLimit) {
    const consume = [0, random.randInt(0, Math.min(maxLimit, upperStitchSkipLimit))];
    const stitchType = selectStitchType();
    const modifier = selectStitchModifier();
    const size = random.randInt(0, upperHoleSizeLimit);
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
    const weight = random.randInt(1, upperWeightLimit);

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
        //console.log("mutation", rule, rule.mutate());
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