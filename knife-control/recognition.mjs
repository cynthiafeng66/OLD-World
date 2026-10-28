import {bounds,clamp} from './tracking-core.mjs?v=20261026-recognition';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const length=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0));
export const ACTION_LABELS={knife:'Knife',dough:'Dough',bread:'Make bread',explore:'Free exploration'};

// World-space joint lengths keep gestures independent of camera orientation.
export function classifyHand(landmarks,world,confidence=.9){
  if(landmarks?.length!==21 || confidence<.55)return null;
  const p=world?.length===21?world:landmarks,palm=length(p[0],p[9]);
  if(palm<.0001)return null;
  const fingers=[5,9,13,17].map(root=>{
    const reach=length(p[root],p[root+3]),path=length(p[root],p[root+1])+length(p[root+1],p[root+2])+length(p[root+2],p[root+3]);
    return {straight:reach/Math.max(path,.0001),reach:reach/palm,wrist:length(p[0],p[root+3])/Math.max(length(p[0],p[root+1]),.0001)};
  });
  const extended=fingers.map(f=>f.straight>.87 && f.reach>.5 && f.wrist>1.08);
  const curled=fingers.map(f=>f.wrist<1 && (f.straight<.8 || f.reach<.5));
  let action;
  if(extended[0] && extended[1] && curled[2] && curled[3])action='explore';
  else if(curled.every(Boolean))action='bread';
  else return null;
  const base={x:landmarks[0].x,y:landmarks[0].y};
  const tip=action==='explore'?{x:(landmarks[8].x+landmarks[12].x)/2,y:(landmarks[8].y+landmarks[12].y)/2}:{x:landmarks[9].x,y:landmarks[9].y};
  return {action,source:'hand',base,tip,box:bounds(landmarks),confidence,aspect:0};
}

// An object always wins, including while its holding hand is classified as a fist.
export function chooseRecognition(objects,hands,previous=null){
  const rank=list=>[...list].sort((a,b)=>{
    const score=c=>c.confidence-(previous?.action===c.action?distance(c.base,previous.base)*.6:0);
    return score(b)-score(a);
  })[0] || null;
  return rank(objects)||rank(hands);
}

function shape(points,w,h){
  const n=points.length;let sx=0,sy=0,sxx=0,syy=0,sxy=0,minX=w,minY=h,maxX=0,maxY=0;
  for(const i of points){const x=i%w,y=(i/w)|0;sx+=x;sy+=y;sxx+=x*x;syy+=y*y;sxy+=x*y;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
  const cx=sx/n,cy=sy/n,angle=.5*Math.atan2(2*(sxy/n-cx*cy),sxx/n-cx*cx-syy/n+cy*cy),vx=Math.cos(angle),vy=Math.sin(angle);
  let lo=Infinity,hi=-Infinity,left=Infinity,right=-Infinity;
  for(const i of points){const x=i%w-cx,y=((i/w)|0)-cy,t=x*vx+y*vy,s=-x*vy+y*vx;lo=Math.min(lo,t);hi=Math.max(hi,t);left=Math.min(left,s);right=Math.max(right,s);}
  const long=hi-lo+1,short=right-left+1,aspect=long/short,fill=n/(long*short);
  const bins=Array.from({length:10},()=>({lo:Infinity,hi:-Infinity,n:0}));
  for(const i of points){const x=i%w-cx,y=((i/w)|0)-cy,t=x*vx+y*vy,s=-x*vy+y*vx,k=clamp(Math.floor((t-lo)/long*10),0,9);bins[k].lo=Math.min(bins[k].lo,s);bins[k].hi=Math.max(bins[k].hi,s);bins[k].n++;}
  const widths=bins.map(b=>b.n?(b.hi-b.lo+1)/short:0);
  const ends=Math.min(widths[0],widths[9]);
  return {cx,cy,vx,vy,lo,hi,long,short,aspect,fill,ends,box:{x:minX/w,y:minY/h,right:maxX/w,bottom:maxY/h},a:{x:(cx+vx*lo)/w,y:(cy+vy*lo)/h},b:{x:(cx+vx*hi)/w,y:(cy+vy*hi)/h}};
}

// Colour regions describe shape rather than a particular prop's colour. Separate
// blade/object regions from the holding hand, so a grip cannot turn into a fist input.
export class ObjectRecognizer {
  constructor(width=256,height=192){this.width=width;this.height=height;this.visited=new Uint8Array(width*height);this.queue=new Int32Array(width*height);}
  detect(rgba,{hands=[],previous=null,threshold=34}={}){
    const w=this.width,h=this.height,visited=this.visited,queue=this.queue,candidates=[];
    const lum=new Float32Array(w*h),rg=new Float32Array(w*h),bg=new Float32Array(w*h);
    for(let i=0;i<w*h;i++){const j=i*4;lum[i]=(rgba[j]+rgba[j+1]+rgba[j+2])/3;rg[i]=rgba[j]-rgba[j+1];bg[i]=rgba[j+2]-rgba[j+1];}
    const handBoxes=hands.map(hand=>({box:bounds(hand),hand}));
    for(const tolerance of [0,24,42]){
      const whiteRegion=i=>lum[i]>140 && rg[i]>-45 && rg[i]<32 && bg[i]>-18 && bg[i]<55;
      visited.fill(0);
      for(let seedY=3;seedY<h-3;seedY+=4)for(let seedX=3;seedX<w-3;seedX+=4){
        const seed=seedY*w+seedX;if(visited[seed] || (!tolerance && !whiteRegion(seed)))continue;
        const sl=lum[seed],sr=rg[seed],sb=bg[seed],ct=clamp(threshold*.65,15,40);
        let head=0,n=1;queue[0]=seed;visited[seed]=1;
        while(head<n){const i=queue[head++],x=i%w,y=(i/w)|0;
          for(const j of [x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1]){
            if(j<0 || visited[j])continue;
            if(tolerance ? Math.abs(lum[j]-sl)>tolerance || Math.abs(rg[j]-sr)>ct || Math.abs(bg[j]-sb)>ct : !whiteRegion(j))continue;
            visited[j]=1;queue[n++]=j;
          }
        }
        if(n<85 || n>w*h*.29)continue;
        const points=queue.subarray(0,n),s=shape(points,w,h),{box,aspect,fill}=s;
        if(s.long<h*.16 || s.short<8 || box.x<.015 || box.right>.985 || box.y<.015 || box.bottom>.985)continue;
        // Reject a hand/forearm region, including its skin-coloured extensions.
        let body=false;
        for(const {hand,box:hb} of handBoxes){
          let inHand=0;for(const i of points){const x=i%w/w,y=((i/w)|0)/h;if(x>=hb.x&&x<=hb.right&&y>=hb.y&&y<=hb.bottom)inHand++;}
          const wrist=hand[0],palm=hand[9],ix=clamp(Math.round((wrist.x*.35+palm.x*.65)*w),0,w-1),iy=clamp(Math.round((wrist.y*.35+palm.y*.65)*h),0,h-1),pi=iy*w+ix;
          if(inHand/n>.47 || (rg[pi]>6 && Math.abs(rg[pi]-sr)<15 && Math.abs(bg[pi]-sb)<15 && Math.abs(lum[pi]-sl)<48 && inHand/n>.035)){body=true;break;}
        }
        if(body)continue;
        // Thin distant strips (chair rims, shelves) are not handheld props.
        if(hands.length && s.short<9 && !handBoxes.some(({box:hb})=>box.x<hb.right+.1 && box.right>hb.x-.1 && box.y<hb.bottom+.1 && box.bottom>hb.y-.1))continue;
        let action=null;
        const rectangular=aspect>=1.02 && aspect<=22 && fill>(aspect>2.2 ? .64 : .72) && s.ends>(aspect>2.2 ? .55 : .73);
        const blade=aspect>3.1 && aspect<22 && fill>.65 && s.ends>.28 && !(sr>15 && sl>60 && sb<12);
        if(rectangular||blade)action='knife';
        // The first reference is a soft, white, rounded bundle. Compact shape and
        // cool/neutral whites distinguish it from a flat rectangular white blade.
        const white=!tolerance || sl>155 && Math.abs(sr)<32 && sb>-18 && sb<45;
        if(!action && white && n>w*h*.012 && aspect<1.95 && fill>.57 && s.ends<.8)action='dough';
        if(!action)continue;
        // Require a real contour, not a patch of a smooth wall or lighting gradient.
        let contrast=0,edges=0;
        for(let k=0;k<n;k+=3){const i=points[k],x=i%w,y=(i/w)|0;for(const j of [i-3,i+3,i-w*3,i+w*3])if(j>=0&&j<w*h&&Math.abs((j%w)-x)<=3&&Math.abs(((j/w)|0)-y)<=3){const d=Math.abs(lum[j]-sl)+Math.abs(rg[j]-sr)+Math.abs(bg[j]-sb);if(d>tolerance+ct){contrast+=d;edges++;}}}
        if(edges<Math.sqrt(n)*.5 || contrast/edges<45)continue;
        let tip=previous?.action===action?(distance(s.a,previous.tip)<distance(s.b,previous.tip)?s.a:s.b):(s.a.y<s.b.y?s.a:s.b),end=tip===s.a?s.b:s.a;
        let base={x:end.x+(tip.x-end.x)*.14,y:end.y+(tip.y-end.y)*.14};
        if(action==='dough'){base={x:s.cx/w,y:(box.bottom+ s.cy/h)/2};tip={x:s.cx/w,y:box.y};}
        const confidence=clamp(.58+fill*.25+(action==='knife'?Math.min(aspect/20,.12):n/(w*h)),.6,.96);
        const candidate={action,source:'object',base,tip,box,aspect,confidence};
        if(!candidates.some(c=>c.action===action && distance(c.base,base)<.045))candidates.push(candidate);
      }
    }
    // A lit fold on the rounded white bundle can itself look blade-shaped.
    // Resolve overlapping white regions as one soft object before arbitration.
    const soft=candidates.filter(c=>c.action==='dough');
    const resolved=candidates.filter(c=>c.action!=='knife' || !soft.some(d=>{
      const overlap=Math.max(0,Math.min(c.box.right,d.box.right)-Math.max(c.box.x,d.box.x))*Math.max(0,Math.min(c.box.bottom,d.box.bottom)-Math.max(c.box.y,d.box.y));
      const area=(c.box.right-c.box.x)*(c.box.bottom-c.box.y);
      return overlap/area>.42 && (d.box.right-d.box.x)*(d.box.bottom-d.box.y)>area*1.1;
    }));
    return resolved.sort((a,b)=>{
      const score=c=>c.confidence+(previous?.action===c.action ? .04 : 0)-(previous?distance(c.base,previous.base)*.5:Math.abs((c.box.x+c.box.right)/2-.5)*.12);
      return score(b)-score(a);
    });
  }
}
