const assert=require('node:assert/strict'),fs=require('node:fs');
const{chromium}=require('/Users/cynthiafeng/Desktop/旧世界/node_modules/playwright');
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:8766/');await page.waitForFunction(()=>window.kitchen?.ready,{timeout:120000});await page.locator('#loading').waitFor({state:'detached'});await page.click('#knife-collapse');
 const report=await page.evaluate(async()=>{
  const T=await import('/vendor/three/build/three.module.js');kitchen.room.updateWorldMatrix(true,true);
  const bounds=o=>{const b=new T.Box3().setFromObject(o);return{min:b.min.toArray(),max:b.max.toArray()}};
  const plates=[];kitchen.rackPlates.traverse(o=>{if(o.isMesh){const normal=new T.Vector3(0,1,0).transformDirection(o.matrixWorld);plates.push({name:o.name,...bounds(o),normal:normal.toArray(),geometry:o.geometry.uuid})}});
  const shelf=kitchen.parts.find(p=>p.userData.asset==='native-wooden-shelf'),inverse=shelf.matrixWorld.clone().invert();
  const groceries=[kitchen.flourSack,kitchen.riceBag,kitchen.breadPasta].map(o=>{const b=new T.Box3().setFromObject(o).applyMatrix4(inverse);return{name:o.name,min:b.min.toArray(),max:b.max.toArray(),scale:o.scale.toArray()}});
  return{parts:kitchen.parts.length,plates,groceries,english:!/[\u3400-\u9fff]/u.test(document.body.textContent),triangles:kitchen.renderer.info.render.triangles};
 });
 assert.equal(report.parts,15);assert.equal(report.plates.length,7);assert.equal(new Set(report.plates.map(p=>p.geometry)).size,1,'plates share display mesh');
 for(const p of report.plates){assert.ok(Math.abs(p.normal[0])>.999&&Math.abs(p.normal[1])<.001,'plates stand upright');assert.ok(p.min[0]>-2.88&&p.max[0]<-2.18);assert.ok(p.min[1]>=1.14&&p.max[1]<1.50);assert.ok(p.min[2]>-3.0&&p.max[2]<-2.43)}
 for(let i=1;i<7;i++)assert.ok(report.plates[i].min[0]-report.plates[i-1].max[0]>.02,'plates do not intersect');
 for(const [i,p]of report.groceries.entries()){assert.ok(p.min[0]>-.34&&p.max[0]<.34,'food stays between shelf uprights');assert.ok(p.min[2]>-.12&&p.max[2]<.14,'food stays within shelf depth');const floor=i<2?.258:.490,ceiling=i<2?.478:.70;assert.ok(p.min[1]>floor&&p.min[1]<floor+.012,'food rests on shelf');assert.ok(p.max[1]<ceiling,'food clears shelf above');assert.ok(p.scale.every(v=>v===p.scale[0]),'original proportions preserved')}
 assert.ok(report.english);assert.ok(report.triangles<14000000,'new props stay responsive');
 async function detail(file,position,target,fov=38){const data=await page.evaluate(({position,target,fov})=>{kitchen.camera.fov=fov;kitchen.camera.updateProjectionMatrix();kitchen.camera.position.set(...position);kitchen.camera.lookAt(...target);kitchen.renderer.render(kitchen.scene,kitchen.camera);const image=kitchen.renderer.domElement.toDataURL('image/png');kitchen.reset();kitchen.render();return image},{position,target,fov});fs.writeFileSync(file,Buffer.from(data.split(',')[1],'base64'))}
 await detail('output/plates-rack-closeup.png',[-1.95,1.65,-.95],[-2.53,1.29,-2.69],32);
 await detail('output/pantry-shelf-closeup.png',[-.7,1.85,4.0],[-3.65,1.2,1.25],39);
 await detail('output/pantry-room.png',[.05,2.65,9],[0,1,-1.15]);
 const download=page.waitForEvent('download',{timeout:240000});await page.evaluate(async()=>{const data=await kitchen.exportRoom(),url=URL.createObjectURL(new Blob([data],{type:'model/gltf-binary'})),a=document.createElement('a');a.href=url;a.download='warm-kitchen.glb';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);});await(await download).saveAs('output/warm-kitchen.glb');
 assert.deepEqual(errors,[]);fs.writeFileSync('output/pantry-validation.json',JSON.stringify({passed:true,...report,errors,exportBytes:fs.statSync('output/warm-kitchen.glb').size},null,2));console.log(JSON.stringify({passed:true,parts:report.parts,plates:report.plates.length,groceries:report.groceries.map(p=>p.name),triangles:report.triangles,errors}));
 }finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
