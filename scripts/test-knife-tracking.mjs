import assert from 'node:assert/strict';
import {SilhouetteDetector,PoseTracker,handKnife} from '../knife-control/tracking-core.mjs';

const w=256,h=192;
function frame(predicate=()=>false){
  const pixels=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=(y*w+x)*4,value=predicate(x,y)?45:205;
    pixels[i]=pixels[i+1]=pixels[i+2]=value;pixels[i+3]=255;
  }
  return pixels;
}
const detector=new SilhouetteDetector(w,h);detector.capture(frame());
const upright=frame((x,y)=>x>=115&&x<=137&&y>=15&&y<=175);
const target=detector.detect(upright)[0];assert.ok(target,'vertical toy detected');
assert.ok(target.tip.y<target.base.y,'initial tip points upward');
assert.ok(detector.detect(upright).length,'stationary toy remains detectable');
assert.equal(detector.detect(frame()).length,0,'empty background rejected');
assert.equal(detector.detect(frame((x,y)=>x>70&&x<150&&y>50&&y<130)).length,0,'square rejected');
assert.equal(detector.detect(frame((x,y)=>(x-125)**2+(y-95)**2<38**2)).length,0,'round object rejected');
assert.ok(detector.detect(frame((x,y)=>x>35&&x<220&&y>85&&y<104)).length,'horizontal toy detected');
assert.ok(detector.detect(frame((x,y)=>Math.abs(x-y)<10&&y>20&&y<170)).length,'diagonal toy detected');
const brighter=frame();for(let i=0;i<brighter.length;i++)if(i%4!==3)brighter[i]+=20;
assert.equal(detector.detect(brighter).length,0,'global exposure shift rejected');
const nearest=detector.detect(frame((x,y)=>(x>30&&x<45&&y>20&&y<170)||(x>180&&x<198&&y>25&&y<173)),{previous:{source:'object',base:{x:.75,y:.8},tip:{x:.75,y:.1}}});
assert.ok(nearest[0].base.x>.6,'identity stays near existing target');

const points=Array.from({length:21},()=>({x:.5,y:.85,z:0}));
points[0]={x:.5,y:.88,z:0};
for(const [j,root] of [5,9,13,17].entries())for(let n=0;n<4;n++)points[root+n]={x:.46+j*.028,y:.65-n*.105+j*.004,z:0};
assert.ok(handKnife(points,points),'straight close fingers accepted');
const fist=structuredClone(points);
for(const root of [5,9,13,17]){fist[root+1].y=.57;fist[root+2].y=.64;fist[root+3].y=.71;}
assert.equal(handKnife(fist,fist),null,'fist rejected');
const pointing=structuredClone(fist);for(let n=0;n<4;n++)pointing[5+n]={...points[5+n]};
assert.equal(handKnife(pointing,pointing),null,'pointing finger rejected');
const spread=structuredClone(points);spread[8].x=.18;spread[20].x=.85;
assert.equal(handKnife(spread,spread),null,'widely spread fingers rejected');
assert.equal(handKnife(points,points,.3),null,'low confidence rejected');

const tracker=new PoseTracker();
assert.equal(tracker.update(target,0).active,false,'no single-frame activation');
assert.equal(tracker.update(target,40).active,false,'requires three stable detections');
let state=tracker.update(target,80);assert.ok(state.active);assert.equal(state.sweep,null,'no sweep on acquisition');
assert.ok(Math.abs(state.pose.base.x-(1-target.base.x))<.001,'mirrored grip');
const moved={...target,base:{...target.base,x:target.base.x+.025},tip:{...target.tip,x:target.tip.x+.025}};
state=tracker.update(moved,120);assert.ok(state.sweep);assert.ok(state.speed>0);
state=tracker.update(null,160);assert.equal(state.active,false);assert.equal(state.sweep,null);assert.equal(state.trail.length,0);
state=tracker.update(moved,200);assert.equal(state.sweep,null,'no collision across a missing frame');
state=tracker.update(null,500);assert.equal(state.visible,false,'lost knife hidden');
tracker.reset();for(const time of [0,40,80])tracker.update(target,time);
const teleported={...target,base:{x:.95,y:.1},tip:{x:.95,y:.9}};
state=tracker.update(teleported,120);assert.equal(state.active,false);assert.equal(state.sweep,null,'teleport cannot slash');
state=tracker.update({...target,source:'hand'},160);assert.equal(state.active,false,'source changes require acquisition');
state=tracker.update(teleported,400);assert.equal(state.visible,false,'unstable new candidates cannot retain an expired pose');
console.log('PASS: silhouette geometry, hand poses, mirror, acquisition, identity, motion and loss behavior');
