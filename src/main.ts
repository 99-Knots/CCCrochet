import './style.css'
import * as CG from './CrochetGraph.ts'
import { processText } from './rendering/parse64.js';
import { loadGraphModule } from './rendering/graph.ts';
import { GraphRenderer } from './rendering/render.ts';



type Vec3 = [number, number, number];

interface Node {
    type: "node";
    name: string;
    pos: Vec3
}

interface Edge {
    type: "edge",
    head: string,
    tail: string,
    len: string,
    color: string
}

export async function performLayout(dot: string) {
    const Module = await loadGraphModule();

    let result: string = Module.ccall(
        "performLayout",
        "string",
        ["string"],
        [dot]
    );
    const parsed = JSON.parse(`[${result.replace(/,\s*$/, "")}]`)
    for (const p of parsed) {
        p.pos = p.pos.split(",").map(Number);
    }

    return parsed;
}


function transformJsonWithPos(
    inputJson: { dimen: number, elements: (Node | Edge)[] },
    inputJson2: { name: string, pos: Vec3 }[]) {
    const nodes = inputJson.elements.filter(element => element.type === 'node').map((node, index) => {
        const posInfo = inputJson2.find(item => item.name === node.name);
        return {
            _gvid: index,
            name: node.name,
            pos: posInfo ? posInfo.pos : [0, 0, 0] as Vec3,
        };
    });

    const edges = inputJson.elements.filter(element => element.type === 'edge').map((edge, index) => ({
        tail: edge.tail,
        head: edge.head,
        color: edge.color,
        len: edge.len
    }));

    const transformedJson = {
        nodes: nodes,
        edges: edges
    };

    return transformedJson;
}


const pattern = document.getElementById("pattern")!;

let numSamples = 1;
let numRows = 4;
for (let i = 0; i < numSamples; i++) {
    const pat = new CG.Pattern();
    //let h = pat.startChain(5);

    let l = pat.addRow([pat.firstStitchID]);
    for (let j = 0; j < numRows; j++)
        l = pat.addRow(l);
    pattern.innerText = pat.serialize();


    var json0 = "";
    var dot_simple = "";
    [json0, dot_simple] = processText(pat.serialize(), json0);
    var json1 = await performLayout(dot_simple);
    var json2 = transformJsonWithPos(JSON.parse(json0), json1);

    const canvas = document.getElementById("canvas")!;
    const renderer = new GraphRenderer(canvas);

    renderer.renderGraph(json2);
}
