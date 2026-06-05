import './style.css'
import chartIcon from './assets/fpdc.svg?raw';
import dnldIcon from './assets/dnld.svg?raw';
import * as CG from './CrochetGraph.ts'
import { GraphRenderer } from './rendering/render3D.ts';
import { drawToSVG, svgNamespace } from './rendering/renderPattern.ts';
import * as random from './random.ts';
import { Rule, createRuleset, breedRulesets, type RowRules, type PatternRules } from './ruleProcessing.ts'


const overlay = document.getElementById("overlay");
const canvas = document.getElementById("canvas")!;
const contBtn = document.getElementById("cont-btn") as HTMLButtonElement;

const renderer = createRenderer(canvas);
const coralPalettes = ["#ea7070", "#7ae7c7", "#4dbedf", "#e59572", "#fbe050", "#8a75c6"];

let numRows = 5;
let numSamples = 6;
let generation = 0;

let patternList: {pattern: CG.Pattern, selected: boolean}[] = [];
let shownTutorial = false;


function showOverlay() {
    overlay?.classList.remove("hidden");
    document.body.classList.add("no-scroll");
}

function hideOverlay() {
    overlay?.classList.add("hidden");
    document.body.classList.remove("no-scroll");
    shownTutorial = true;
    if(overlay)
        overlay!.innerHTML = "Generating...";
}

function setupTutorial() {
    const wrap = document.getElementById("overlay");
    if (!wrap) return;
    const wrapRect = wrap.getBoundingClientRect();

    const tutLbls = document.getElementsByClassName("tut-text");
    for(const tut of tutLbls) {
        const elem = (tut as HTMLElement)
        const target = elem.dataset.target;
        const targetElem = document.getElementById(target??"");
        if (!targetElem) 
            return;
        const targetRect = targetElem.getBoundingClientRect();
        const selfRect = elem.getBoundingClientRect();
        let offsetX = 0;
        let offsetY = 0;
        if(elem.classList.contains("left-top")) {
            offsetX = -wrapRect.left + targetRect.left - selfRect.width/4;
            offsetY = wrapRect.bottom - targetRect.top;
            
            elem.style.setProperty("--left", `calc(${offsetX}px - 1em)`);
            elem.style.setProperty("--top", `calc(${offsetY}px + 1.8em)`);
        }
        if(elem.classList.contains("right-top")) {
            offsetX = -wrapRect.left + targetRect.left -selfRect.width*0.75 + targetRect.width;
            offsetY = wrapRect.bottom - targetRect.top;
            
            elem.style.setProperty("--left", `calc(${offsetX}px + 1.5em)`);
            elem.style.setProperty("--top", `calc(${offsetY}px + 0.4em)`);
        }
        if(elem.classList.contains("right-bot")) {
            offsetX = -wrapRect.left + targetRect.left - selfRect.width/2;
            offsetY = -wrapRect.top + targetRect.top + targetRect.height;
            
            elem.style.setProperty("--left", `calc(${offsetX}px + 3em)`);
            elem.style.setProperty("--top", `calc(${offsetY}px + 1.1em)`);
        }
    }
}

async function doGeneration() {
    contBtn.disabled = true;
    showOverlay();

    // wait for a moment to let browser catch up
    await new Promise(resolve => setTimeout(resolve, 0));

    await geneticGeneration(generation)
        .then( () => {
            if(shownTutorial) 
                hideOverlay(); 
            else 
                contBtn.disabled = false;
            contBtn.innerText="Let's go!"
        });
    window.scrollTo(0, 0);
    generation++;
}

function generatePattern(rowRulesets: Rule[][]) {
    const pat = new CG.Pattern();
    //let h = pat.startChain(5);

    return pat.generate(rowRulesets);
}

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
            const color = coralPalettes[k % coralPalettes.length];
            const rend = await renderPattern(pat, renderer, k, color);
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
            // Choose a color based on the card's index so they cycle beautifully
            const color = coralPalettes[i % coralPalettes.length];
            const rend = await renderPattern(pat, renderer, i, color);
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

function downloadSVG(svg: SVGSVGElement) {
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);

    const blob = new Blob([svgString], {type: "text/plain"});
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Coral-Pattern.svg";
    link.click();
    URL.revokeObjectURL(link.href);
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
    cardContainer.style.setProperty("--coral-color", color);
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
    toggleBtn.innerHTML = `${chartIcon}`;
    toggleBtn.setAttribute("data-i18n", "toggleChart");
    toggleBtn.addEventListener("click", () => {
        chart.classList.toggle("hidden");
    });

    // const copyBtn = document.createElement("button");
    // copyBtn.setAttribute("data-i18n", "copy");

    const dlBtn = document.createElement("button");
    dlBtn.innerHTML = `${dnldIcon}`;
    dlBtn.addEventListener("click", () => {
        downloadSVG(svgElem);
    });
    dlBtn.setAttribute("data-i18n", "download");


    const selectBtn = document.createElement("button");
    selectBtn.classList.add("select-btn");
    selectBtn.addEventListener("click", () => {
        selectBtn.classList.toggle("selected");
        patternList[index].selected = selectBtn.classList.contains("selected");
        selectBtn.innerText ="✓";
        //console.log(patternList)
    });

    const spacer = document.createElement("div");
    spacer.classList.add("spacer");

    controlsElem.appendChild(toggleBtn);
    controlsElem.appendChild(dlBtn);
    controlsElem.appendChild(spacer);
    controlsElem.appendChild(selectBtn);
    card.appendChild(controlsElem);

    canvas.appendChild(cardContainer);
    const scene = renderer.addScene(sceneElem);
    if(color)
        scene.renderYarnColor = color;
    scene.modelGraph({nodes: pattern.force3D(), edges: pattern.edges});
    drawToSVG(svgElem, pattern.force2D(), pattern.edges);

    return scene;
}

window.addEventListener("resize", () => {
    setupTutorial();
})

document.getElementById("seed-btn")?.addEventListener("click", (async () => {
    random.setSeed("hook");
    generation = 0;
    await doGeneration();
}));


document.getElementById("gen-btn")?.addEventListener("click", (async () => {
    await doGeneration();
}));

contBtn?.addEventListener("click", hideOverlay);

window.addEventListener("load", async () => {  
    console.log("loading")
    setupTutorial();
    console.log("start gen")
    await doGeneration().then(
        () => console.log("generated")
    );
});
