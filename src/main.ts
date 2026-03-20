import './style.css'
import * as LSys from './LSystem.ts'

const pattern = document.getElementById("pattern")!;
let circle = new LSys.LSystem();
circle.generate(6);
pattern.innerText = circle.formatToGrammar();