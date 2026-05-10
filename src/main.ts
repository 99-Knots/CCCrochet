import './style.css'
import * as CG from './CrochetGraph.ts'
import { GraphRenderer } from './rendering/render3D.ts';
import { drawToSVG } from './rendering/renderPattern.ts';
import { Vertex } from './Stitches.ts';


function generatePattern(numRows: number) {
    const pat = new CG.Pattern();
    //let h = pat.startChain(5);

    return pat.generate(numRows);
}

function createRenderer(canvas: HTMLElement) {
    const renderer = new GraphRenderer(canvas);
    return renderer;
}

async function renderPattern(pattern: CG.Pattern, renderer: GraphRenderer, color: string|null = null) {
    const elem = document.createElement("div");
    elem.classList.add("scene");
    canvas.appendChild(elem);
    const scene = renderer.addScene(elem);
    if(color)
        scene.renderYarnColor = color;
    scene.modelGraph({nodes: pattern.force3D(), edges: pattern.edges});
    const svg = document.querySelector("#vis-pattern") as SVGSVGElement;
    drawToSVG(svg, pattern.force2D(), pattern.edges);
    return scene;
}

//const pattern = document.getElementById("pattern")!;

let numSamples = 1;
let numRows = 4;

const canvas = document.getElementById("canvas")!;
const patternList: CG.Pattern[] = [];

const renderer = createRenderer(canvas);
for (let i = 0; i < numSamples; i++) {
    const pat = generatePattern(numRows);
    const rend = await renderPattern(pat, renderer);
    patternList.push(pat);
    //rendererList.push(rend);
}

