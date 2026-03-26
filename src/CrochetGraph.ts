type StitchType = "ss" | "sc" | "hdc" | "dc" | "tr" | "ch" | "hole" | "mc";


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

export const StitchTypes = {
    CH: "ch",
    SLST: "ss",
    SC: "sc",
    HDC: "hdc",
    DC: "dc",
    TR: "tr"
}

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
        this.id = id;
        this.layer = layer;
        this.type = type;
    }
}

export class Pattern {
    edges: Edge[] = [];
    vertices: Map<string, Vertex> = new Map();
    currentRow: number = 0;

    addVertex(v: Vertex) {
        this.vertices.set(v.id, v);
    }

    addEdge(fromID: string, toID: string, type: EdgeType, mod: Modifier=Modifiers.NO) {
        const source = this.vertices.get(fromID);
        const target = this.vertices.get(toID);
        if(source && target)
            this.edges.push(new Edge(source, target, type, mod))
    }

    startRing(n: number) {
        if(n<2) {
            return null;
        }
        const firstCh = new Vertex("0", "ch", 0);
        this.addVertex(firstCh);
        let lastID = firstCh.id;
        const hole = new Vertex("h0", "hole", 0);
        this.addVertex(hole)
        for(let i=1;i<n;i++) {
            const ch = new Vertex(String(i), "ch", 0);
            this.addVertex(ch);
            this.addEdge(lastID, ch.id, "prev")
            this.addEdge(ch.id, hole.id, "surround");
            lastID = ch.id;
        }
        this.addEdge(lastID, firstCh.id, "slst");
        return hole;
    }

    getRowIDs(row: number) {
        const IDs: Vertex[] = [];
        // TODO
    }

    addRow(previousRowIDs: string[]) {
        this.currentRow += 1;
        let previousID: string | null = null;
        for(const parentID of previousRowIDs) {
            const stitchNr = Math.random() < 0.5 ? 1 : 2;
            for(let i=0;i<stitchNr;i++) {
                const stitch = new Vertex(parentID+String(this.currentRow)+String(), "sc", this.currentRow);
                this.addVertex(stitch);
                console.log(stitchNr);
                if(previousID)
                    this.addEdge(stitch.id, previousID, "prev");
                this.addEdge(stitch.id, parentID, "insert");
                previousID = stitch.id;
            }
        }
    }
}