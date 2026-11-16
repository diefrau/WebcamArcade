import {GestureInterpreter as Old} from '../../artifacts/optimization-good/src/vision/gestures.ts';
import {GestureInterpreter as Current} from '../../src/vision/gestures.ts';
import {writeFile} from 'node:fs/promises';
function hand(width, pinched, offset=0){const p=Array.from({length:21},()=>({x:0.5+offset,y:0.6}));p[5]={x:0.5+offset-width/2,y:0.6};p[17]={x:0.5+offset+width/2,y:0.6};p[4]={x:0.5+offset-width*0.3,y:0.4};p[8]={x:0.5+offset+(pinched?-width*0.28:width*0.8),y:0.4};return p;}
const scenarios=[
 {name:'normal_open_pinch_hold_release',frames:Array.from({length:16},(_,i)=>hand(.14,i>=5&&i<10))},
 {name:'edge_jitter',frames:Array.from({length:20},(_,i)=>hand(.14,i>=6&&i<14,(i%2?1:-1)*.002))},
 {name:'tiny_palm',frames:Array.from({length:16},(_,i)=>hand(.008,i>=5&&i<10))},
 {name:'tracking_loss',frames:Array.from({length:16},(_,i)=>i===7?undefined:hand(.14,i>=5&&i<10))},
];
const results=[];for(const scenario of scenarios){const a=new Old(),b=new Current();const frames=scenario.frames.map((points,i)=>{const left=a.update(points,i*100,4/3),right=b.update(points,i*100,4/3);const pick=x=>({detected:x.detected,pinched:x.pinched,fire:x.fire,x:x.x,y:x.y});return{index:i,timeMs:i*100,baseline:pick(left),current:pick(right)};});results.push({name:scenario.name,frames,differences:frames.filter(f=>JSON.stringify(f.baseline)!==JSON.stringify(f.current)).map(f=>f.index)});}
await writeFile('docs/optimization/raw/landmark-synthetic.json',JSON.stringify({description:'Synthetic landmarks; validates interpreter outputs only, not actual camera accuracy or whole-game scoring.',results},null,2));for(const r of results)console.log(r.name,'samples',r.frames.length,'different',r.differences.length);
