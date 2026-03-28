import './style.css'
import * as LSys from './LSystem.ts'
import * as CG from './CrochetGraph.ts'

const pattern = document.getElementById("pattern")!;
let circle = new LSys.LSystem();
circle.generate(6);
pattern.innerText = circle.formatToGrammar();

const pat = new CG.Pattern();
//let h = pat.startChain(5);
const l = pat.addRow([pat.firstStitchID]);
console.log(l);
pat.addRow(l);
console.log(pat);
pattern.innerText = pat.serialize();