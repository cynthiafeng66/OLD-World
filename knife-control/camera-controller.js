import {SilhouetteDetector, PoseTracker} from './tracking-core.mjs?v=20261026-recognition';
import {ObjectRecognizer,classifyHand,chooseRecognition} from './recognition.mjs?v=20261026-recognition';

export class CameraKnifeController extends EventTarget {
  constructor({video, mirror=true, outputAspect=null}={}) {
    super();
    this.video=video || document.createElement('video');
    this.video.muted=true;this.video.playsInline=true;
    this.canvas=document.createElement('canvas');this.canvas.width=256;this.canvas.height=192;
    this.ctx=this.canvas.getContext('2d',{willReadFrequently:true});
    this.silhouettes=new SilhouetteDetector(256,192);this.objects=new ObjectRecognizer(256,192);
    this.tracker=new PoseTracker({mirror});
    this.outputAspect=outputAspect;
    this.mode='auto';this.threshold=34;this.flip=false;this.running=false;this.generation=0;
    this.onVisibility=()=>{if(document.hidden)this.stop();};
    document.addEventListener('visibilitychange',this.onVisibility);
  }
  emit(type,detail){this.dispatchEvent(new CustomEvent(type,{detail}));}
  async start() {
    this.stop();const generation=++this.generation;
    if(!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw Error('Open the page over localhost or HTTPS to use the camera.');
    let stream;
    try {
      stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:640},height:{ideal:480},frameRate:{ideal:30,max:30}}});
      if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
      this.stream=stream;this.video.srcObject=stream;await this.video.play();
      if(generation!==this.generation)return;
      const ratio=this.video.videoWidth/this.video.videoHeight;
      this.canvas.height=Math.round(256/ratio);this.silhouettes=new SilhouetteDetector(256,this.canvas.height);this.objects=new ObjectRecognizer(256,this.canvas.height);
      this.worker=new Worker(new URL('./hand-worker.js?v=20261026-recognition',import.meta.url));
      this.workerReady=false;this.workerFailed=false;this.workerBusy=false;this.handResult=null;this.previousObject=null;this.lastObjectAt=-Infinity;
      this.worker.onmessage=({data})=>{
        if(generation!==this.generation)return;
        if(data.type==='ready'){this.workerReady=true;clearTimeout(this.workerTimeout);this.emit('model',{ready:true});}
        if(data.type==='result'){this.workerBusy=false;this.handResult=data;}
        if(data.type==='error')this.disableWorker(data.message);
      };
      this.worker.onerror=e=>{e.preventDefault();this.disableWorker(e.message);};
      this.worker.postMessage({type:'init'});
      this.workerTimeout=setTimeout(()=>this.disableWorker('Hand tracking timed out'),20000);
      this.running=true;this.lastFrame=-Infinity;this.lastVideoTime=-1;this.lastHandFrame=-Infinity;
      stream.getVideoTracks()[0].onended=()=>this.stop();
      this.emit('state',{running:true});this.loop();
    } catch(error) {
      stream?.getTracks().forEach(t=>t.stop());
      if(generation===this.generation)this.stop();
      const messages={NotAllowedError:'Camera permission is blocked. Allow camera access in your browser and try again.',NotFoundError:'No camera was found.',NotReadableError:'The camera may be in use by another app. Close that app and try again.'};
      throw Error(messages[error.name] || error.message);
    }
  }
  disableWorker(message){
    clearTimeout(this.workerTimeout);this.worker?.terminate();this.worker=null;this.workerReady=false;this.workerBusy=false;this.handResult=null;
    this.workerFailed=true;this.emit('model',{ready:false,message});
  }
  stop() {
    this.generation++;this.running=false;cancelAnimationFrame(this.raf);clearTimeout(this.workerTimeout);
    this.worker?.terminate();this.worker=null;this.workerReady=false;this.workerBusy=false;this.handResult=null;
    this.stream?.getTracks().forEach(track=>{track.onended=null;track.stop();});this.stream=null;
    this.video.pause();this.video.srcObject=null;
    this.captureAt=0;this.backgroundSum=null;this.silhouettes.background=null;this.previousObject=null;this.lastObjectAt=-Infinity;
    this.tracker.reset();this.emit('pose',this.tracker.update(null,performance.now()));this.emit('state',{running:false});
  }
  setMode(mode){if(!['auto','hand','object'].includes(mode))throw Error('Unknown tracking mode');this.mode=mode;this.resetTracking();}
  resetTracking(){this.tracker.reset();this.previousObject=null;this.lastObjectAt=-Infinity;this.emit('pose',this.tracker.update(null,performance.now()));}
  captureBackground(){
    if(!this.running)return;
    this.captureAt=performance.now()+1800;this.backgroundSum=null;this.backgroundFrames=0;this.resetTracking();
    this.emit('calibration',{capturing:true});
  }
  async sendHandFrame(time) {
    this.workerBusy=true;const generation=this.generation;
    try {
      const bitmap=await createImageBitmap(this.video,{resizeWidth:640,resizeHeight:Math.round(640*this.video.videoHeight/this.video.videoWidth)});
      if(generation!==this.generation || !this.worker){bitmap.close();return;}
      this.worker.postMessage({type:'frame',bitmap,time},[bitmap]);
    } catch(error){if(generation===this.generation)this.disableWorker(error.message);}
  }
  loop=()=>{
    if(!this.running)return;
    this.raf=requestAnimationFrame(this.loop);
    const now=performance.now();
    if(now-this.lastFrame<40)return;
    // A stalled camera must not leave an interactive knife behind.
    if(this.video.readyState<2 || this.video.currentTime===this.lastVideoTime){
      if(now-this.lastFrame>150)this.emit('pose',this.tracker.update(null,now));
      return;
    }
    this.lastFrame=now;this.lastVideoTime=this.video.currentTime;
    try { this.processFrame(now); }
    catch(error){this.stop();this.emit('error',{message:'Camera processing failed: '+error.message});}
  };
  processFrame(now){
    const {width,height}=this.canvas;
    this.ctx.drawImage(this.video,0,0,width,height);
    const rgba=this.ctx.getImageData(0,0,width,height).data;
    if(this.workerReady && !this.workerBusy && now-this.lastHandFrame>65){this.lastHandFrame=now;this.sendHandFrame(now);}
    if(this.captureAt){
      if(now>this.captureAt-500){
        if(!this.backgroundSum)this.backgroundSum=new Float32Array(rgba.length);
        for(let i=0;i<rgba.length;i++)this.backgroundSum[i]+=rgba[i];
        this.backgroundFrames++;
      }
      if(now>=this.captureAt){
        const bg=new Uint8ClampedArray(rgba.length);
        for(let i=0;i<rgba.length;i++)bg[i]=this.backgroundSum[i]/this.backgroundFrames;
        this.silhouettes.capture(bg);this.captureAt=0;this.backgroundSum=null;
        this.emit('calibration',{capturing:false,ready:true});
      }
      this.emit('pose',this.tracker.update(null,now));return;
    }
    const result=this.handResult && now-this.handResult.time<200 ? this.handResult : null;
    // Shape recognition runs first; a holding fist never overrides its prop.
    let objects=[];
    const maskHands=this.handResult && now-this.handResult.time<700 ? this.handResult.landmarks : [];
    if(this.mode!=='hand' && (this.mode==='object' || this.handResult || this.workerFailed)){
      objects=this.objects.detect(rgba,{threshold:this.threshold,previous:this.previousObject,hands:maskHands});
      // Background capture remains useful for textured props. Hand-connected
      // silhouettes are excluded here: their grip is already handled above.
      if(!objects.length && !maskHands.length)objects=this.silhouettes.detect(rgba,{threshold:this.threshold,previous:this.previousObject}).map(p=>({...p,action:'knife'}));
    }
    const hands=this.mode!=='object' && result ? result.landmarks.map((p,i)=>classifyHand(p,result.world[i])).filter(Boolean) : [];
    if(objects.length)this.lastObjectAt=now;
    const eligibleHands=now-this.lastObjectAt<280?[]:hands;
    let candidate=chooseRecognition(objects,eligibleHands,this.rawCandidate);
    if(candidate?.source==='object'){
      this.previousObject=candidate;
      if(this.flip && candidate.action==='knife')candidate={...candidate,base:{...candidate.tip},tip:{...candidate.base}};
    }else if(now-this.lastObjectAt>280)this.previousObject=null;
    this.rawCandidate=candidate;
    const pose=this.tracker.update(candidate,now,this.outputAspect?.() || width/height);
    this.emit('pose',pose);
  }
  destroy(){this.stop();document.removeEventListener('visibilitychange',this.onVisibility);}
}
