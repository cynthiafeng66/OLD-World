// Pure geometry and tracking; coordinates are normalized, unmirrored camera pixels.
export const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const mix = (a, b, t) => a + (b - a) * t;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const length3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
export function bounds(points) {
  return { x: Math.min(...points.map(p => p.x)), y: Math.min(...points.map(p => p.y)),
    right: Math.max(...points.map(p => p.x)), bottom: Math.max(...points.map(p => p.y)) };
}

// Four extended, roughly parallel fingers held together. A fist, pointing finger,
// peace sign and widely spread palm should not activate the knife.
export function handKnife(landmarks, world, confidence = .9) {
  if (landmarks?.length !== 21 || confidence < .55) return null;
  const p = world?.length === 21 ? world : landmarks;
  const palm = length3(p[0], p[9]);
  if (palm < .0001) return null;
  let extended = 0;
  const vectors = [];
  for (const root of [5, 9, 13, 17]) {
    const a = p[root], b = p[root + 1], c = p[root + 2], d = p[root + 3];
    const reach = length3(a, d), path = length3(a, b) + length3(b, c) + length3(c, d);
    if (reach / Math.max(path, .0001) > .86 && reach > palm * .5 &&
        length3(p[0], d) > length3(p[0], b) * 1.12) extended++;
    vectors.push({x:(d.x-a.x)/Math.max(reach,.0001), y:(d.y-a.y)/Math.max(reach,.0001), z:((d.z||0)-(a.z||0))/Math.max(reach,.0001)});
  }
  const parallel = vectors.slice(1).every(v => v.x*vectors[0].x + v.y*vectors[0].y + v.z*vectors[0].z > .72);
  const spread = length3(p[8], p[20]) / palm;
  if (extended < 3 || !parallel || spread > .95) return null;
  const tip = { x: (landmarks[8].x + landmarks[12].x) / 2, y: (landmarks[8].y + landmarks[12].y) / 2 };
  const base = { x: landmarks[0].x, y: landmarks[0].y };
  if (distance(base, tip) < .07) return null;
  return {source:'hand', base, tip, box:bounds(landmarks), confidence:clamp(confidence * (extended / 4)), aspect:0};
}

// Fixed-camera foreground separation + connected components + principal axis.
// This recognizes an elongated silhouette, not object semantics or real thickness.
export class SilhouetteDetector {
  constructor(width = 256, height = 192) {
    this.width = width; this.height = height;
    this.mask = new Uint8Array(width * height);
    this.clean = new Uint8Array(width * height);
    this.queue = new Int32Array(width * height);
    this.background = null;
  }
  capture(rgba) { this.background = new Uint8ClampedArray(rgba); }
  detect(rgba, {threshold = 34, previous = null, hands = []} = {}) {
    if (!this.background) return [];
    const {width:w, height:h, mask, clean, queue, background:bg} = this;
    // Remove a global exposure shift; do not absorb a stationary toy into the background.
    let shift = 0;
    for (let i=0; i<w*h; i+=8) shift += (rgba[i*4]+rgba[i*4+1]+rgba[i*4+2]-bg[i*4]-bg[i*4+1]-bg[i*4+2])/3;
    shift /= Math.ceil(w*h/8);
    for (let i=0; i<w*h; i++) {
      const j=i*4;
      mask[i] = (Math.abs(rgba[j]-bg[j]-shift)+Math.abs(rgba[j+1]-bg[j+1]-shift)+Math.abs(rgba[j+2]-bg[j+2]-shift))/3 > threshold ? 1 : 0;
    }
    clean.fill(0);
    for (let y=1;y<h-1;y++) for (let x=1;x<w-1;x++) {
      const i=y*w+x;
      if (mask[i] && mask[i-1]+mask[i+1]+mask[i-w]+mask[i+w]+mask[i-w-1]+mask[i+w+1]+mask[i-w+1]+mask[i+w-1]>=4) clean[i]=1;
    }
    const candidates=[];
    for (let seed=0;seed<clean.length;seed++) {
      if (!clean[seed]) continue;
      let head=0, count=1, sx=0, sy=0, sxx=0, syy=0, sxy=0;
      let minX=w,maxX=0,minY=h,maxY=0;
      queue[0]=seed; clean[seed]=0;
      while(head<count) {
        const i=queue[head++], x=i%w, y=(i/w)|0;
        sx+=x;sy+=y;sxx+=x*x;syy+=y*y;sxy+=x*y;
        minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
        for (const n of [i-1,i+1,i-w,i+w]) {
          if (n>=0 && n<clean.length && clean[n] && (Math.abs(n%w-x)+Math.abs(((n/w)|0)-y)===1)) {clean[n]=0;queue[count++]=n;}
        }
      }
      if (count<65 || count>w*h*.34) continue;
      const cx=sx/count,cy=sy/count,xx=sxx/count-cx*cx,yy=syy/count-cy*cy,xy=sxy/count-cx*cy;
      const angle=.5*Math.atan2(2*xy,xx-yy),vx=Math.cos(angle),vy=Math.sin(angle);
      let lo=Infinity,hi=-Infinity,sideLo=Infinity,sideHi=-Infinity;
      for(let j=0;j<count;j++){const x=queue[j]%w-cx,y=((queue[j]/w)|0)-cy,t=x*vx+y*vy,s=-x*vy+y*vx;lo=Math.min(lo,t);hi=Math.max(hi,t);sideLo=Math.min(sideLo,s);sideHi=Math.max(sideHi,s);}
      const long=hi-lo,short=sideHi-sideLo,aspect=long/Math.max(1,short),fill=count/Math.max(1,long*short);
      if (aspect<2.35 || aspect>20 || long<h*.17 || short<3 || fill<.24) continue;
      let a={x:(cx+vx*lo)/w,y:(cy+vy*lo)/h}, b={x:(cx+vx*hi)/w,y:(cy+vy*hi)/h};
      const box={x:minX/w,y:minY/h,right:maxX/w,bottom:maxY/h};
      const grip=hands.find(hand=>hand[0].x>=box.x-.04 && hand[0].x<=box.right+.04 && hand[0].y>=box.y-.04 && hand[0].y<=box.bottom+.04);
      // A recognized open/folded hand plus its forearm is not a toy knife.
      if (grip && distance(a,b) < distance(grip[0],grip[12])*1.65) continue;
      let tip,base;
      if (grip) {
        const center={x:(grip[0].x+grip[9].x)/2,y:(grip[0].y+grip[9].y)/2};
        tip=distance(a,center)>distance(b,center)?a:b;
        const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((center.x-a.x)*dx+(center.y-a.y)*dy)/(dx*dx+dy*dy));
        base={x:a.x+t*dx,y:a.y+t*dy};
      } else {
        tip=previous?.source==='object' ? (distance(a,previous.tip)<distance(b,previous.tip)?a:b) : (a.y<b.y?a:b);
        const end=tip===a?b:a;
        base={x:mix(end.x,tip.x,.14),y:mix(end.y,tip.y,.14)};
      }
      // Apply user flip only at the controller layer; continuity uses the raw axis.
      candidates.push({source:'object',base,tip,box,aspect,confidence:clamp(.45+(aspect-2.35)*.065+fill*.2,.45,.94)});
    }
    return candidates.sort((a,b)=>{
      const score=c=>c.confidence-(previous?distance(c.base,previous.base)*1.4:0);
      return score(b)-score(a);
    });
  }
}

export class PoseTracker {
  constructor({acquireFrames=3, lossMs=180, mirror=true}={}) {
    this.acquireFrames=acquireFrames;this.lossMs=lossMs;this.mirror=mirror;this.reset();
  }
  reset(){this.pose=null;this.pending=null;this.hits=0;this.lastSeen=-Infinity;this.lastTime=0;this.path=[];this.sweep=null;this.lastActive=false;this.aspect=4/3;}
  update(candidate, time, aspect=4/3) {
    this.aspect=aspect;
    if(time-this.lastSeen>this.lossMs)this.pose=null;
    // Missing detections stop interaction immediately. Retained pose is visual only.
    if(!candidate){this.sweep=null;this.hits=0;this.pending=null;this.path=[];if(time-this.lastSeen>this.lossMs)this.pose=null;return this.snapshot(time,false);}
    const convert=p=>({x:clamp(this.mirror?1-p.x:p.x),y:clamp(p.y)});
    const next={...candidate,action:candidate.action || 'knife',base:convert(candidate.base),tip:convert(candidate.tip)};
    const previous=this.pose;
    const same=previous && previous.source===next.source && previous.action===next.action && distance(previous.base,next.base)<.23 && distance(previous.tip,next.tip)<.35 && time-this.lastSeen<150;
    if(!same){
      const stable=this.pending?.source===next.source && this.pending?.action===next.action && distance(this.pending.base,next.base)<.12;
      this.hits=stable?this.hits+1:1;this.pending=next;
      if(this.hits<this.acquireFrames){this.sweep=null;return this.snapshot(time,false);}
      this.pose=next;this.path=[];this.sweep=null;
    } else {
      const dt=clamp((time-this.lastTime)/1000,.008,.15);
      const speed=distance(previous.tip,next.tip)/dt;
      // Low jitter while resting, reduced latency when swinging.
      const alpha=1-Math.exp(-2*Math.PI*(2.5+Math.min(speed*3,14))*dt);
      const blend=(a,b)=>({x:mix(a.x,b.x,alpha),y:mix(a.y,b.y,alpha)});
      this.pose={...next,base:blend(previous.base,next.base),tip:blend(previous.tip,next.tip)};
      this.sweep=this.lastActive && next.action==='knife'?{from:{...previous.tip},to:{...this.pose.tip}}:null;
    }
    const dt=Math.max(.008,(time-this.lastTime)/1000);
    const speed=this.sweep?Math.hypot((this.sweep.to.x-this.sweep.from.x)*aspect,this.sweep.to.y-this.sweep.from.y)/dt:0;
    this.lastSeen=time;this.lastTime=time;this.lastActive=true;
    if(next.action==='knife')this.path.push({...this.pose.tip,time});else this.path=[];this.path=this.path.filter(p=>time-p.time<450).slice(-32);
    return this.snapshot(time,true,speed);
  }
  snapshot(time,active,speed=0){
    if(!active)this.lastActive=false;
    return {active,visible:!!this.pose,pose:this.pose?structuredClone(this.pose):null,speed,
      angle:this.pose?Math.atan2(-(this.pose.tip.y-this.pose.base.y),(this.pose.tip.x-this.pose.base.x)*this.aspect):0,
      sweep:active?this.sweep:null,trail:active?this.path.map(p=>({...p})):[],timestamp:time};
  }
}
