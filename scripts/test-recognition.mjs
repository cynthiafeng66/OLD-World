import assert from 'node:assert/strict';
import {ObjectRecognizer,classifyHand,chooseRecognition} from '../knife-control/recognition.mjs';
import {PoseTracker} from '../knife-control/tracking-core.mjs';
const w=256,h=192;
function frame(rgb,wh,angle=0,circle=false){
  const pixels=new Uint8Array(w*h*4),c=Math.cos(angle),s=Math.sin(angle);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const dx=x-128,dy=y-96,inside=circle?dx*dx+dy*dy<wh[0]**2:Math.abs(dx*c+dy*s)<wh[0]/2&&Math.abs(-dx*s+dy*c)<wh[1]/2,i=(y*w+x)*4;
    pixels.set(inside?rgb:[120,130,140],i);pixels[i+3]=255;
  }return pixels;
}
const detector=new ObjectRecognizer();let rectangles=0;
for(const rgb of [[20,20,20],[240,240,240],[220,30,20],[30,180,60],[30,60,220],[170,100,20]])
  for(const wh of [[20,120],[100,45],[65,60]])for(const angle of [0,.35,.8,1.5]){
    assert.equal(detector.detect(frame(rgb,wh,angle))[0]?.action,'knife',`rectangle ${rgb}, ${wh}, ${angle}`);rectangles++;
  }
assert.equal(detector.detect(frame([240,240,240],[32,32],0,true))[0]?.action,'dough','rounded white object is dough');
assert.equal(detector.detect(frame([20,20,20],[32,32],0,true)).length,0,'dark circle is not a rectangular knife');
assert.equal(detector.detect(frame([120,130,140],[20,120])).length,0,'empty view is inactive');
const fingers=Array.from({length:21},()=>({x:.5,y:.85,z:0}));fingers[0]={x:.5,y:.88,z:0};
for(const [j,root] of [5,9,13,17].entries())for(let n=0;n<4;n++)fingers[root+n]={x:.46+j*.028,y:.65-n*.105+j*.004,z:0};
const fist=structuredClone(fingers);for(const root of [5,9,13,17]){fist[root+1].y=.57;fist[root+2].y=.64;fist[root+3].y=.71;}
const peace=structuredClone(fist);for(const root of [5,9])for(let n=0;n<4;n++)peace[root+n]={...fingers[root+n]};
assert.equal(classifyHand(fist,fist)?.action,'bread');assert.equal(classifyHand(peace,peace)?.action,'explore');
assert.equal(classifyHand(fingers,fingers),null,'open palm is not a fist or V sign');
assert.equal(classifyHand(fist,fist,.2),null,'low confidence ignored');
const object=detector.detect(frame([20,20,20],[20,120]))[0],bread=classifyHand(fist,fist);
assert.equal(chooseRecognition([object],[bread]).action,'knife','object overrides fist');
assert.equal(chooseRecognition([{...object,action:'dough'}],[bread]).action,'dough','dough overrides fist too');
const tracker=new PoseTracker();for(const t of [0,40,80])tracker.update(object,t);
const samePosition={...object,action:'bread',source:'hand'};
assert.equal(tracker.update(samePosition,120).active,false,'semantic action change requires stable reacquisition');
tracker.update(samePosition,160);const state=tracker.update(samePosition,200);
assert.equal(state.active,true);assert.equal(state.pose.action,'bread');assert.equal(state.sweep,null);assert.deepEqual(state.trail,[]);
assert.equal(tracker.update(null,240).active,false,'loss stops actions immediately');
console.log(`PASS: ${rectangles} coloured, rotated and broad rectangles; dough; fist; V sign; object priority; stable semantic transitions and loss`);
