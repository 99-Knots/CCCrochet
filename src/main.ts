import './style.css'
import * as CG from './CrochetGraph.ts'
import { processPatternToGraph } from './processPattern.ts'
import { GraphRenderer } from './rendering/render.ts';


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
    //const json = await processPatternToGraph(pattern.serialize());
    
    const renderer = new GraphRenderer(canvas);
    //renderer.renderYarnColor = color;

    renderer.renderGraph({nodes: pattern.force2D(), edges: pattern.edges});
    return renderer;
}

const pattern = document.getElementById("pattern")!;

let numSamples = 1;
let numRows = 4;

let teststring = "ring.A0\nsc.AA010@A0, sc@A0, sc.AA012@A0, sc@A0, sc@A0, sc.AA015@A0\nsc@AA010, sc2tog.AAA01120, sc.AAA01220@AA012, 2ch.AAA01221@AA012, sc@AA012, sc2tog.AAA01320, sc2tog, sc.AAA01520@AA015\nsc2tog.AAAA0102030, sc2tog.AAAA0112030@AAA01120, sc@AAA01220, 2ch@AAA01220, sc.AAAA0122032@AAA01220, sc.AAAA0122130@AAA01221, sc@AAA01221, sc2tog, sc.AAAA0132030@AAA01320, 2ch.AAAA0132031@AAA01320, sc.AAAA0132032@AAA01320, sc, sc.AAAA0152030@AAA01520, sc.AAAA0152031@AAA01520\nsc@AAAA0102030, sc.AAAAA010203041@AAAA0102030, sc.AAAAA011203040@AAAA0112030, sc@AAAA0112030, sc.AAAAA012203040, sc, sc.AAAAA012203240@AAAA0122032, sc.AAAAA012203241@AAAA0122032, sc.AAAAA012213040@AAAA0122130, sc.AAAAA012213041@AAAA0122130, sc, sc2tog, sc2tog.AAAAA013203040@AAAA0132030, sc.AAAAA013203140@AAAA0132031, sc.AAAAA013203240@AAAA0132032, sc@AAAA0132032, sc2tog.AAAAA014203040, sc@AAAA0152030, sc@AAAA0152030, sc.AAAAA015203140@AAAA0152031, sc@AAAA0152031\nsc, sc@AAAAA010203041, 2ch@AAAAA010203041, sc@AAAAA010203041, sc@AAAAA011203040, sc@AAAAA011203040, sc2tog, sc@AAAAA012203040, 2ch@AAAAA012203040, sc@AAAAA012203040, sc2tog, sc@AAAAA012203240, sc@AAAAA012203240, sc@AAAAA012203241, sc@AAAAA012203241, sc@AAAAA012213040, sc@AAAAA012213040, sc@AAAAA012213041, sc@AAAAA012213041, sc2tog, sc, sc@AAAAA013203040, sc@AAAAA013203040, sc@AAAAA013203140, sc@AAAAA013203140, sc@AAAAA013203240, sc@AAAAA013203240, sc, sc@AAAAA014203040, sc2tog, sc2tog, sc@AAAAA015203140, sc@AAAAA015203140, sc"
const canvas = document.getElementById("canvas")!;
const patternList: CG.Pattern[] = [];
const rendererList: GraphRenderer[] = []
for (let i = 0; i < numSamples; i++) {
    const pat = generatePattern(numRows);
    const rend = await renderPattern(pat, canvas, "white");
    patternList.push(pat);
    rendererList.push(rend);
}

document.getElementById("color-pick")!.oninput = (e) => {
    for (const rend of rendererList) {
        rend.renderYarnColor = e.target.value;
    }
}

