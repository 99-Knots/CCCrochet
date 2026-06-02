import stitchSymbols from "./assets/stitchSymbols.json"

export type Stitch = "ss" | "sc" | "hdc" | "dc" | "tr" | "ch" | "hole" | "ring" | "support";

export class StitchType {
    type: Stitch = "ch";
    category: "ring" | "insert" | "terminal" | "support";
    symbol?: {symbol: string, fill?: boolean, bar?: boolean, height: number};

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
            case "support": {
                this.category = "support"
                break;
            }
        }
        if(this.type in stitchSymbols)
            this.symbol = (stitchSymbols as any)[this.type];
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
    MC: new StitchType("ring"),
    SP: new StitchType("support")
}


export class Modifier {
    private type: "p" | "l" | "" = "";
    private position: "f" | "b" = "f";
    symbol: {symbol: string, height: number} = {symbol: "", height: 0};


    private constructor(type?: "p" | "l" | "", position?: "f" | "b") {
        if(type)
            this.type = type;
        if(position && type !== "") 
            this.position = position;
        const temp = this.position + this.type;
        if(temp in stitchSymbols)
            this.symbol = (stitchSymbols as any)[temp];
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

    static readonly BL = new Modifier("l", "b");
    static readonly FL = new Modifier("l");
    static readonly BP = new Modifier("p", "b");
    static readonly FP = new Modifier("p");
    static readonly NO = new Modifier();

    static fromParam(type?: string, position?: string): Modifier {
        switch(type) {
            case "l": return position === "b" ? Modifier.BL : Modifier.FL;
            case "p": return position === "b" ? Modifier.BP : Modifier.FP;
            default:  return Modifier.NO;
        }
    }

    getParam() {
        return {
            type: this.type,
            position: this.position
        }
    }
}


export type EdgeType = "prev" | "slst" | "insert" | "surround" | "support" | "simInsert";

export class Edge {
    target: Vertex;
    source: Vertex;
    type: EdgeType;
    mod: Modifier;
    length: number = 1;
    doRender: boolean = true;

    constructor(from: Vertex, to: Vertex, type: EdgeType, mod: Modifier) {
        this.target = to;
        this.source = from;
        this.type = type;
        this.mod = mod;
        const height = this.source.type.symbol?.height;
        switch(this.type) {
            case "prev":
                // chains are shorter
                if(this.source.type === StitchTypes.CH || this.target.type === StitchTypes.CH)
                    this.length = 0.5;
                else
                    this.length = 0.8;
                break;
            case "insert":
                this.length = height ?? 1;
                break;
            case "simInsert":
                this.length = height ? height/2 : 0.3;
                break;
            case "slst":
                this.length = 0.5;
                break;
            case "surround":
                this.length = 0.5;
                break;
            case "support":
                this.length = 0.0;
                break;
        }
        this.length += this.mod.symbol?.height ?? 0;
    }
}

export class Vertex {
    id: string;
    layer: number;
    type: StitchType;
    doRender: boolean = true;
    
    x?: number;
    y?: number;
    z?: number;
    vx?: number;
    vy?: number;
    vz?: number;
    fx?: number;
    fy?: number;
    fz?: number;

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
        const insertedEdges = edges.filter( e => e.type == "insert" && e.source == this);
        const insertingEdges = edges.filter( e => e.type == "insert" && e.target == this);
        const parents = insertedEdges.map( e => e.target);

        if(insertedEdges.length > 1) {
            // TODO: no support for specific dec placement yet
            symbol += `${insertedEdges.length}tog`;
        }
            if(insertingEdges.length > 1)
                symbol += `.${this.id}`;
            if(edges.filter( e => e.type == "insert" && e.target == parents[0]).length > 1) {
                symbol += `@${parents[0].id}`;
            }
        return symbol;
    }
}

export class Hole extends Vertex {
    size: number;

    constructor(id: string, layer: number, size: number) {
        super(id, StitchTypes.HL, layer);
        this.size = size;
    }

    serialize(edges: Edge[]) {
        return `${this.size}ch${this.labelSymbol(edges)}`;
    }
}

export class Support extends Vertex {
    interpolationDiff: number = 0;
    
    constructor(supportedId: string, layer: number) {
        super(supportedId + "-support", StitchTypes.SP, layer);
    }
}
