import ruleset from "./assets/ruleset.json";

type Stitch = "ss" | "sc" | "hdc" | "dc" | "tr" | "ch" | "hole" | "ring";

class StitchType {
    type: Stitch = "ch";
    category: "ring" | "insert" | "terminal";

    constructor(type: Stitch) {
        this.type = type;
        switch(this.type) {
            case "ss":
            case "ch": {
                this.category = "terminal";
                break;
            }
            case "sc":
            case "hdc":
            case "dc":
            case "tr":
            case "hole": {
                this.category = "insert";
                break;
            }
            case "ring": {
                this.category = "ring"
                break;
            }
        }
    }
}

export const StitchTypes = {
    CH: new StitchType("ch"),
    SLST: new StitchType("ss"),
    SC: new StitchType("sc"),
    HDC: new StitchType("hdc"),
    DC: new StitchType("dc"),
    TR: new StitchType("tr"),
    HL: new StitchType("hole"),
    MC: new StitchType("ring")
}


class Modifier {
    private type: "p" | "l" | "" = "";
    private position: "f" | "b" = "f";

    constructor(type?: "p" | "l" | "", position?: "f" | "b") {
        if(type)
            this.type = type;
        if(position && type !== "") 
            this.position = position;
    }

    applyToStitch(stitch: StitchType) {
        switch(this.type) {
            case "p":
                return this.position + this.type + stitch;
            case "l":
                return stitch + this.position + this.type;
            default:
                return stitch;
        }
    }
}

export const Modifiers = {
    BL: new Modifier("l", "b"),
    FL: new Modifier("l"),
    BP: new Modifier("p", "b"),
    FP: new Modifier("p"),
    NO: new Modifier
};


type EdgeType = "prev" | "slst" | "insert" | "surround";

class Edge {
    to: Vertex;
    from: Vertex;
    type: EdgeType;
    mod: Modifier;

    constructor(from: Vertex, to: Vertex, type: EdgeType, mod: Modifier) {
        this.to = to;
        this.from = from;
        this.type = type;
        this.mod = mod;
    }
}

class Vertex {
    id: string;
    layer: number;
    type: StitchType;

    constructor(id: string, type: StitchType, layer: number) {
        this.id = "A"+id;
        this.layer = layer;
        this.type = type;
    }

    serialize(edges: Edge[]) {
        return `${this.type.type}${this.labelSymbol(edges)}`;
    }

    protected labelSymbol(edges: Edge[]) {
        let symbol = "";
        const insertedEdges = edges.filter( e => e.type == "insert" && e.from == this);
        const insertingEdges = edges.filter( e => e.type == "insert" && e.to == this);
        const parents = insertedEdges.map( e => e.to);

        if(insertedEdges.length > 1) {
            // TODO: no support for specific dec placement yet
            symbol += `${insertedEdges.length}tog`;
        }
        else{
            if(insertingEdges.length > 1)
                symbol += `.${this.id}`;
            if(edges.filter( e => e.type == "insert" && e.to == parents[0]).length > 1) {
                symbol += `@${parents[0].id}`;
            }
        }
        return symbol;
    }
}

class Hole extends Vertex {
    size: number;

    constructor(id: string, layer: number, size: number) {
        super(id, StitchTypes.HL, layer);
        this.size = size;
    }

    serialize(edges: Edge[]) {
        return `${this.size}ch${this.labelSymbol(edges)}`;
    }
}

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
                const edge = this.edges.find(e => e.from.id === a.id && e.to.id === b.id && e.type === "prev");
                return edge ? 1 : -1;
            });
        return IDs;
    }

    addRow(previousRowIDs: string[]) {
        this.currentRow += 1;
        const newIDs: string[] = [];
        let previousID: string = previousRowIDs[previousRowIDs.length-1];

        for(let i=0; i<previousRowIDs.length; i++) {
            const currentPrev = this.vertices.get(previousRowIDs[i]);

            if(currentPrev) {
                const rules = ruleset["nr-rules"].filter( r => r["category"]==currentPrev.type.category);
                const index = selectWeightedRandom(rules);
                if(index !== undefined) {
                    const r = rules[index];

                    const parents: Vertex[] = [];
                    for(const c of r.consume) {
                        const p =this.vertices.get(previousRowIDs[i+c])
                        if(p)
                            parents.push(p)
                    }

                    for(let k=0;k<r.produce.length;k++) {
                        const produce = r.produce[k];
                        let stitch: Vertex;
                        if(produce.type == "hole" && produce.size !== undefined)
                            stitch = new Hole(currentPrev.id+String(this.currentRow)+String(k), this.currentRow, produce.size);
                        else
                            stitch = new Vertex(currentPrev.id+String(this.currentRow)+String(k), new StitchType(r.produce[k].type as Stitch), this.currentRow);
                        this.addVertex(stitch);
                        if(stitch.type.category == "insert")
                            newIDs.push(stitch.id);

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
        const before = this.vertices.get(idBefore);
        const after = this.vertices.get(idAfter);
        if(before && after){
            this.addVertex(hole);
            const index = this.edges.findIndex( e => (e.from == before && e.to == after) || (e.to == before && e.from == after));
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
            console.log("###########################");
            console.log("current stitch: ", currentStitch);

            let layer = currentStitch.layer;
            let layerString: string[] = [];
            let connectedEdge: Edge | undefined = new Edge(currentStitch, currentStitch, "prev", Modifiers.NO);

            while(connectedEdge) {
                currentStitch = connectedEdge.from;
                connectedEdge = this.edges.find(e => e.type == "prev" && e.to == currentStitch);
                
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