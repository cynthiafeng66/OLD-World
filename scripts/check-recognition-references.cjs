// Local reference-image camera test. Paths are supplied by the caller; images
// remain in memory and are never copied into the site's publicly served assets.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'/Users/cynthiafeng/Desktop/旧世界/node_modules/playwright');
(async()=>{
  assert.equal(process.argv.length,7,'provide five PNG reference paths in reference order');
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});
  try{
    const page=await browser.newPage();const errors=[],remote=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:8766/'))remote.push(r.url());});
    await page.goto('http://127.0.0.1:8766/knife-control/knife-input.css');
    await page.evaluate(async()=>{
      const {CameraKnifeController}=await import('/knife-control/camera-controller.js?v=20261026-recognition');
      window.inputCanvas=document.createElement('canvas');inputCanvas.width=640;inputCanvas.height=480;
      window.inputContext=inputCanvas.getContext('2d');inputContext.fillStyle='#787f88';inputContext.fillRect(0,0,640,480);
      window.inputImage=null;window.inputFlip=false;window.inputBrightness=1;window.extraRectangle=false;
      window.drawInput=()=>{inputContext.save();inputContext.fillStyle='#787f88';inputContext.fillRect(0,0,640,480);inputContext.filter=`brightness(${inputBrightness})`;if(inputImage){if(inputFlip){inputContext.translate(640,0);inputContext.scale(-1,1);}inputContext.drawImage(inputImage,0,0,640,480);}inputContext.restore();if(extraRectangle){inputContext.fillStyle='#171923';inputContext.fillRect(440,60,55,260);}};
      window.inputTimer=setInterval(drawInput,33);navigator.mediaDevices.getUserMedia=async()=>inputCanvas.captureStream(30);
      window.controller=new CameraKnifeController();window.states=[];controller.addEventListener('pose',e=>{window.state=e.detail;states.push({active:state.active,action:state.pose?.action});});
      await controller.start();
    });
    await page.waitForFunction(()=>controller.workerReady,null,{timeout:35000});
    const expected=['dough','knife','knife','explore','bread'],report=[];
    for(let i=0;i<5;i++){
      const data='data:image/png;base64,'+fs.readFileSync(process.argv[i+2]).toString('base64');
      await page.evaluate(async data=>{inputImage=await createImageBitmap(await(await fetch(data)).blob());inputFlip=false;inputBrightness=1;states=[];drawInput();},data);
      await page.waitForFunction(action=>state?.active && state.pose.action===action,expected[i],{timeout:10000});
      await page.waitForTimeout(900);
      const result=await page.evaluate(()=>({action:state.pose?.action,active:state.active,handCount:controller.handResult?.landmarks.length,actions:states.filter(s=>s.active).slice(-10).map(s=>s.action)}));
      assert.equal(result.action,expected[i],`reference ${i+1}`);assert.ok(result.active);assert.ok(result.actions.every(a=>a===expected[i]),`stable reference ${i+1}: ${result.actions}`);
      // Mirroring and a moderate exposure change must preserve the category.
      await page.evaluate(()=>{inputFlip=true;inputBrightness=.9;states=[];drawInput();});
      await page.waitForFunction(action=>state?.active && state.pose.action===action,expected[i],{timeout:10000});await page.waitForTimeout(650);
      assert.equal(await page.evaluate(()=>state.active&&state.pose.action),expected[i],`mirrored/dimmed reference ${i+1}`);
      report.push({reference:i+1,expected:expected[i],...result,mirroredDimmed:true});
    }
    // The actual fist reference plus a separate rectangular prop must yield only Knife.
    await page.evaluate(()=>{inputFlip=false;inputBrightness=1;extraRectangle=true;states=[];drawInput();});
    await page.waitForFunction(()=>state?.active&&state.pose.action==='knife',null,{timeout:10000});await page.waitForTimeout(850);
    const combined=await page.evaluate(()=>states.filter(s=>s.active).slice(-12).map(s=>s.action));
    assert.ok(combined.length && combined.every(a=>a==='knife'),'rectangle suppresses the real fist gesture');
    await page.evaluate(()=>{inputImage=null;extraRectangle=false;drawInput();});await page.waitForFunction(()=>!state.active&&!state.visible,null,{timeout:4000});
    await page.evaluate(()=>{controller.stop();clearInterval(inputTimer);});
    assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
    fs.writeFileSync('output/recognition-reference-validation.json',JSON.stringify({passed:true,references:report,lossStopsInput:true,combinedFistAndObject:combined,remoteRequests:remote,errors},null,2));console.log(JSON.stringify({passed:true,references:report}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
