const assert=require('node:assert/strict'),fs=require('node:fs');
const{chromium}=require(process.env.PLAYWRIGHT_PATH||'/Users/cynthiafeng/Desktop/旧世界/node_modules/playwright');
const url=process.env.KITCHEN_URL||'http://127.0.0.1:8766/';
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[],missing=[];
 page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});page.on('response',r=>{if(r.status()>=400)missing.push({url:r.url(),status:r.status()});});
 await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.kitchen?.ready&&kitchen.doughSequence,null,{timeout:180000});await page.locator('#loading').waitFor({state:'detached'});await page.click('#knife-collapse');
 const measure=()=>page.evaluate(async()=>{const T=await import('three'),sequence=kitchen.doughSequence;sequence.group.updateWorldMatrix(true,true);const stage=sequence.current,b=new T.Box3().setFromObject(stage.group,true);return{index:sequence.index,label:stage.label,source:stage.source,visible:sequence.stages.map(s=>s.group.visible),min:b.min.toArray(),max:b.max.toArray(),scale:stage.group.scale.toArray(),anchor:sequence.anchor.toArray(),woodMin:sequence.woodBounds.min.toArray(),woodMax:sequence.woodBounds.max.toArray(),camera:kitchen.camera.position.toArray(),target:kitchen.controls.target.toArray()};});
 const stages=[],initial=await measure();assert.equal(initial.index,0);assert.equal(await page.evaluate(()=>kitchen.parts.length),16);
 // Closer verification view only in this test browser; the real camera stays free.
 await page.evaluate(()=>{kitchen.controls.enableDamping=false;kitchen.camera.position.set(-.15,1.97,-.45);kitchen.controls.target.set(-.18,1.1,-2.10);kitchen.controls.update();kitchen.camera.fov=40;kitchen.camera.updateProjectionMatrix();});
 async function checkStage(expected){const s=await measure();assert.equal(s.index,expected);assert.equal(s.visible.filter(Boolean).length,1);assert.ok(s.visible[expected]);assert.ok(Math.abs(s.min[1]-s.anchor[1])<.00001,'each shape rests at the board surface');assert.ok(s.min[0]>s.woodMin[0]&&s.max[0]<s.woodMax[0]&&s.min[2]>s.woodMin[2]&&s.max[2]<s.woodMax[2],'each shape fits inside the brown board');assert.ok(s.scale.every(v=>v===s.scale[0]),'uniform original proportions');await page.waitForTimeout(100);const image=await page.evaluate(()=>{kitchen.renderer.render(kitchen.scene,kitchen.camera);return kitchen.renderer.domElement.toDataURL('image/png');});fs.writeFileSync(`output/dough-stage-${expected+1}.png`,Buffer.from(image.split(',')[1],'base64'));stages.push(s);}
 await checkStage(0);await page.locator('#view canvas').focus();
 await page.keyboard.down('Space');assert.equal((await measure()).index,1);await page.keyboard.down('Space');assert.equal((await measure()).index,1,'held key does not skip stages');await page.keyboard.up('Space');await checkStage(1);
 await page.keyboard.press('Space');await checkStage(2);await page.keyboard.press('Space');await checkStage(3);
 const finalCamera=(await measure()).camera,loopIndices=[];for(const expected of [0,1,2,3,0]){await page.keyboard.press('Space');const s=await measure();loopIndices.push(s.index);assert.equal(s.index,expected,'the fourth shape wraps to the first and keeps cycling');assert.equal(s.visible.filter(Boolean).length,1);assert.ok(s.visible[expected]);}assert.deepEqual((await measure()).camera,finalCamera,'Space does not move or lock the camera');
 await page.evaluate(()=>{kitchen.doughSequence.setStage(1);const input=document.createElement('input');input.id='keyboard-test';document.body.append(input);input.focus();});await page.keyboard.press('Space');assert.equal((await measure()).index,1,'typing into a control does not advance the dough');await page.evaluate(()=>document.querySelector('#keyboard-test').remove());
 await page.evaluate(()=>kitchen.doughSequence.reset());await page.click('#knife-collapse');await page.locator('#knife-mode').focus();await page.keyboard.press('Space');assert.equal((await measure()).index,0,'camera controls keep their own keyboard behavior');await page.keyboard.press('Escape');
 if(process.argv.includes('--export')){
  console.log('Dough placement and keyboard verified; exporting the initial stage');
  const download=page.waitForEvent('download',{timeout:240000});
  const [result]=await Promise.all([download,page.evaluate(async()=>{const bytes=await kitchen.exportRoom(),a=document.createElement('a');a.href=URL.createObjectURL(new Blob([bytes],{type:'model/gltf-binary'}));a.download='warm-kitchen.glb';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);})]);
  await result.saveAs('output/warm-kitchen.glb');
  const fd=fs.openSync('output/warm-kitchen.glb','r'),header=Buffer.alloc(20);fs.readSync(fd,header,0,20,0);const json=Buffer.alloc(header.readUInt32LE(12));fs.readSync(fd,json,0,json.length,20);fs.closeSync(fd);const doc=JSON.parse(json);
  assert.ok(doc.nodes.some(n=>n.extras?.asset==='native-dough-stage-1'),'initial dough is included in the export');
  for(const index of [2,3,4])assert.ok(!doc.nodes.some(n=>n.extras?.asset===`native-dough-stage-${index}`),'hidden dough stages are excluded');
 }
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
 const report={passed:true,url,initial,stages,oneStepPerPress:true,heldKeyIgnored:true,loopsBackToFirst:true,loopIndices,editableControlsIgnored:true,cameraControlsPreserved:true,errors,missing};fs.writeFileSync('output/dough-sequence-validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,loopIndices,stages:stages.map(s=>({index:s.index,label:s.label,source:s.source,min:s.min,max:s.max})),errors,missing}));
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
