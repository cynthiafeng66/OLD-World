const assert=require('node:assert/strict'),fs=require('node:fs');
const{chromium}=require('/Users/cynthiafeng/Desktop/旧世界/node_modules/playwright');
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];let rejectExport;page.on('dialog',async d=>{errors.push(d.message());console.error('Dialog:',d.message());rejectExport?.(new Error(d.message()));await d.dismiss()});page.on('pageerror',e=>{errors.push(e.message);console.error('Page error:',e.message)});await page.goto('http://127.0.0.1:8766/');await page.waitForFunction(()=>window.kitchen?.ready,null,{timeout:120000});await page.locator('#loading').waitFor({state:'detached'});await page.click('#knife-collapse');
 const report=await page.evaluate(async()=>{const T=await import('/vendor/three/build/three.module.js');kitchen.room.updateWorldMatrix(true,true);const cookware=[kitchen.fryingPan,kitchen.stockpot].map(o=>{const b=new T.Box3().setFromObject(o,true);return{name:o.name,min:b.min.toArray(),max:b.max.toArray(),position:o.position.toArray(),scale:o.scale.toArray()}});let caps=0,plates=0;kitchen.repairedStove.traverse(o=>{if(/^Burner_\d+_cap$/.test(o.name))caps++});kitchen.rackPlates.traverse(o=>{if(o.isMesh)plates++});return{parts:kitchen.parts.length,cookware,caps,plates,english:!/[\u3400-\u9fff]/u.test(document.body.textContent),triangles:kitchen.renderer.info.render.triangles}});
 fs.writeFileSync('output/cookware-layout-debug.json',JSON.stringify(report,null,2));
 assert.equal(report.parts,16);assert.equal(report.caps,4);assert.equal(report.plates,7);assert.ok(report.english);
 for(const [i,pot]of report.cookware.entries()){
  assert.ok(pot.min[1]>=.9704&&pot.min[1]<.975,'base rests on raised cast-iron supports');assert.ok(pot.max[1]<1.31,'cookware clears extractor');
  assert.ok(Math.abs(pot.position[0]-2.88)<.00001);assert.ok(Math.abs(pot.position[2]-(i===0?.478:-.07))<.00001,'body centered on burner');
  assert.ok(pot.scale.every(s=>s===pot.scale[0]),'source proportions retained');
 }
 assert.ok(report.cookware[0].min[2]>report.cookware[1].max[2],'pots and handles do not intersect');
 assert.ok(report.cookware[0].min[0]<2.5,'pan handle points out toward the cook');assert.ok(report.triangles<14000000);
 async function detail(file,position,target,fov=38){const data=await page.evaluate(({position,target,fov})=>{kitchen.camera.fov=fov;kitchen.camera.updateProjectionMatrix();kitchen.camera.position.set(...position);kitchen.camera.lookAt(...target);kitchen.renderer.render(kitchen.scene,kitchen.camera);const image=kitchen.renderer.domElement.toDataURL('image/png');kitchen.reset();kitchen.render();return image},{position,target,fov});fs.writeFileSync(file,Buffer.from(data.split(',')[1],'base64'))}
 await detail('output/cookware-on-stove.png',[1.15,2.25,1.75],[2.95,1.05,.16],42);
 await detail('output/cookware-room.png',[.05,2.65,9],[0,1,-1.15]);
 console.log('Layout verified; exporting full room');const download=page.waitForEvent('download',{timeout:240000}),failure=new Promise((_,reject)=>rejectExport=reject);const [result]=await Promise.all([Promise.race([download,failure]),page.evaluate(async()=>{const data=await kitchen.exportRoom(),url=URL.createObjectURL(new Blob([data],{type:'model/gltf-binary'})),a=document.createElement('a');a.href=url;a.download='warm-kitchen.glb';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);})]);await result.saveAs('output/warm-kitchen.glb');
 assert.deepEqual(errors,[]);fs.writeFileSync('output/cookware-validation.json',JSON.stringify({passed:true,...report,errors,exportBytes:fs.statSync('output/warm-kitchen.glb').size},null,2));console.log(JSON.stringify({passed:true,...report,errors}));
 }finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
