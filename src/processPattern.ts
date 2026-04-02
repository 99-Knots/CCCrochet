import { processText } from './rendering/parse64.js';
import { loadGraphModule } from './rendering/graph.ts';
import { GraphRenderer } from './rendering/render.ts';



type Vec3 = [number, number, number];

interface Node {
    type: "node",
    name: string,
    pos: Vec3
}

interface Edge {
    type: "edge",
    head: string,
    tail: string,
    len: string,
    color: string,
    penwidth: number
}

async function performLayout(dot: string) {
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

    const nodesMap: {[key: string]: number} = {};

    const nodes = inputJson.elements.filter(element => element.type === 'node').map((node, index) => {
        const posInfo = inputJson2.find(item => item.name === node.name);
        nodesMap[node.name] = index;
        return {
            _gvid: index,
            name: node.name,
            pos: posInfo ? posInfo.pos : [0, 0, 0] as Vec3,
        };
    });
    
    const edges = inputJson.elements.filter(element => element.type === 'edge').map((edge, index) => {
        return {
            tail: nodesMap[edge.tail],
            head: nodesMap[edge.head],
            color: edge.color,
            width: edge.penwidth,
            len: edge.len
        }
    });

    return {nodes: nodes, edges: edges};
}

export async function processPatternToGraph(patternString: string, container: HTMLElement) {
    var json0 = "";
    var dot_simple = "";
    [json0, dot_simple] = processText(patternString, json0);
    var json1 = await performLayout(dot_simple);
    const parsed = JSON.parse(json0, (key, value) => key=="penwidth" ? Number(value): value);
    var json2 = transformJsonWithPos(parsed, json1);

    const renderer = new GraphRenderer(container);
    renderer.renderYarnColor = "white";

    renderer.renderGraph(json2);
}