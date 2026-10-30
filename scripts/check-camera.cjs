const assert=require('node:assert/strict'),fs=require('node:fs');
const{chromium}=require('/Users/cynthiafeng/Desktop/旧世界/node_modules/playwright');
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:8766/');await page.waitForFunction(()=>window.kitchen?.ready,null,{timeout:120000});await page.locator('#loading').waitFor({state:'detached'});
 assert.equal(await page.evaluate(()=>kitchen.parts.length),16);
 await page.evaluate(()=>kitchen.controls.enableDamping=false);
 await page.mouse.move(700,420);await page.mouse.down();await page.mouse.move(1100,420,{steps:8});await page.mouse.up();assert.ok(Math.abs(await page.evaluate(()=>kitchen.controls.getAzimuthalAngle()))>.48,'orbit goes beyond former angular limit');
 await page.mouse.move(700,420);await page.mouse.down({button:'right'});await page.mouse.move(1300,420,{steps:8});await page.mouse.up({button:'right'});assert.ok(await page.evaluate(()=>Math.abs(kitchen.controls.target.x)>1.6||Math.abs(kitchen.controls.target.z)>1.65),'pan goes beyond former target bounds');
 await page.click('#reset');await page.mouse.move(700,420);await page.mouse.wheel(0,-15000);await page.waitForTimeout(250);assert.ok(await page.evaluate(()=>kitchen.controls.getDistance()<3),'can approach room objects');
 await page.evaluate(()=>{kitchen.camera.position.set(-6,4.2,8.7);kitchen.controls.target.set(0,1,-.5);kitchen.controls.update()});await page.waitForTimeout(100);
 assert.ok(await page.evaluate(()=>kitchen.camera.position.x<-4.3&&kitchen.camera.position.y>4),'outside camera is not snapped back');assert.ok(await page.evaluate(()=>!kitchen.room.getObjectByName('Left plaster wall').visible&&!kitchen.room.getObjectByName('Ceiling').visible),'foreground shell cuts away');
 await page.click('#reset');await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>kitchen.camera.position.distanceTo(kitchen.controls.target)>7&&kitchen.room.getObjectByName('Left plaster wall').visible),'Room view remains available');
 assert.deepEqual(errors,[]);fs.writeFileSync('output/camera-validation.json',JSON.stringify({passed:true,freeOrbit:true,freePan:true,closeZoom:true,noPositionClamp:true,automaticArchitectureCutaway:true,roomViewReset:true,errors},null,2));console.log('Free camera checks passed');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
