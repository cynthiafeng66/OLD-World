import * as T from 'three';
import {CameraKnifeController} from './camera-controller.js?v=20261026-recognition';

import {ACTION_LABELS} from './recognition.mjs?v=20261026-recognition';

export function installKitchenKnife({scene,camera,invalidate,onRecognition}) {
  const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./knife-input.css?v=20261027-clean-ui',import.meta.url);document.head.append(css);
  const panel=document.createElement('section');panel.id='knife-input';panel.setAttribute('aria-label','Camera interaction');
  panel.innerHTML=`
    <div class="knife-heading"><h2>Camera interaction</h2><button id="knife-collapse" aria-expanded="true" title="Collapse or expand panel">Collapse</button></div>
    <div id="knife-body">
      <p class="knife-intro">Rounded white prop → Dough<br>Rectangular prop / toy knife → Knife<br>Fist → Make bread · V sign → Free exploration</p>
      <div class="knife-preview"><canvas id="knife-preview" width="320" height="240"></canvas><span id="knife-badge">Camera off</span></div>
      <div id="knife-action" role="status" aria-live="polite">Ready to recognize</div>
      <p id="knife-message" role="status" aria-live="polite">Show a prop or gesture. Objects take priority over hand gestures.</p>
      <div class="knife-row"><button id="knife-start" class="primary">Start camera</button><button id="knife-background" disabled>Capture background</button></div>
      <label class="knife-label">Tracking mode<select id="knife-mode"><option value="auto">Auto · Objects first</option><option value="hand">Hand gesture only</option><option value="object">Objects only</option></select></label>
      <div class="knife-row"><label class="knife-threshold">Sensitivity <input id="knife-threshold" type="range" min="15" max="80" value="34" aria-label="Sensitivity"><output id="knife-threshold-value">34</output></label><button id="knife-flip" aria-pressed="false" title="Reverse the prop tip direction">Flip tip</button></div>
      <p class="knife-footnote">Use a clear view of the prop. Capture the background if needed. Movement is mirrored. You can move the room camera freely. Video stays on this device.</p>
    </div>`;
  document.body.append(panel);
  const $=id=>panel.querySelector('#'+id),preview=$('knife-preview'),ctx=preview.getContext('2d');
  const trailCanvas=document.createElement('canvas');trailCanvas.id='knife-trail';trailCanvas.setAttribute('aria-hidden','true');document.body.append(trailCanvas);
  const trailCtx=trailCanvas.getContext('2d');
  const resize=()=>{trailCanvas.width=innerWidth;trailCanvas.height=innerHeight;};resize();addEventListener('resize',resize);
  const controller=new CameraKnifeController({outputAspect:()=>innerWidth/innerHeight});

  // A camera-relative 3D knife, positioned at the wrist/grip, with its tip mapped
  // to the tracked fingertip/object endpoint. Kept outside the exported room.
  const knife=new T.Group();knife.name='Camera_Controlled_Knife';knife.visible=false;
  scene.add(camera);camera.add(knife);
  const bladeShape=new T.Shape();bladeShape.moveTo(-.038,.125);bladeShape.lineTo(.034,.125);bladeShape.lineTo(.034,.45);bladeShape.quadraticCurveTo(-.033,.417,-.038,.30);bladeShape.closePath();
  const blade=new T.Mesh(new T.ExtrudeGeometry(bladeShape,{depth:.006,bevelEnabled:true,bevelThickness:.0015,bevelSize:.0015,bevelSegments:1,steps:1}),new T.MeshStandardMaterial({color:0xe8e8db,metalness:.82,roughness:.25,depthTest:false}));
  const handle=new T.Mesh(new T.BoxGeometry(.048,.125,.026),new T.MeshStandardMaterial({color:0x3b2520,roughness:.7,depthTest:false}));handle.position.y=.0625;
  const guard=new T.Mesh(new T.BoxGeometry(.085,.014,.035),new T.MeshStandardMaterial({color:0xc7bfa7,metalness:.75,roughness:.3,depthTest:false}));guard.position.y=.125;
  knife.add(blade,handle,guard);knife.traverse(o=>{if(o.isMesh){o.renderOrder=1000;o.material.depthWrite=false;}});
  const dough=new T.Group();dough.name='Camera_Controlled_Dough';dough.visible=false;camera.add(dough);
  const doughMaterial=new T.MeshStandardMaterial({color:0xffe5ba,roughness:.96,depthTest:false,depthWrite:false});
  for(const [x,y,z,sx,sy,sz] of [[0,0,0,.11,.075,.075],[-.055,.022,.025,.067,.05,.055],[.05,.014,.033,.065,.052,.05]]){
    const lump=new T.Mesh(new T.SphereGeometry(1,24,16),doughMaterial);lump.position.set(x,y,z);lump.scale.set(sx,sy,sz);lump.renderOrder=1000;dough.add(lump);
  }
  let latest=null,modelState='loading',capturing=false,starting=false,lastMessage='', previewRaf;
  const message=text=>{if(lastMessage!==text){$('knife-message').textContent=text;lastMessage=text;}};
  function applyPose(state){
    latest=state;
    const action=state.pose?.action;
    knife.visible=state.visible && action==='knife';
    dough.visible=state.visible && (action==='dough' || action==='bread');
    $('knife-action').textContent=state.active ? ACTION_LABELS[action] : 'Ready to recognize';
    panel.dataset.action=state.active?action:'idle';
    if(state.pose){
      const {base,tip}=state.pose,distance=.8,halfHeight=Math.tan(T.MathUtils.degToRad(camera.fov/2))*distance,halfWidth=halfHeight*camera.aspect;
      knife.position.set((base.x*2-1)*halfWidth,(1-base.y*2)*halfHeight,-distance);
      dough.position.copy(knife.position);
      const span=Math.hypot((tip.x-base.x)*2*halfWidth,(tip.y-base.y)*2*halfHeight);
      const size=T.MathUtils.clamp(span/.2,.35,1.8);dough.scale.set(size,size*(action==='bread' ? .75 : 1),size);
      doughMaterial.transparent=!state.active;doughMaterial.opacity=state.active?1:.25;
      const dx=(tip.x-base.x)*2*halfWidth,dy=-(tip.y-base.y)*2*halfHeight;
      knife.rotation.z=Math.atan2(dy,dx)-Math.PI/2;
      knife.scale.setScalar(Math.hypot(dx,dy)/.45);
      knife.traverse(o=>{if(o.isMesh){o.material.transparent=!state.active;o.material.opacity=state.active?1:.25;}});
    }
    invalidate();
    // Integration contract: pixel-independent positions, speed in screen heights/s,
    // and a continuous knife-tip segment. Check active before acting on this input.
    const recognition={...state,action:state.active?action:null,label:state.active?ACTION_LABELS[action]:null};
    onRecognition?.(recognition);
    window.dispatchEvent(new CustomEvent('kitchen:recognition',{detail:recognition}));
    const knifeInput=action==='knife'?state:{...state,active:false,visible:false,pose:null,speed:0,sweep:null,trail:[]};
    window.dispatchEvent(new CustomEvent('kitchen:knife-input',{detail:knifeInput}));
  }
  controller.addEventListener('pose',({detail})=>{
    applyPose(detail);
    if(!controller.running || capturing)return;
    if(detail.active){
      const action=detail.pose.action;
      $('knife-badge').textContent=ACTION_LABELS[action]+' · '+Math.round(detail.pose.confidence*100)+'%';
      const messages={knife:'Knife · Move and rotate the prop to control the blade. Objects override fists.',dough:'Dough · Rounded white prop recognized. Move it to position the dough.',bread:'Make bread · Fist recognized. Move your fist to knead.',explore:'Free exploration · V sign recognized. Drag to look around and scroll to move closer.'};
      message(messages[action]);
    } else {
      $('knife-badge').textContent='Waiting for tracking';
      if(modelState==='failed' && controller.mode!=='object')message('Hand tracking is unavailable. Restart the camera. Object recognition is still available.');

      else if(modelState==='loading' && controller.mode!=='object')message('Loading local hand tracking…');
      else message('Show a rounded white prop, rectangular prop, fist or V sign. Objects take priority.');
    }
  });
  function drawPreview(){
    ctx.clearRect(0,0,preview.width,preview.height);ctx.fillStyle='rgba(255,255,255,.35)';ctx.fillRect(0,0,preview.width,preview.height);
    if(controller.running && controller.video.readyState>=2){
      ctx.save();ctx.translate(preview.width,0);ctx.scale(-1,1);ctx.drawImage(controller.video,0,0,preview.width,preview.height);ctx.restore();
      if(latest?.active && latest.pose){
        const {box,base,tip}=latest.pose;ctx.strokeStyle='#ff8794';ctx.lineWidth=2;
        ctx.strokeRect((1-box.right)*preview.width,box.y*preview.height,(box.right-box.x)*preview.width,(box.bottom-box.y)*preview.height);
        ctx.fillStyle='#ff8794';const label=ACTION_LABELS[latest.pose.action];ctx.font='13px sans-serif';
        const x=Math.max(0,(1-box.right)*preview.width),y=Math.max(20,box.y*preview.height);ctx.fillRect(x,y-20,Math.max(108,ctx.measureText(label).width+12),20);ctx.fillStyle='#221e21';ctx.fillText(label,x+5,y-5);
        ctx.strokeStyle='#e9ffbc';ctx.beginPath();ctx.moveTo(base.x*preview.width,base.y*preview.height);ctx.lineTo(tip.x*preview.width,tip.y*preview.height);ctx.stroke();
        ctx.fillStyle='#e9ffbc';ctx.beginPath();ctx.arc(base.x*preview.width,base.y*preview.height,5,0,Math.PI*2);ctx.fill();
      }
    } else {ctx.fillStyle='#58665b';ctx.font='13px sans-serif';ctx.textAlign='center';ctx.fillText('Show a prop, fist or V sign',preview.width/2,preview.height/2);ctx.textAlign='start';}
    trailCtx.clearRect(0,0,trailCanvas.width,trailCanvas.height);
    if(latest?.active){
      const path=latest.trail.filter(p=>performance.now()-p.time<450);
      for(let i=1;i<path.length;i++){
        trailCtx.strokeStyle=`rgba(255,235,184,${i/path.length*.65})`;trailCtx.lineWidth=1+i/path.length*4;trailCtx.lineCap='round';
        trailCtx.beginPath();trailCtx.moveTo(path[i-1].x*innerWidth,path[i-1].y*innerHeight);trailCtx.lineTo(path[i].x*innerWidth,path[i].y*innerHeight);trailCtx.stroke();
      }
    }
    previewRaf=requestAnimationFrame(drawPreview);
  }drawPreview();
  controller.addEventListener('state',({detail})=>{
    $('knife-background').disabled=!detail.running;$('knife-start').textContent=detail.running?'Stop camera':'Start camera';
    if(!detail.running){capturing=false;$('knife-background').textContent='Capture background';$('knife-badge').textContent='Camera off';message('Show a prop or gesture. Objects take priority over hand gestures.');}
  });
  controller.addEventListener('model',({detail})=>{modelState=detail.ready?'ready':'failed';if(!detail.ready)console.warn('Hand tracking unavailable; prop tracking is still available: ',detail.message);});
  controller.addEventListener('error',({detail})=>message(detail.message));
  controller.addEventListener('calibration',({detail})=>{
    capturing=detail.capturing;$('knife-background').disabled=capturing;
    $('knife-background').textContent=capturing?'Capturing…':'Recapture background';
    if(capturing){$('knife-badge').textContent='Move hands and props out of view';message('Capturing for 1.8 seconds. Keep the camera and background still.');}
    else message('Background captured. Bring a rectangular prop or rounded white prop into view.');
  });
  $('knife-start').onclick=async()=>{
    if(starting)return;
    if(controller.running){controller.stop();return;}
    starting=true;modelState='loading';$('knife-start').disabled=true;
    try{await controller.start();}catch(error){message(error.message);}
    finally{starting=false;$('knife-start').disabled=false;}
  };
  $('knife-background').onclick=()=>controller.captureBackground();
  $('knife-mode').onchange=e=>controller.setMode(e.target.value);
  $('knife-threshold').oninput=e=>{controller.threshold=Number(e.target.value);$('knife-threshold-value').value=e.target.value;};
  $('knife-flip').onclick=()=>{controller.flip=!controller.flip;$('knife-flip').setAttribute('aria-pressed',String(controller.flip));controller.resetTracking();};
  $('knife-collapse').onclick=()=>{const body=$('knife-body');body.hidden=!body.hidden;$('knife-collapse').textContent=body.hidden?'Expand':'Collapse';$('knife-collapse').setAttribute('aria-expanded',String(!body.hidden));};
  const onResize=()=>{if(latest)applyPose(latest);};addEventListener('resize',onResize);
  const onPageHide=()=>controller.stop();addEventListener('pagehide',onPageHide);
  return {controller,knife,dough,get state(){return latest;},destroy(){controller.destroy();cancelAnimationFrame(previewRaf);removeEventListener('resize',resize);removeEventListener('resize',onResize);removeEventListener('pagehide',onPageHide);panel.remove();trailCanvas.remove();knife.removeFromParent();dough.removeFromParent();dough.children.forEach(o=>o.geometry.dispose());doughMaterial.dispose();knife.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});css.remove();}};
}
