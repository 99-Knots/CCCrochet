import stitchSymbols from "../assets/stitchSymbols.json"
import { Edge, Vertex } from "../Stitches";


export function drawToSVG(svg: HTMLElement, vertices: Vertex[], edges: Edge[]) {
    const svgNamespace = "http://www.w3.org/2000/svg";
    vertices.forEach( v => {            
        const inserts = edges.filter( e => e.type == "insert" && e.source === v);
        let angleAvg = 0;
        let scaleAvg = 0;

        // draw connection between stitch and parent(s)
        inserts.forEach( e => {
            const path = document.createElementNS(svgNamespace, "path");
            path.setAttribute("d", v.type.symbol!.symbol + e.mod.symbol.symbol);
            const dx = (e.target.x  ?? 0) - (e.source.x ?? 0);
            const dy = (e.target.y ?? 0) - (e.source.y ?? 0);
            const distance = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * (180 / Math.PI) - 90;
            angleAvg += angle;
            
            const scale = distance / 100;
            scaleAvg += scale;

            const transform = `translate(${(e.source.x ?? 0)}, ${e.source.y ?? 0}) rotate(${angle}) scale(0.05, ${scale}) translate(-50, -5)`;
            path.setAttribute("transform", transform);
            svg.appendChild(path)
        });

        // draw bar over (connected) stitches
        if (v.type.symbol?.bar) {
            const bar = document.createElementNS(svgNamespace, "path");
            bar.setAttribute("d", stitchSymbols["bar"].symbol);
            scaleAvg /= (inserts.length??1);
            angleAvg /= (inserts.length??1);
            const transform = `translate(${(v.x ?? 0)}, ${v.y ?? 0}) rotate(${angleAvg}) scale(0.05, ${scaleAvg}) translate(-50, -5)`;
            bar.setAttribute("transform", transform);
            svg.appendChild(bar)
        }

        // draw line along layer outline
        const prev = edges.find( e => e.type == "prev" && e.source === v);
        if(prev) {
            const path = document.createElementNS(svgNamespace, "line");
            path.setAttribute("x1", `${prev?.source.x ?? 0}`);
            path.setAttribute("y1", `${prev?.source.y ?? 0}`);
            path.setAttribute("x2", `${prev?.target.x ?? 0}`);
            path.setAttribute("y2", `${prev?.target.y ?? 0}`);
            path.setAttribute("stroke-width", "0.1");
            path.setAttribute("stroke", "blue");
            svg.appendChild(path)
        }
    });
}

        