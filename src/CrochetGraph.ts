import ruleset from "./assets/ruleset.json";
import {forceSimulation, forceLink, forceManyBody, forceCollide, forceCenter} from "d3-force-3d";

import {Edge, Vertex, Hole, StitchTypes, Modifiers, StitchType, Modifier, type EdgeType, type Stitch} from "./Stitches"

export class Pattern {
    edges: Edge[] = [];
    vertices: Map<string, Vertex> = new Map();
    currentRow: number = 0;
    activeInsertions: Vertex[] = [];
    firstStitchID: string;

    constructor(firstStitch?: Vertex) {
        if(!firstStitch)
            firstStitch = new Vertex("0", StitchTypes.MC, 0);
        this.firstStitchID = firstStitch.id;
        this.addVertex(firstStitch);
        this.activeInsertions = [firstStitch];
    }

    addVertex(v: Vertex) {
        this.vertices.set(v.id, v);
    }

    addEdge(fromID: string, toID: string, type: EdgeType, mod: Modifier=Modifiers.NO) {
        const source = this.vertices.get(fromID);
        const target = this.vertices.get(toID);
        if(source && target)
            this.edges.push(new Edge(source, target, type, mod))
    }

    startChain(n: number) {
        if(n<2) {
            return null;
        }
        const firstCh = new Vertex("0", StitchTypes.CH, 0);
        this.addVertex(firstCh);
        let lastID = firstCh.id;
        const hole = new Hole("h0", 0, n);
        this.addVertex(hole)
        for(let i=1;i<n;i++) {
            const ch = new Vertex(String(i), StitchTypes.CH, 0);
            this.addVertex(ch);
            this.addEdge(lastID, ch.id, "prev")
            this.addEdge(ch.id, hole.id, "surround");
            lastID = ch.id;
        }
        this.addEdge(lastID, firstCh.id, "slst");
        return hole;
    }

    getLayerIDs(layer: number) {
        // incorrect order
        const IDs: Vertex[] = Array.from(this.vertices.values()).filter(v => v.layer === layer);
        IDs.sort((a, b) => {
                const edge = this.edges.find(e => e.source.id === a.id && e.target.id === b.id && e.type === "prev");
                return edge ? 1 : -1;
            });
        return IDs;
    }

    addRow(previousRowIDs: string[]) {
        this.currentRow += 1;
        const newIDs: string[] = [];
        let previousID: string = previousRowIDs[previousRowIDs.length-1];

        // iterate over every stitch in prev row
        for(let i=0; i<previousRowIDs.length; i++) {
            const currentPrev = this.vertices.get(previousRowIDs[i]);

            if(currentPrev) {
                // get all rules that can be applied to the current stitch
                const rules = ruleset["nr-rules"].filter( r => r["category"]==currentPrev.type.category);
                const index = selectWeightedRandom(rules);
                if(index !== undefined) {
                    const r = rules[index];

                    // get all stitches the new one gets worked into
                    const parents: Vertex[] = [];
                    for(const c of r.consume) {
                        const p =this.vertices.get(previousRowIDs[i+c])
                        if(p)
                            parents.push(p)
                    }

                    // go over all stitches created by the chosen rule
                    for(let k=0;k<r.produce.length;k++) {
                        const produce = r.produce[k];
                        let stitch: Vertex;
                        if(produce.type == "hole" && produce.size !== undefined)
                            stitch = new Hole(currentPrev.id+String(this.currentRow)+String(k), this.currentRow, produce.size);
                        else
                            stitch = new Vertex(currentPrev.id+String(this.currentRow)+String(k), new StitchType(r.produce[k].type as Stitch), this.currentRow);
                        this.addVertex(stitch);

                        // TODO: see if continue to skip chains etc or if check in next iter before rule application
                        if(stitch.type.category == "insert")
                            newIDs.push(stitch.id);

                        // TODO: how to adapt this for holes?
                        if(previousID)
                            this.addEdge(stitch.id, previousID, "prev");
                        for(const p of parents)
                            this.addEdge(stitch.id, p.id, "insert");
                        previousID = stitch.id;
                    }
                }
            }
        }
        return newIDs;
    }

    addHole(hole: Hole, idBefore: string, idAfter: string) {
        // TODO: possibly not needed because chains only needed for rendering?
        const before = this.vertices.get(idBefore);
        const after = this.vertices.get(idAfter);
        if(before && after){
            this.addVertex(hole);
            const index = this.edges.findIndex( e => (e.source == before && e.target == after) || (e.target == before && e.source == after));
            if(index >= 0)
                this.edges.splice(index);
            let prev = before.id;
            for(let i=0; i<hole.size; i++) {
                const ch = new Vertex(hole.id+String(i), StitchTypes.CH, hole.layer);
                this.addVertex(ch);
                this.addEdge(ch.id, prev, "prev");
                this.addEdge(ch.id, hole.id, "surround")
                prev = ch.id;
            }
            this.addEdge(after.id, prev, "prev");
        }
    }

    serialize() {
        let currentStitch = this.vertices.get(this.firstStitchID);
        let pattern: string[] =  [];
        if(currentStitch){
            let layer = currentStitch.layer;
            let layerString: string[] = [];
            let connectedEdge: Edge | undefined = new Edge(currentStitch, currentStitch, "prev", Modifiers.NO);

            while(connectedEdge) {
                currentStitch = connectedEdge.source;
                connectedEdge = this.edges.find(e => e.type == "prev" && e.target == currentStitch);
                
                if(layer != currentStitch.layer) {
                    pattern.push(layerString.join(", "));
                    layerString = []
                }
                layer = currentStitch.layer;

                layerString.push(currentStitch.serialize(this.edges));
            }
            pattern.push(layerString.join(", "))
        }
        return pattern.join("\n");
    }

    force() {
        const simNodes = Array.from(this.vertices.values());
        const simulation = forceSimulation(simNodes, 3)
            .force("link", forceLink(this.edges).distance(10).strength(1))
            .force("charge", forceManyBody().strength(-100))
            .force("collide", forceCollide().radius(10))
            .force("center", forceCenter(0, 0, 0))
            .stop();
        const MAX_TICKS = 300; 
        for (let i = 0; i < MAX_TICKS; i++) {
            simulation.tick();
            
            if (simulation.alpha() < simulation.alphaMin()) 
                break;
        }
        return simNodes;
    }
}



function selectWeightedRandom(rules: {weight: number}[]) {
    let total = 0;
    for(const r of rules) {
        total += r.weight;
    }
    const selection = Math.random() * total;
    let cumulative = 0;
    for(let i=0; i<rules.length; i++) {
        cumulative += rules[i].weight;
        if(cumulative >= selection) {
            return i;
        }
    }
}