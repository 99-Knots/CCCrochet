import stitchSymbols from "../assets/stitchSymbols.json"
import { Edge, Vertex } from "../Stitches";
import { select } from 'd3-selection';
import { zoom } from 'd3-zoom';


const svgNamespace = "http://www.w3.org/2000/svg";

export function setupZoom(svgElement: SVGSVGElement, contentGroup: SVGGElement) {
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 10])
        .on('zoom', (event) => {
            contentGroup.setAttribute('transform', event.transform.toString());
        });
    select(svgElement).call(zoomBehavior);
}

function drawSymbol(vertex: Vertex,
    connection: {parent: Vertex, edge: Edge}
) {
    const path = document.createElementNS(svgNamespace, "path");
    const symbol = connection.edge.type == "slst" ? stitchSymbols.ss : vertex.type.symbol;
    if(symbol) {
        path.setAttribute("d", symbol.symbol + connection.edge.mod.symbol.symbol);
        const dx = (connection.parent.x  ?? 0) - (vertex.x ?? 0);
        const dy = (connection.parent.y ?? 0) - (vertex.y ?? 0);
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI) - 90;
        console.log(vertex.type)
        path.setAttribute("fill", symbol.fill ? "#000" : "none");
        
        const scale = distance / 100;

        const transform = `translate(${(vertex.x ?? 0)}, ${vertex.y ?? 0}) rotate(${angle}) scale(0.05, ${scale}) translate(-50, -5)`;
        path.setAttribute("transform", transform);
        return {path: path, scale: scale, angle: angle }
    }
}


export function drawToSVG(svg: SVGSVGElement, vertices: Vertex[], edges: Edge[]) {
    // TODO: does this actually save time?
    const prevMap = new Map<Vertex, Vertex>();
    const prevMapInv = new Map<Vertex, Vertex>();
    edges.filter( e => e.type === "prev").forEach( e => { prevMap.set(e.source, e.target); prevMapInv.set(e.target, e.source); });

    const parentMap = new Map<Vertex, {parent: Vertex, edge: Edge}[]>();  // all stitches a given stitch has been inserted into
    edges.filter( e => (e.type === "insert" || e.type === "simInsert") && e.doRender).forEach( e => { 
        const oldMap = parentMap.get(e.source); 
        if (oldMap)
            oldMap.push({parent: e.target, edge: e});
        else
            parentMap.set(e.source, [{parent: e.target, edge: e}]);
    });

    const g = document.createElementNS(svgNamespace, "g");
    g.classList.add("viewport");

    const stitches = document.createElementNS(svgNamespace, "g");
    stitches.classList.add("stitches")
    const layerLines = document.createElementNS(svgNamespace, "g");
    layerLines.classList.add("layer-lines");
    
    g.appendChild(stitches);
    g.appendChild(layerLines);

    svg.appendChild(g);

    vertices.forEach( v => {            
        const inserts = parentMap.get(v);
        let angleAvg = 0;
        let scaleAvg = 0;
        console.log("inserts", inserts);
        if(inserts) {
            // draw connection between stitch and parent(s)
            inserts.forEach( ve => {
                const symbol = drawSymbol(v, ve)
                if (symbol){
                    stitches.appendChild(symbol.path);
                    angleAvg += symbol.angle;
                    scaleAvg += symbol.scale;
                }
            });

            // draw bar over (connected) stitches
            if (v.type.symbol?.bar) {
                const bar = document.createElementNS(svgNamespace, "path");
                bar.setAttribute("d", stitchSymbols["bar"].symbol);
                scaleAvg /= (inserts.length??1);
                angleAvg /= (inserts.length??1);
                const transform = `translate(${(v.x ?? 0)}, ${v.y ?? 0}) rotate(${angleAvg}) scale(0.05, ${scaleAvg}) translate(-50, -5)`;
                bar.setAttribute("transform", transform);
                stitches.appendChild(bar);
            }
        }
        else {  // chains
            const path = document.createElementNS(svgNamespace, "path");
            if(v.type.symbol) {
                path.setAttribute("d", v.type.symbol!.symbol);
                // TODO: angle and distance need to be reworked
                let prev = prevMap.get(v);
                if (!prev)
                    prev =prevMapInv.get(v);
                const dx = (prev?.x ?? 0) - (v.x ??0);
                const dy = (prev?.y ?? 0) - (v.y ??0);
                const distance = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                
                const scale = distance / 100;
                //console.log("x, y:", v.x, v.y, "\nangle:", angle, "\nscale:", scale);
                const transform = `translate(${(v.x ?? 0)}, ${v.y ?? 0}) rotate(${angle}) scale(${scale})  translate(-50, -50)`;
                path.setAttribute("transform", transform);
                stitches.appendChild(path)
            }
        }

        edges.filter( e => (e.type === "slst" && e.source === v) && e.doRender).forEach( e => { 
            const symbol = drawSymbol(v, {parent: e.target, edge: e})
            if (symbol){
                stitches.appendChild(symbol.path);
                const path = document.createElementNS(svgNamespace, "line");
                path.setAttribute("x1", `${e.source.x ?? 0}`);
                path.setAttribute("y1", `${e.source.y ?? 0}`);
                path.setAttribute("x2", `${e.target.x ?? 0}`);
                path.setAttribute("y2", `${e.target.y ?? 0}`);
                path.setAttribute("stroke-width", "1");
                path.setAttribute("stroke", "blue");
                layerLines.appendChild(path)
            }
        });

        // draw line along layer outline
        const prev = edges.find( e => e.type == "prev" && e.source === v);
        if(prev) {
            const path = document.createElementNS(svgNamespace, "line");
            path.setAttribute("x1", `${prev.source.x ?? 0}`);
            path.setAttribute("y1", `${prev.source.y ?? 0}`);
            path.setAttribute("x2", `${prev.target.x ?? 0}`);
            path.setAttribute("y2", `${prev.target.y ?? 0}`);
            path.setAttribute("stroke-width", "1");
            path.setAttribute("stroke", "blue");
            layerLines.appendChild(path)
        }
    });
    setupZoom(svg, g);
}
        