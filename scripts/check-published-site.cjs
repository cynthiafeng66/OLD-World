// Validate the deployable bundle under its real Pages subpath, with a fake camera.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'/Users/cynthiafeng/Desktop/旧世界/node_modules/playwright');
const url=process.argv[2]||'http://127.0.0.1:8771/OLD-World/';
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[],missing=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)missing.push({url:r.url(),status:r.status()});});
 await page.addInitScript(()=>{
  window.fakeCamera={show:false};navigator.mediaDevices.getUserMedia=async()=>{
   const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;const c=canvas.getContext('2d');
   const draw=()=>{c.fillStyle='#bec7bb';c.fillRect(0,0,640,480);if(fakeCamera.show){c.fillStyle='#252933';c.fillRect(292,70,56,330);}};
   draw();const timer=setInterval(draw,33),stream=canvas.captureStream(30),track=stream.getVideoTracks()[0],stop=track.stop.bind(track);track.stop=()=>{clearInterval(timer);stop();};return stream;
  };
 });
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.kitchen?.ready&&window.kitchenKnife,null,{timeout:240000});await page.locator('#loading').waitFor({state:'detached'});
 const layout=await page.evaluate(()=>({parts:kitchen.parts.length,corner:!!kitchen.kitchenCorner,removed:!document.querySelector('header,nav,#reference,#hint'),english:!/[\u3400-\u9fff]/u.test(document.body.innerText),background:getComputedStyle(document.querySelector('#knife-input')).backgroundColor,freeCamera:kitchen.controls.enabled&&kitchen.controls.minDistance<1}));
 assert.equal(layout.parts,16);assert.ok(layout.corner&&layout.removed&&layout.english&&layout.freeCamera);assert.equal(layout.background,'rgba(255, 255, 255, 0.7)');
 await page.click('#knife-start');await page.waitForFunction(()=>kitchenKnife.controller.workerReady,null,{timeout:40000});
 await page.selectOption('#knife-mode','object');await page.evaluate(()=>fakeCamera.show=true);
 await page.waitForFunction(()=>kitchenKnife.state?.active&&kitchen.interaction.action==='knife',null,{timeout:10000});
 const camera=await page.evaluate(()=>({workerReady:kitchenKnife.controller.workerReady,action:kitchen.interaction.action,knifeVisible:kitchenKnife.knife.visible}));
 await page.click('#knife-start');await page.selectOption('#knife-mode','auto');
 const deployment=await page.evaluate(async()=>await(await fetch('deployment.json',{cache:'no-store'})).json());
 await page.screenshot({path:'output/published-kitchen.png'});assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
 const report={passed:true,url,layout,camera,commit:deployment.commit,runtimeBytes:deployment.runtime_bytes,errors,missing};fs.writeFileSync('output/published-site-validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
