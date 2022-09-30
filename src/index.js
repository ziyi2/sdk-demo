import { add } from './add';
import { minus } from './minus';
// import "core-js/actual/array/for-each";

let c = add(1, 2);
console.log(c);
let d = add(3, 4);
console.log(d);

let e = minus(d, 4);
console.log(e);
let f = minus(c, 2);
console.log(f);

// const d = [1,2,3];
// d.forEach((item) => console.log(item));