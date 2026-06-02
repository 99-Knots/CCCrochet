import './style.css'
import chartIcon from './assets/fpdc.svg?raw';
import * as CG from './CrochetGraph.ts'
import { GraphRenderer } from './rendering/render3D.ts';
import { drawToSVG, svgNamespace } from './rendering/renderPattern.ts';
import * as random from './random.ts';
import { Rule, createRuleset, breedRulesets, type RowRules, type PatternRules } from './ruleProcessing.ts'


function generatePattern(rowRulesets: Rule[][]) {
    const pat = new CG.Pattern();
    //let h = pat.startChain(5);

    return pat.generate(rowRulesets);
}

// async function generateSamples(numSamples: number) {
//     // clear old samples
//     const renderCanv = canvas.getElementsByTagName("canvas")[0];
//     canvas.replaceChildren(renderCanv);

//     patternList = [];
//     for (let i = 0; i < numSamples; i++) {
//         const pat = generatePattern(numRows);
//         const rend = await renderPattern(pat, renderer, i, "#7A5292");
//         patternList.push({pattern: pat, selected: false});
//         console.log(`Sample: ${i} rules: ${pat.rowRulesets}`);
//     }
// }

function createMatingPool(rulesets: PatternRules[], fitnesses: number[]) {
    const matingPool: {ruleset: PatternRules, weight: number}[] = [];
    if (rulesets.length !== fitnesses.length)
        return []
    
    for(let i=0; i<rulesets.length; i++) {
        matingPool.push({ruleset: rulesets[i], weight: fitnesses[i]*100});
    }
    return matingPool;
}

async function geneticGeneration(gen: number = 0) {
    // clear old samples
    const renderCanv = canvas.getElementsByTagName("canvas")[0];
    canvas.replaceChildren(renderCanv);
    const oldPatternList = patternList;
    patternList = [];

    if(gen === 0) {
        for(let k=0; k<numSamples; k++) {
            // create new per row ruleset
            const rowRuleset: RowRules[] = [];
            rowRuleset.push(createRuleset(1, 0));
            for(let i=0; i<numRows-1; i++) {
                rowRuleset.push(createRuleset(10, i));
            }

            // generate pattern from ruleset
            const pat = generatePattern(rowRuleset);
            const rend = await renderPattern(pat, renderer, k, "#7A5292");
            patternList.push({pattern: pat, selected: false});
        }
    }
    else {
        const children: PatternRules[] = [];
        for(let k=0; k<numSamples; k++) {
            const parents = oldPatternList.map( p => p.pattern.rowRulesets );
            const fitness = oldPatternList.map( p => p.selected ? 0.9 : 0.1);
            const matingPool = createMatingPool(parents, fitness);
            children.push(breedRulesets(matingPool, numRows));
        }
        for (let i=0; i<children.length; i++) {
            const pat = generatePattern(children[i]);
            const rend = await renderPattern(pat, renderer, i, "#7A5292");
            patternList.push({pattern: pat, selected: false});
        }
    }
}

function createRenderer(canvas: HTMLElement) {
    const renderer = new GraphRenderer(canvas);
    return renderer;
}

function copySVG(svg: SVGSVGElement) {
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    navigator.clipboard.writeText(svgString)
    .catch(err => {
        console.error('Error copying text: ', err);
    });
}

function createSVG() {
    const svgElem = document.createElementNS(svgNamespace, "svg");
    svgElem.setAttribute("viewBox", "-50 -50 100 100");
    svgElem.setAttribute("fill", "none");
    //svgElem.setAttribute("stroke", "black");
    svgElem.setAttribute("stroke-width", "5");
    return svgElem;
}

async function renderPattern(pattern: CG.Pattern, renderer: GraphRenderer, index: number = 0, color: string|null = null) {
    const cardContainer = document.createElement("div");
    cardContainer.classList.add("card-border");

    const card = document.createElement("div");
    card.classList.add("pattern-card");
    cardContainer.appendChild(card);

    const sceneElem = document.createElement("div");
    sceneElem.classList.add("scene");
    card.appendChild(sceneElem);

    const chart = document.createElement("div");
    chart.classList.add("chart");
    chart.classList.add("hidden");

    const svgElem = createSVG();
    chart.appendChild(svgElem);
    card.appendChild(chart);


    const controlsElem = document.createElement("div");
    controlsElem.classList.add("card-controls");

    const toggleBtn = document.createElement("button");
    toggleBtn.innerHTML = `${chartIcon} Show Pattern`;
    toggleBtn.setAttribute("data-i18n", "toggleChart");
    toggleBtn.addEventListener("click", e => {
        chart.classList.toggle("hidden");
    });

    const copyBtn = document.createElement("button");
    copyBtn.setAttribute("data-i18n", "copy");

    const dlBtn = document.createElement("button");
    dlBtn.setAttribute("data-i18n", "download");

    //controlsElem.append(toggleBtn, copyBtn, dlBtn);
    controlsElem.appendChild(toggleBtn);
    card.appendChild(controlsElem);

    const selectBtn = document.createElement("button");
    selectBtn.classList.add("select-btn");
    selectBtn.addEventListener("click", e => {
        selectBtn.classList.toggle("selected");
        patternList[index].selected = selectBtn.classList.contains("selected");
        //console.log(patternList)
    });
    card.appendChild(selectBtn);

    canvas.appendChild(cardContainer);
    const scene = renderer.addScene(sceneElem);
    if(color)
        scene.renderYarnColor = color;
    scene.modelGraph({nodes: pattern.force3D(), edges: pattern.edges});
    drawToSVG(svgElem, pattern.force2D(), pattern.edges);

    return scene;
}

//const pattern = document.getElementById("pattern")!;

let numRows = 4;
let numSamples = 6;
let generation = 1;

const seedBtn = document.getElementById("seed-btn")?.addEventListener("click", (async e => {
    random.setSeed("hook");
    generation = 0;
    await geneticGeneration(generation);
}));


const genBtn = document.getElementById("gen-btn")?.addEventListener("click", (async e => {
    await geneticGeneration(generation);
    generation++;
}));
const canvas = document.getElementById("canvas")!;
let patternList: {pattern: CG.Pattern, selected: boolean}[] = [];

const renderer = createRenderer(canvas);
await geneticGeneration();


