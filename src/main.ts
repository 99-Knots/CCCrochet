import './style.css'
import * as LSys from './LSystem.ts'
import * as CG from './CrochetGraph.ts'

const pattern = document.getElementById("pattern")!;
let circle = new LSys.LSystem();
circle.generate(6);
pattern.innerText = circle.formatToGrammar();

const pat = new CG.Pattern();
let h = pat.startRing(5);
if(h)
    pat.addRow([h.id]);
console.log(pat);