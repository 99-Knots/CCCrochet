import ruleset from "./assets/ruleset.json";
import {forceSimulation, forceLink, forceManyBody, forceCollide, forceRadial} from "d3-force-3d";
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
        firstStitch.fx = 0;
        firstStitch.fy = 0;
        firstStitch.fz = 0;
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

                    // TODO: find better spot for this
                    for(let l=1; l<newIDs.length-1; l++) {
                        const stitch = this.vertices.get(newIDs[l])
                        if (stitch instanceof Hole)
                            this.addHole(stitch, newIDs[l-1], newIDs[l+1]);
                    }
                }
            }
        }
        return newIDs;
    }

    addHole(hole: Hole, idBefore: string, idAfter: string) {
        // TODO: remove need for before and after?
        // TODO: process holes differently, establish links between chains and inserted stitches, adjust if and how they affect each other in the force directed layout -> new edgetype
        const before = this.vertices.get(idBefore);
        const after = this.vertices.get(idAfter);
        if(before && after){
            this.addVertex(hole);
            this.edges = this.edges.filter(e => !(e.target == hole) && !(e.source == hole));
            let prev = before.id;
            this.addEdge(before.id, hole.id, "surround");
            this.addEdge(after.id, hole.id, "surround")
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

    force3D() {
        const firstStitch = this.vertices.get(this.firstStitchID);
        if(firstStitch) {
            firstStitch.fx = 0;
            firstStitch.fy = 0;
            // don't lock z to allow the tail end to get "pushed put"
        }

        const simNodes = Array.from(this.vertices.values());
        const simulation = forceSimulation(simNodes, 3)
            .force("link", forceLink<Vertex, Edge>(this.edges).distance(( e: Edge) => e.length).strength(1).iterations(10))
            .force("charge", forceManyBody().strength(-50))
            .force("collide", forceCollide(10))
            .stop();

        const MAX_TICKS = 500; 
        for (let i = 0; i < MAX_TICKS; i++) {
            simulation.tick();
            
            if (simulation.alpha() < simulation.alphaMin()) 
                break;
        }
        return simNodes;
    }

    force2D() {
        // initiate with radial layout to reduce twists and crossings
        const layers = this.getSortedLayers();
        for (const l of layers) {
            const angle = 2*Math.PI / l.length;
            l.forEach( (v, index) => {
                v.x = v.layer * Math.cos(index * angle); 
                v.y = v.layer * Math.sin(index * angle);
            });
        }

        const simNodes = layers.flat();
        const simulation = forceSimulation(simNodes, 2)
            .force("link", forceLink<Vertex, Edge>(this.edges).distance( (e: Edge) => e.length*6).strength( (e: Edge) => {
                switch (e.type) {
                    case "insert": return 1.0;
                    case "surround": return 0.8;
                    case "prev": return 0.3;
                    default: return 0.1;
                }
            }).iterations(8))
            .force("charge", forceManyBody().strength(-10))
            .force("collide", forceCollide().radius(1))
            .force("radial", forceRadial<Vertex>(v => v.layer*6, 0, 0).strength(0.5))
            .stop();

        simulation.alpha(0.5);
        const MAX_TICKS = 500; 
        for (let i = 0; i < MAX_TICKS; i++) {
            simulation.tick();
            
            if (simulation.alpha() < simulation.alphaMin()) 
                break;
        }
        return simNodes;
    }

    getSortedNodes(startId?: string, endId?: string) {
        if(!startId)
            startId = this.firstStitchID;
        const verts = [];
        let stitch = this.vertices.get(startId);
        if(stitch)
        while(stitch) {
            verts.push(stitch)
            const next = this.edges.find( e => e.type === "prev" && e.target === stitch)?.source;
            stitch = next;
            if(next?.id === endId)  // includes endId in sorted list
                break;
        }
        return verts;
    }

    getSortedLayers(startId?: string, endId?: string) {
        const sorted = this.getSortedNodes(startId, endId);
        if (sorted.length < 1)
            return [];
        const layered = [];
        let currentLayerList: Vertex[] = [];
        let currentLayer = sorted[0].layer;
        for(const v of sorted) {
            if (v.layer !== currentLayer) {
                layered.push(currentLayerList);
                currentLayer = v.layer;
                currentLayerList = [v];
            }
            else {
                currentLayerList.push(v);
            }
        }
        layered.push(currentLayerList);
        return layered;
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
