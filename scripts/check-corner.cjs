const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('/Users/cynthiafeng/Desktop/旧世界/node_modules/playwright');
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];let rejectExport;
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{errors.push(d.message());rejectExport?.(Error(d.message()));await d.dismiss();});
 await page.goto('http://127.0.0.1:8766/');await page.waitForFunction(()=>window.kitchen?.ready,null,{timeout:120000});await page.locator('#loading').waitFor({state:'detached'});await page.click('#knife-collapse');
 const layout=await page.evaluate(async()=>{
  const T=await import('/vendor/three/build/three.module.js');kitchen.room.updateWorldMatrix(true,true);
  const corner=kitchen.kitchenCorner,b=new T.Box3().setFromObject(corner),samples=[],tiles=[];
  for(const x of [3.08,3.13,3.25,3.6,3.95,4.04])for(const z of [-3.25,-2.85,-2.4,-2,-1.75,-1.55,-1.47]){
   const ray=new T.Raycaster(new T.Vector3(x,1.02,z),new T.Vector3(0,-1,0),0,.3),hit=ray.intersectObjects([kitchen.nativeKitchen,corner],true)[0];samples.push({x,z,y:hit?.point.y??null});
  }
  const panel=corner.getObjectByName('Corner_green_tile_return');
  for(const z of [-3.32,-2.8,-2.2,-1.6]){const hit=new T.Raycaster(new T.Vector3(3.9,1.07,z),new T.Vector3(1,0,0),0,.4).intersectObject(panel,true)[0];tiles.push({z,x:hit?.point.x??null});}
  return {parts:kitchen.parts.length,bounds:{min:b.min.toArray(),max:b.max.toArray()},samples,tiles,groups:corner.children[0].children.map(o=>o.name),originalTransforms:kitchen.parts.slice(0,2).map(p=>({position:p.position.toArray(),scale:p.scale.toArray()})),english:!/[\u3400-\u9fff]/u.test(document.body.textContent)};
 });
 console.log(JSON.stringify(layout));
 async function shot(path,eye,target,fov){await page.evaluate(({eye,target,fov})=>{kitchen.controls.enableDamping=false;kitchen.camera.position.set(...eye);kitchen.controls.target.set(...target);kitchen.controls.update();kitchen.camera.fov=fov;kitchen.camera.updateProjectionMatrix();},{eye,target,fov});await page.waitForTimeout(150);const data=await page.evaluate(()=>{kitchen.renderer.render(kitchen.scene,kitchen.camera);return kitchen.renderer.domElement.toDataURL('image/png');});fs.writeFileSync(path,Buffer.from(data.split(',')[1],'base64'));}
 await shot('output/corner-completed.png',[.8,1.85,.35],[3.15,1.0,-2.5],38);
 await shot('output/corner-completed-top.png',[2.4,4.0,-.3],[3.3,.9,-2.5],45);
 if(process.argv.includes('--photo-only'))return;
 assert.equal(layout.parts,16);assert.ok(layout.english);assert.deepEqual(layout.originalTransforms,[{position:[-.5,.02,-2.5],scale:[7.4,7.4,7.4]},{position:[3.3,.02,.51],scale:[4,4,4]}]);
 for(const sample of layout.samples)assert.ok(sample.y>.96&&sample.y<1.01,'continuous solid corner counter '+JSON.stringify(sample));
 assert.ok(layout.tiles.every(t=>t.x>4.05&&t.x<4.22),'right-wall tile return is solid');
 assert.deepEqual(errors,[]);
 console.log('Corner surface, tile return and original placements verified; exporting');
 const download=page.waitForEvent('download',{timeout:240000}),failure=new Promise((_,reject)=>rejectExport=reject);const [result]=await Promise.all([Promise.race([download,failure]),page.evaluate(async()=>{const data=await kitchen.exportRoom(),url=URL.createObjectURL(new Blob([data],{type:'model/gltf-binary'})),a=document.createElement('a');a.href=url;a.download='warm-kitchen.glb';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);})]);await result.saveAs('output/warm-kitchen.glb');assert.deepEqual(errors,[]);
 fs.writeFileSync('output/corner-validation.json',JSON.stringify({passed:true,layout,errors,exportBytes:fs.statSync('output/warm-kitchen.glb').size},null,2));console.log(JSON.stringify({passed:true,exportBytes:fs.statSync('output/warm-kitchen.glb').size}));
 }finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1});
