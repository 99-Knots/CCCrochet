import './style.css'
import * as CG from './CrochetGraph.ts'
import { GraphRenderer } from './rendering/render3D.ts';
import { drawToSVG } from './rendering/renderPattern.ts';


function generatePattern(numRows: number) {
    const pat = new CG.Pattern();
    //let h = pat.startChain(5);

    let l = pat.addRow([pat.firstStitchID]);
    for (let j = 0; j < numRows; j++)
        l = pat.addRow(l);
    //pattern.innerText = pat.serialize();
    return pat;
}

async function renderPattern(pattern: CG.Pattern, canvas: HTMLElement, color: string|null = null) {
    const renderer = new GraphRenderer(canvas);
    //renderer.renderYarnColor = color;

    renderer.renderGraph({nodes: pattern.force3D(), edges: pattern.edges});
    const svg = document.getElementById("vis-pattern")!;
    drawToSVG(svg, pattern.force2D(), pattern.edges);
    return renderer;
}

const pattern = document.getElementById("pattern")!;

let numSamples = 1;
let numRows = 6;

const canvas = document.getElementById("canvas")!;
const patternList: CG.Pattern[] = [];
const rendererList: GraphRenderer[] = []
for (let i = 0; i < numSamples; i++) {
    const pat = generatePattern(numRows);
    const rend = await renderPattern(pat, canvas, "white");
    patternList.push(pat);
    rendererList.push(rend);
}

