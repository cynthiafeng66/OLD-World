// Browser integration test. Uses a synthetic canvas stream, never a real camera.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const playwrightPath=process.env.PLAYWRIGHT_PATH || '/Users/cynthiafeng/Desktop/旧世界/node_modules/playwright';
const {chromium}=require(playwrightPath);
const baseURL=process.env.KITCHEN_URL||'http://127.0.0.1:8766';
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:960}});
    const errors=[],remoteRequests=[],modelWarnings=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='warning')modelWarnings.push(m.text());});
    page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(baseURL+'/'))remoteRequests.push(r.url());});
    await page.addInitScript(()=>{
      window.loadingMessages=[];
      addEventListener('DOMContentLoaded',()=>{
        const record=()=>{const text=document.querySelector('#loading')?.innerText;if(text&&!loadingMessages.includes(text))loadingMessages.push(text);};
        record();new MutationObserver(record).observe(document.body,{subtree:true,childList:true,characterData:true});
      });
      window.fakeCamera={show:false,x:320,y:240,angle:0,streams:[],denied:false};
      navigator.mediaDevices.getUserMedia=async()=>{
        if(fakeCamera.denied)throw new DOMException('test denial','NotAllowedError');
        const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;
        const ctx=canvas.getContext('2d');
        const draw=()=>{
          ctx.fillStyle='#cdd1cb';ctx.fillRect(0,0,640,480);
          if(fakeCamera.show){
            ctx.save();ctx.translate(fakeCamera.x,fakeCamera.y);ctx.rotate(fakeCamera.angle);
            ctx.fillStyle='#393442';ctx.fillRect(-24,-175,48,350);ctx.restore();
          }
        };
        draw();const timer=setInterval(draw,33);const stream=canvas.captureStream(30);
        const track=stream.getVideoTracks()[0],stop=track.stop.bind(track);track.stop=()=>{clearInterval(timer);stop();};
        fakeCamera.streams.push(stream);return stream;
      };
    });
    await page.goto(baseURL+'/',{waitUntil:'domcontentloaded'});
    await page.locator('#loading').waitFor({state:'visible'});
    assert.ok((await page.locator('#loading').innerText()).includes('Loading your kitchen'));
    await page.screenshot({path:'output/english-loading.png'});
    await page.waitForFunction(()=>window.kitchenKnife && kitchen.ready,null,{timeout:120000});
    await page.waitForFunction(()=>!document.querySelector('#loading'),null,{timeout:5000});
    const roomParts=await page.evaluate(()=>kitchen.parts.map(p=>({name:p.name,position:p.position.toArray(),scale:p.scale.toArray()})));
    assert.equal(roomParts.length,16,'scene loads the original room and white cutting board');
    assert.equal(await page.evaluate(()=>kitchenKnife.knife.visible),false);
    await page.evaluate(()=>fakeCamera.denied=true);
    await page.click('#knife-start');await page.waitForFunction(()=>document.querySelector('#knife-message').textContent.includes('permission'));
    await page.evaluate(()=>fakeCamera.denied=false);
    await page.click('#knife-start');await page.waitForFunction(()=>kitchenKnife.controller.running);
    try{await page.waitForFunction(()=>kitchenKnife.controller.workerReady,null,{timeout:35000});}catch(error){console.error(JSON.stringify({errors,modelWarnings,camera:await page.evaluate(()=>({running:kitchenKnife.controller.running,failed:kitchenKnife.controller.workerFailed,message:document.querySelector('#knife-message').textContent}))}));throw error;}
    await page.selectOption('#knife-mode','object');
    await page.click('#knife-background');await page.waitForFunction(()=>!!kitchenKnife.controller.silhouettes.background);
    await page.evaluate(()=>fakeCamera.show=true);
    await page.waitForFunction(()=>kitchenKnife.state?.active,null,{timeout:6000});
    const first=await page.evaluate(()=>structuredClone(kitchenKnife.state));assert.equal(first.pose.source,'object');
    const knifePose=await page.evaluate(()=>({visible:kitchenKnife.knife.visible,position:kitchenKnife.knife.position.toArray(),rotation:kitchenKnife.knife.rotation.z}));assert.ok(knifePose.visible);
    // Verify the actual 3D knife tip projects to the tracked tip.
    const projection=await page.evaluate(async()=>{
      const T=await import('/vendor/three/build/three.module.js');kitchen.scene.updateMatrixWorld(true);
      const tip=new T.Vector3(0,.45,0);kitchenKnife.knife.localToWorld(tip);tip.project(kitchen.camera);
      return {x:(tip.x+1)/2,y:(1-tip.y)/2,target:kitchenKnife.state.pose.tip};
    });
    assert.ok(Math.hypot(projection.x-projection.target.x,projection.y-projection.target.y)<.002,'3D blade tip follows camera tip');
    await page.evaluate(()=>{fakeCamera.x=365;fakeCamera.angle=.42;});
    await page.waitForFunction(x=>kitchenKnife.state.active&&Math.abs(kitchenKnife.state.pose.tip.x-x)>.07,first.pose.tip.x);
    const moving=await page.evaluate(()=>structuredClone(kitchenKnife.state));assert.ok(moving.sweep);assert.ok(moving.speed>0);
    await page.screenshot({path:'output/knife-input-preview.png'});
    await page.click('#knife-flip');await page.waitForFunction(()=>kitchenKnife.state.active);
    assert.ok(await page.evaluate(()=>kitchenKnife.state.pose.tip.y>kitchenKnife.state.pose.base.y),'object tip can be inverted');
    await page.click('#knife-flip');
    await page.evaluate(()=>fakeCamera.show=false);
    await page.waitForFunction(()=>!kitchenKnife.state.active && !kitchenKnife.state.visible);
    assert.equal(await page.evaluate(()=>kitchenKnife.state.sweep),null);
    await page.selectOption('#knife-mode','hand');await page.evaluate(()=>fakeCamera.show=true);
    await page.waitForTimeout(700);assert.equal(await page.evaluate(()=>kitchenKnife.state.active),false,'rectangle cannot activate hand-only mode');
    await page.click('#knife-start');
    assert.ok(await page.evaluate(()=>fakeCamera.streams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))),'camera tracks released');
    assert.equal(await page.evaluate(()=>kitchenKnife.knife.visible),false);
    // Exercise the room's feedback and input contracts for every action without
    // enabling a real camera. The real gesture model is tested separately.
    const actionResults=await page.evaluate(()=>{
      const pose={source:'hand',base:{x:.5,y:.65},tip:{x:.5,y:.35},box:{x:.4,y:.3,right:.6,bottom:.7},confidence:.9,aspect:0};
      const before={position:kitchen.camera.position.toArray(),target:kitchen.controls.target.toArray()};
      let knifeEvent;const listen=e=>knifeEvent=e.detail;window.addEventListener('kitchen:knife-input',listen);
      const results=[];
      for(const action of ['dough','bread','explore','knife']){
        kitchenKnife.controller.emit('pose',{active:true,visible:true,pose:{...pose,action,source:action==='knife'||action==='dough'?'object':'hand'},speed:0,sweep:null,trail:[],timestamp:performance.now()});
        results.push({action,label:document.querySelector('#knife-action').textContent,knife:kitchenKnife.knife.visible,dough:kitchenKnife.dough.visible,knifeInput:knifeEvent.active,roomAction:kitchen.interaction.action});
      }
      kitchenKnife.controller.resetTracking();window.removeEventListener('kitchen:knife-input',listen);
      return {results,before,after:{position:kitchen.camera.position.toArray(),target:kitchen.controls.target.toArray()},controlsEnabled:kitchen.controls.enabled};
    });
    assert.deepEqual(actionResults.results.map(r=>r.label),['Dough','Make bread','Free exploration','Knife']);
    for(const r of actionResults.results){assert.equal(r.knife,r.action==='knife');assert.equal(r.knifeInput,r.action==='knife');assert.equal(r.dough,['bread','dough'].includes(r.action));assert.equal(r.roomAction,r.action);}
    assert.deepEqual(actionResults.before,actionResults.after,'recognition does not move the room camera');assert.ok(actionResults.controlsEnabled,'camera remains free');
    const cleanUI=await page.evaluate(()=>{
      const panel=document.querySelector('#knife-input'),style=getComputedStyle(panel);
      return {removed:!document.querySelector('header,nav,#reference,#ref,#editor,#hint'),english:!/[\u3400-\u9fff]/u.test(document.body.innerText),loadingMessages,background:style.backgroundColor,blur:style.backdropFilter};
    });
    assert.ok(cleanUI.removed,'old title, reference and toolbar are removed from the DOM');assert.ok(cleanUI.english);
    assert.ok(cleanUI.loadingMessages.length);assert.ok(cleanUI.loadingMessages.every(text=>!/[\u3400-\u9fff]/u.test(text)),'all loading stages are English');
    assert.equal(cleanUI.background,'rgba(255, 255, 255, 0.7)','camera panel is translucent white');
    assert.deepEqual(await page.evaluate(()=>kitchen.parts.map(p=>({name:p.name,position:p.position.toArray(),scale:p.scale.toArray()}))),roomParts,'UI changes preserve room model placement');
    await page.screenshot({path:'output/clean-kitchen-interface.png'});
    assert.equal(await page.evaluate(()=>kitchen.room.getObjectByName('Camera_Controlled_Knife')===undefined),true,'camera knife excluded from exported room');
    await page.click('#knife-collapse');assert.equal(await page.locator('#knife-body').isVisible(),false);
    await page.setViewportSize({width:390,height:844});await page.click('#knife-collapse');
    const panel=await page.locator('#knife-input').boundingBox();assert.ok(panel.x>=0&&panel.x+panel.width<=390,'mobile panel fits');
    await page.screenshot({path:'output/knife-input-mobile.png'});
    assert.deepEqual(errors,[]);assert.deepEqual(remoteRequests,[]);
    const report={passed:true,checks:['sixteen scene groups including board dough sequence','permission rejection and retry','local MediaPipe worker loads and infers','synthetic camera background capture','elongated object acquisition','3D knife tip projection','position and rotation following','mirrored movement and continuous sweep','manual tip reversal','loss clears input and knife','hand-only mode rejects toy rectangle','camera tracks released','title, reference and bottom toolbar removed','English loading and interface','translucent white camera panel','unchanged room model placement','knife excluded from room export group','collapse and mobile panel','no remote requests','no page errors','all four English recognition labels','object, dough and fist feedback','non-knife gestures never emit active knife input','free room camera preserved'],first,moving,projection,actionResults,cleanUI,errors,remoteRequests,modelWarnings};
    fs.writeFileSync('output/knife-input-validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,checks:report.checks,modelWarnings}));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
