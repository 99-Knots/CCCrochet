type StitchType = "ch" | "ss" | "sc" | "hdc" | "dc" | "tr";


class Modifier {
    type: "p" | "l" | "" = "";
    position: "f" | "b" = "f";

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

const blMod = new Modifier("l", "b");
const flMod = new Modifier("l");
const bpMod = new Modifier("p", "b");
const fpMod = new Modifier("p");
const emptyMod = new Modifier()


class Node {
    previous: Node | null = null;
    next: Node | null = null;
    children: Node[] | null = null;
    parents: Node[] | null = null;
    type: StitchType = "sc";
    modifier: Modifier;
    name: string;

    constructor(name: string) {
        this.name = name;
        this.modifier = emptyMod;
    }

    insertBefore(other: Node) {
        const temp = other.previous;

        // connect to other
        other.previous = this;
        this.next = other;

        // connect to previous previous
        if(temp)
            temp.next = this;
        this.previous = temp;
    }

    insertAfter(other: Node) {
        const temp = other.next;

        other.next = this;
        this.previous = other;

        if(temp)
            temp.previous = this;
        this.next = temp;
    }

    symbol() {
        let str = this.modifier.applyToStitch(this.type);
        return str;
    }
}