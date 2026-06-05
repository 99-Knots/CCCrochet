import {forceSimulation, forceLink, forceManyBody, forceCollide, forceRadial} from "d3-force-3d";
import {Edge, Vertex, Hole, Support, StitchTypes, StitchType, Modifier, type EdgeType, type Stitch} from "./Stitches"
import { forceCollinearSupport, forceAngularOrder } from "./forces";
import { selectWeightedRandom } from "./random";
import { type PatternRules } from "./ruleProcessing";


export class Pattern {
    edges: Edge[] = [];
    vertices: Map<string, Vertex> = new Map();
    private currentRow: number = 0;
    firstStitchID: string;
    baseRadius: number = 0;
    private prevMap = new Map<Vertex, Vertex>();    // mapping stitch to previous one
    private nextMap = new Map<Vertex, Vertex>();    // mapping stitch to following one

    private parentMap = new Map<Vertex, {parent: Vertex, edge: Edge}[]>();   // all stitches a given stitch has been inserted into
    private insertMap = new Map<Vertex, {child: Vertex, edge: Edge}[]>();   // all stitches inserted into a given stitch

    private sortedLayers: (Vertex[])[] = [];
    rowRulesets: PatternRules = [];
    usedStitches = new Map<string, {stitch: StitchType, modifier: Modifier}>;
    usedRules: number[][] = []; // indices of rules used per row

    constructor(startLayout?: 0 | 1) {
        if(!startLayout){
            const firstStitch = new Vertex("0", StitchTypes.MC, 0);
            firstStitch.fx = 0;
            firstStitch.fy = 0;
            firstStitch.fz = 0;
            this.firstStitchID = firstStitch.id;
            this.addVertex(firstStitch);
            this.usedStitches.set(firstStitch.type.toString(), {stitch: firstStitch.type, modifier: Modifier.NO});
        }
        else{
            const hole = this.startChain(12)!;
            this.firstStitchID = hole.id;
        }
    }

    private addVertex(v: Vertex) {
        this.vertices.set(v.id, v);
    }

    private addEdge(fromID: string, toID: string, type: EdgeType, mod: Modifier=Modifier.NO) {
        const source = this.vertices.get(fromID);
        const target = this.vertices.get(toID);
        if(source && target)
            this.edges.push(new Edge(source, target, type, mod))
    }

    private startChain(n: number) {
        if(n<2) {
            return null;
        }
        const firstCh = new Vertex("0", StitchTypes.CH, 0);
        this.addVertex(firstCh);
        let lastID = firstCh.id;
        const hole = new Hole("h0", 0, n);
        this.addVertex(hole);
        this.addEdge(firstCh.id, hole.id, "surround");
        const chains = [firstCh];
        for(let i=1; i<n; i++) {
            const ch = new Vertex(String(i), StitchTypes.CH, 0);
            this.addVertex(ch);
            this.addEdge(lastID, ch.id, "prev");
            this.addEdge(ch.id, hole.id, "surround");
            lastID = ch.id;
            chains.push(ch);
        }
        
        this.addEdge(lastID, firstCh.id, "slst");
        arrangeRadially(chains, n/(2*Math.PI)*20, true);
        return hole;
    }

    generate(rowRulesets: PatternRules) {
        //const rowRules = rowRulesets[0]//createRuleset(1, 0);
        const numRows = rowRulesets.length;
        this.rowRulesets.push(rowRulesets[0]);
        let l = this.addRow([this.firstStitchID]);
        for (let j = 1; j < numRows; j++) {
            this.rowRulesets.push(rowRulesets[j]);
            l = this.addRow(l);
        }


        this.edges.filter( e => e.type === "prev").forEach( e => { 
            this.prevMap.set(e.source, e.target); 
            this.nextMap.set(e.target, e.source); 
        });

        this.edges.filter( e => e.type === "insert").forEach( e => { 
            const oldParentMap = this.parentMap.get(e.source); 
            if (oldParentMap)
                oldParentMap.push({parent: e.target, edge: e});
            else
                this.parentMap.set(e.source, [{parent: e.target, edge: e}]);

            const oldInsertMap = this.insertMap.get(e.target); 
            if (oldInsertMap)
                oldInsertMap.push({child: e.source, edge: e});
            else
                this.insertMap.set(e.target, [{child: e.source, edge: e}]);
        });

        this.sortedLayers = this.getSortedLayers();
        this.processHoles();

        return this;
    }

    private addRow(previousRowIDs: string[]) {
        this.currentRow += 1;
        const newIDs: string[] = [];
        let previousID: string = previousRowIDs[previousRowIDs.length-1];
        const usedRulesOfRow = Array(this.rowRulesets[this.rowRulesets.length-1].length).fill(0);

        // iterate along stitches in prev row
        let i = 0;
        while(i < previousRowIDs.length) {
            const currentPrev = this.vertices.get(previousRowIDs[i]);

            if(currentPrev) {
                // only consider rules that are applicable and do not use more stitches than are available in the previous row
                // TODO: why was this not a problem before? -> probably because creating parent list directly from consumes, so no need to verify all were picked
                // -> every ruleset requires at least one rule that only consumes one stitch!
                const newRules = this.rowRulesets[this.rowRulesets.length-1].filter( r => r["category"] == currentPrev.type.category && (i+Math.max(...r["consume"]) < previousRowIDs.length) );
                const idx = selectWeightedRandom(newRules);
                usedRulesOfRow[idx]++;
                const r = newRules[idx];
                const maxConsume = Math.max(...r["consume"]);

                // get all stitches the new ones gets worked into
                const consumes: Vertex[] = [];
                for(const c of r.consume) {
                    const stitch = this.vertices.get(previousRowIDs[i+c])
                    if(stitch)
                        consumes.push(stitch)
                }

                for(let k=0; k<r.produce.length; k++) {
                    const produce = r.produce[k];
                    let stitch: Vertex;
                    if(produce.topology == "chain" && produce.parameters.size !== undefined){
                        stitch = new Hole(currentPrev.id+String(this.currentRow)+String(k), this.currentRow, produce.parameters.size);
                    }
                    else{
                        stitch = new Vertex(currentPrev.id+String(this.currentRow)+String(k), new StitchType(r.produce[k].type as Stitch), this.currentRow);
                        this.usedStitches.set(
                            ((r.produce[k].modifier == Modifier.NO || !r.produce[k].modifier) ? stitch.type.toString() : r.produce[k].modifier?.applyToStitch(stitch.type) + ""), 
                            {stitch: stitch.type, modifier: r.produce[k].modifier ?? Modifier.NO});
                    }
                    this.addVertex(stitch);

                    // TODO: see if continue to skip chains etc or if check in next iter before rule application
                    if(stitch.type.category == "insert")
                        newIDs.push(stitch.id);

                    // TODO: how to adapt this for holes?
                    if(previousID)
                        this.addEdge(stitch.id, previousID, "prev");
                    
                    // find parents of an individual stitch
                    const parents: Vertex[] = [];
                    for(const c of produce.into) {
                        parents.push(consumes[c]);
                    }

                    for(const p of parents) {
                        const mod = r.produce[k].modifier;

                        this.addEdge(stitch.id, p.id, "insert", mod);
                    }
                    previousID = stitch.id;
                } 
                i += maxConsume + 1; // go to next free stitch
            }
        }
        for(let l=1; l<newIDs.length-1; l++) {
            const stitch = this.vertices.get(newIDs[l])
            if (stitch instanceof Hole){
                this.addHole(stitch, newIDs[l-1], newIDs[l+1]);
            }
        }
        this.usedRules.push(usedRulesOfRow);
        return newIDs;
    }

    private processHoles() {
        const holes = Array.from(this.vertices.values()).filter(v => v instanceof Hole) as Hole[];
        for(const hole of holes) {
            let insertions = this.insertMap.get(hole)?.filter( i => i.child.type != StitchTypes.HL) ?? [];
            let insertionVerts = insertions.map( i => i.child);
            insertions.forEach( i => i.edge.doRender = false);

            insertionVerts = this.sortSubset(insertionVerts);

            let surroundings = this.edges.filter(e => (e.target == hole && e.type == "surround")).map( e => e.source);
            surroundings = this.sortSubset(surroundings);

            // remove previous insertion edges
            //this.edges = this.edges.filter(e => !(e.type === "insert" && e.target.id === hole.id));

            const M = insertionVerts.length;
            const N = surroundings.length;
            const epsilon = 0.1;

            for (let i = 0; i < M; i++) {
                const stitch = insertionVerts[i];
                
                const floatIndex = (i+1) * (N-1) / (M+1);
                
                const idx1 = Math.floor(floatIndex);
                const idx2 = Math.ceil(floatIndex);
                const diff = floatIndex - idx1;

                if (diff < epsilon){
                    this.addEdge(stitch.id, surroundings[idx1].id, "simInsert");
                }
                else if (diff > 1-epsilon) {
                    this.addEdge(stitch.id, surroundings[idx2].id, "simInsert");
                }
                else {
                    const support = new Support(stitch.id, surroundings[idx1].layer);
                    support.interpolationDiff = diff;
                    //new Vertex(stitch.id + "-support", StitchTypes.SP, surroundings[idx1].layer);
                    this.addVertex(support);
                    this.addEdge(support.id, surroundings[idx1].id, "support");
                    this.addEdge(support.id, surroundings[idx2].id, "support");
                    this.addEdge(stitch.id, support.id, "simInsert");
                }

                
            }
        }
    }

    private addHole(hole: Hole, idBefore: string, idAfter: string) {
        // TODO: remove need for before and after?
        const before = this.vertices.get(idBefore);
        const after = this.vertices.get(idAfter);
        if(before && after){
            this.addVertex(hole);
            //this.edges = this.edges.filter(e => !(e.target == hole) && !(e.source == hole));
            this.edges = this.edges.filter(e => !(e.source === hole && e.type === "prev") && !(e.target === hole && e.type === "prev"));
            let prev = before.id;
            this.addEdge(before.id, hole.id, "surround");
            this.addEdge(after.id, hole.id, "surround")
            for(let i=0; i<hole.size; i++) {
                const ch = new Vertex(hole.id+String(i), StitchTypes.CH, hole.layer);
                this.usedStitches.set("ch", {stitch: ch.type, modifier: Modifier.NO});
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
            let connectedEdge: Edge | undefined = new Edge(currentStitch, currentStitch, "prev", Modifier.NO);

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
        // initiate with radial layout to reduce twists and crossings
        const stretchFactor = 8;
        const layers = this.sortedLayers;
        for (const l of layers) {
            const angle = 2 * Math.PI / l.length;
            l.forEach( (v, index) => {
                v.x = v.layer * stretchFactor * Math.cos(index * angle);
                v.y = v.layer * stretchFactor * Math.sin(index * angle);
                v.z = (Math.random() - 0.5) * v.layer * stretchFactor * 0.5; // random ruffle for the outer layers
            });
        }

        const supportVerts = Array.from(this.vertices.values()).filter(v => v.type == StitchTypes.SP);
        const simNodes = layers.flat().concat(supportVerts);
        const simulation = forceSimulation(simNodes, 3) // adjust strength based on edge type  
            .force("supports", forceCollinearSupport(this.edges)) 
            .force("link", forceLink<Vertex, Edge>(this.edges)
                .distance(( e: Edge) => e.length)
                .strength( (e: Edge) => {
                    switch (e.type) {
                        case "support": 
                            return 0.0;
                        case "insert": 
                        case "simInsert":
                            return e.target instanceof Hole ? 0.0 : 2.0;
                        case "surround": 
                            return 0.5; // Allow the hole center to be flexible
                        case "prev": 
                            return 2.0;
                        default: 
                            return 0.1;
                    }
                })
                .iterations(10))
            .force("charge", forceManyBody().strength((v: Vertex) => (v.type == StitchTypes.SP) ? 20 : (v.type == StitchTypes.CH) ? -40 : -80))
            .force("collide", forceCollide( (v: Vertex) => (v.type == StitchTypes.SP) ? 0 : (v.type == StitchTypes.CH) ? 1 : 10))
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
        const stretchFactor = 8;
        const layers = this.sortedLayers;
        for (const l of layers) {
            arrangeRadially(l, stretchFactor*2 * l[0].layer)
        }
        
        const supportVerts = Array.from(this.vertices.values()).filter(v => v.type == StitchTypes.SP);
        const simNodes = layers.flat().concat(supportVerts);
        
        const simulation = forceSimulation(simNodes, 2)
            .force("link", forceLink<Vertex, Edge>(this.edges).distance( (e: Edge) => e.length*stretchFactor).strength( (e: Edge) => {
                switch (e.type) {
                    case "simInsert":
                    case "insert": return 1.0;
                    case "surround": return 0.3;
                    case "prev": return 0.4;
                    case "support": return 0.0;
                    default: return 0.1;
                }
            }).iterations(8))
            .force("charge", forceManyBody().strength(-10))
            .force("collide", forceCollide().radius(1))
            .force("radial", forceRadial<Vertex>(v => v.layer*stretchFactor*3, 0, 0).strength(0.5))
            .force("supports", forceCollinearSupport(this.edges))
            .force("angularOrder", forceAngularOrder(this.prevMap, this.nextMap, 0.4))
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

    private sortNodes(includeHoles?: boolean) {
        // if no selection defined, use all stitches
        const stitches = Array.from(this.vertices.values());

        // 
        const stitchSet = new Set(stitches);    // leftover from 
        const sorted = new Set<Vertex>();

        // find the first stitch by finding the one with no previous one
        let current = stitches.find( s => {
            const prev = this.prevMap.get(s);
            return !prev || !stitchSet.has(prev);   // either no prev at all or prev not in 
        });

        // go over inverted prev edges to get next stitch
        while(current && stitchSet.has(current)) {
            const holes = this.edges.filter( e => e.type == "surround" && e.source == current);
            if(holes && includeHoles) {
                holes.forEach( h => sorted.add(h.target));
            }
            sorted.add(current);
            if(current instanceof Hole)
                current = this.edges.filter( e=> e.type == "surround" && e.target == current).find(e => {
                    const prev = this.prevMap.get(e.source); 
                    return !prev || !stitchSet.has(prev);})?.source
            else
                current = this.nextMap.get(current);
        }
        return Array.from(sorted);
    }

    private sortSubset(stitches: Vertex[]) {
        if (stitches.length <= 1)
            return stitches;

        const globalOrder = new Map<Vertex, number>();
        this.sortedLayers.flat().forEach((v, index) => globalOrder.set(v, index));
        const sorted = stitches.toSorted((a, b) => {
            const idxA = globalOrder.get(a) ?? 0;
            const idxB = globalOrder.get(b) ?? 0;
            return idxA > idxB ? -1 : 1;
        })
        return sorted;
    }

    private getSortedLayers() {
        const sorted = this.sortNodes( true);
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



function arrangeRadially(vertices: Vertex[], radius: number, fix?: boolean) {
    const angle = 2*Math.PI / vertices.length;
    vertices.forEach( (v, index) => {
        if (fix) {
            v.fx = radius * Math.cos(index * angle); 
            v.fy = radius * Math.sin(index * angle);
            v.fz = 0;
        }
        else
        {
            v.x = radius * Math.cos(index * angle); 
            v.y = radius * Math.sin(index * angle);
            v.z = 0;
        }
    });

}
