import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {preserveSources} from './preserve-source-glb.js?v=20261026-batch';
import {installDoughSequence} from './dough-sequence.js?v=20261029-dough-loop';
import {installKitchenKnife} from './knife-control/kitchen-input.js?v=20261027-clean-ui';
const $=s=>document.querySelector(s),scene=new T.Scene();scene.background=new T.Color('#bb9876');
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;$('#view').append(renderer.domElement);
const camera=new T.PerspectiveCamera(38,innerWidth/innerHeight,.05,200);function fitFov(){camera.fov=T.MathUtils.radToDeg(2*Math.atan(Math.tan(T.MathUtils.degToRad(38/2))*Math.max(1,(1672/940)/camera.aspect)));camera.updateProjectionMatrix()}fitFov();const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=.1;controls.maxDistance=60;const room=new T.Group();room.name='Warm_Sunlit_Kitchen';scene.add(room);const shell=new T.Group();shell.name='Architecture';room.add(shell);const parts=[];const loader=new GLTFLoader();let dirty=true;
const pmrem=new T.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.06).texture;scene.environmentIntensity=.35;
scene.add(new T.HemisphereLight(0xffefd4,0x77502c,1.2));const ambient=new T.AmbientLight(0xffe3c0,.45);scene.add(ambient);
const sun=new T.DirectionalLight(0xffd399,2.4);sun.position.set(-3,6.5,-1);sun.target.position.set(.5,0,3);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:.1,far:22});sun.shadow.normalBias=.025;sun.shadow.bias=-.0002;sun.shadow.radius=3;scene.add(sun,sun.target);
const fill=new T.DirectionalLight(0xffe8cf,.8);fill.position.set(1,3,6);scene.add(fill);
function mat(color,roughness=.85){return new T.MeshStandardMaterial({color,roughness})}const plaster=mat('#cda17c'),wood=mat('#9c571f'),tile=mat('#3d5738');
function box(name,w,h,d,x,y,z,m,parent=shell){const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.name=name;o.position.set(x,y,z);o.receiveShadow=true;parent.add(o);return o}
const windowLayout=await(await fetch('assets/models/kitchen-1-window-layout.json?v=20261026-inset-window')).json();
const backWindowWall=new T.Group();backWindowWall.name='Back plaster wall';shell.add(backWindowWall);
const opening=windowLayout.hole,left=opening.x-opening.width/2,right=opening.x+opening.width/2,bottom=opening.y-opening.height/2,top=opening.y+opening.height/2;
box('Back wall left pier',left+4.3,3.65,.15,(-4.3+left)/2,1.825,-3.68,plaster,backWindowWall);
box('Back wall right pier',4.3-right,3.65,.15,(right+4.3)/2,1.825,-3.68,plaster,backWindowWall);
box('Wall below window',opening.width,bottom,.15,opening.x,bottom/2,-3.68,plaster,backWindowWall);
box('Wall above window',opening.width,3.65-top,.15,opening.x,(top+3.65)/2,-3.68,plaster,backWindowWall);
box('Left plaster wall',.15,3.65,10,-4.3,1.825,1.25,plaster);box('Right plaster wall',.15,3.65,10,4.3,1.825,1.25,plaster);box('Ceiling',8.6,.12,10,0,3.68,1.25,mat('#c49870'));box('Subfloor',8.6,.13,10,0,-.08,1.25,wood);
box('Left skirting',.08,.13,10,-4.19,.07,1.25,wood);box('Back skirting',8.5,.13,.08,0,.07,-3.55,wood);box('Right skirting',.08,.13,10,4.19,.07,1.25,wood);
const manifest=await(await fetch('assets/parts/manifest.json')).json();const metadata=Object.fromEntries(manifest.map(m=>[m.name,m]));
async function add(name,label,scale,position,rotation=[0,0,0],anchor=false){const group=new T.Group();group.name=label;group.userData={asset:name,source:metadata[name]?.source||name};const gltf=await loader.loadAsync(`assets/parts/${name}.glb`);const object=gltf.scene;if(anchor){const b=new T.Box3().setFromObject(object),c=b.getCenter(new T.Vector3());object.position.set(-c.x,-b.min.y,-c.z)}object.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});group.add(object);if(name==='floor'){for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){if(i===0&&j===0)continue;const copy=object.clone(true);copy.position.x+=i*.9834;copy.position.y+=j*.9738;group.add(copy)}}group.scale.set(...scale);group.position.set(...position);group.rotation.set(...rotation);room.add(group);parts.push(group);return group}
const placements=[
 ['work-table','Central worktable',[3.05,3.5,2.1],[.1,.02,.7],[0,0,0],true],
 ['floor','Wooden floor',[2.9,3.34,.12],[0,-.015,1.25],[-Math.PI/2,0,0],true]
];
// Original model groups only use uniform scale, position and orientation.
const nativeSources=[];
async function addOriginal(file,asset,label,scale,position,angle=0,version='',displayFile='',options={}){
 const url=(displayFile?'assets/parts/'+encodeURIComponent(displayFile):'assets/models/'+encodeURIComponent(file))+(version?'?v='+encodeURIComponent(version):'');const response=await fetch(url);if(!response.ok)throw Error('Unable to load model: '+file);const bytes=await response.arrayBuffer();const gltf=await loader.parseAsync(bytes,'');const group=new T.Group();group.name=label;group.userData={asset,source:file+' · Original model and textures',preserveOriginal:true};group.scale.setScalar(scale);group.position.set(...position);group.rotation.y=angle;const object=gltf.scene;object.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});group.add(object);(options.parent||room).add(group);if(options.register!==false)parts.push(group);nativeSources.push({group,object,bytes:displayFile?null:bytes,file,version});$('#progress').textContent='Loading original model · '+label;return{group,object};
}
const first=await addOriginal('kitchen-1-window-inset.glb','native-kitchen-1','Kitchen 1 · Inset window',7.4,[-.5,.02,-2.5],0,'20261026-inset-window');const nativeKitchen=first.group,nativeObject=first.object;
const insetWindow=nativeObject.getObjectByName('Kitchen_1_raised_window'),windowTiles=nativeObject.getObjectByName('Green_tiles_below_window');
const second=await addOriginal('kitchen 2 stove fixed.glb','native-kitchen-2','Kitchen 2 · Repaired hob',4.0,[3.3,.02,.51],-Math.PI/2,'20261026-four-burners');
const repairedStove=second.object.getObjectByName('Repaired_Gas_Hob');second.group.userData.source='Kitchen 2 · Repaired hob, original cabinets, hood and textures';
await addOriginal('wooden shelf 3d model.glb','native-wooden-shelf','Left shelf · Original proportions',2.7,[-3.7,.02,1.25],Math.PI/2);
await addOriginal('kitchen oven 3d model.glb','native-kitchen-oven','Oven cabinet · Original proportions',2.6,[3.53,.02,3.22],-Math.PI/2);
const landscape=await new T.TextureLoader().loadAsync('assets/images/window-landscape.png');landscape.colorSpace=T.SRGBColorSpace;const paneWidth=windowLayout.pane.width,paneHeight=windowLayout.pane.height,imageAspect=landscape.image.width/landscape.image.height,windowAspect=paneWidth/paneHeight;landscape.repeat.y=imageAspect/windowAspect;landscape.offset.y=(1-landscape.repeat.y)*.48;
const windowView=new T.Mesh(new T.PlaneGeometry(paneWidth,paneHeight),new T.MeshBasicMaterial({map:landscape,toneMapped:false}));windowView.name='Kitchen 1 window landscape';windowView.position.fromArray(windowLayout.pane.position);windowView.userData={source:'window-landscape.png · Window landscape'};nativeKitchen.add(windowView);
try{for(let i=0;i<placements.length;i++){let o=await add(...placements[i]);if(placements[i][0]==='floor'){// center the formerly upright panel after rotating it to the floor.
 const b=new T.Box3().setFromObject(o),c=b.getCenter(new T.Vector3());o.position.x-=c.x;o.position.z+=1.25-c.z;o.position.y-=b.max.y+.012;o.traverse(n=>{if(n.isMesh)n.castShadow=false})}
 $('#bar').style.width=((i+1)/placements.length*100)+'%';$('#progress').textContent=`${i+1} / ${placements.length} · ${placements[i][1]}`;
 }}catch(e){$('#progress').textContent='Unable to load: '+e.message;throw e}
// Place the original board 4 cm from the table edge nearest the window.
const table=parts.find(part=>part.userData.asset==='work-table');
const tableBounds=new T.Box3().setFromObject(table);
const boardModel=await addOriginal('cutting board 3d model.glb','native-cutting-board','White cutting board',1.25,[.1,tableBounds.max.y+.003,1.05]);
const cuttingBoard=boardModel.group;
const boardBounds=new T.Box3().setFromObject(cuttingBoard);
cuttingBoard.position.z+=tableBounds.min.z+.04-boardBounds.min.z;
// Seven upright plates share the same original ceramic mesh and texture.
const rackPlates=(await addOriginal('rack-plates.glb','native-rack-plates','White plates · Seven in rack',1,[-2.55,.02+.1517*7.4+.003,-2.69],0,'','rack-plates-display.glb')).group;
const shelf=parts.find(part=>part.userData.asset==='native-wooden-shelf');
shelf.updateWorldMatrix(true,false);
const onShelf=(x,y,z)=>new T.Vector3(x,y,z).applyMatrix4(shelf.matrixWorld).toArray();
const flourSack=(await addOriginal('cloth sack 3d model.glb','native-flour-sack','Flour sack',.47,onShelf(-.18,.2635,.015),Math.PI/2,'','flour-sack-display.glb')).group;
const riceBag=(await addOriginal('rice bag 3d model.glb','native-rice-bag','Rice bag',.46,onShelf(.18,.2635,.015),Math.PI/2,'','rice-bag-display.glb')).group;
const breadPasta=(await addOriginal('bread pasta packaging 3d model.glb','native-bread-pasta','Bread and pasta',.64,onShelf(0,.493,.015),Math.PI/2,'','bread-pasta-display.glb')).group;
// Align the original cookware bases with the front burner supports.
second.group.updateWorldMatrix(true,true);
const onBurner=x=>new T.Vector3(x,.2381,.105).applyMatrix4(second.group.matrixWorld).toArray();
const fryingPan=(await addOriginal('frying-pan.glb','native-frying-pan','Frying pan',.95,onBurner(-.008),2.13,'','frying-pan-display.glb')).group;
const stockpot=(await addOriginal('stockpot.glb','native-stockpot','Stockpot',1.05,onBurner(-.145),Math.PI/2,'','stockpot-display.glb')).group;
nativeKitchen.updateWorldMatrix(true,true);
const counterProbe=new T.Raycaster(new T.Vector3(-.3,1.3,-2.25),new T.Vector3(0,-1,0),0,.6);
const counterSurface=counterProbe.intersectObject(nativeObject,true)[0];
if(!counterSurface)throw Error('Unable to locate the window counter surface');
const bakingSet=(await addOriginal('baking-set-no-towel.glb','native-baking-set','Baking set · Towel removed',2.6,[-.3,counterSurface.point.y+.001,-2.25],0,'20261026-baking-front-edge','baking-set-no-towel-display.glb')).group;
const cornerModel=await addOriginal('kitchen-corner-completion.glb','native-kitchen-corner','Corner cabinet and tile return',1,[0,0,0],0,'20261027-corner-final');const kitchenCorner=cornerModel.group;
const doughSequence=await installDoughSequence({board:bakingSet.getObjectByName('Baking_Board_and_rolling_pin'),parent:room,parts,addOriginal,canvas:renderer.domElement,invalidate:()=>{dirty=true}});
// Soft warm pool of light below the extractor hood.
const hoodLight=new T.PointLight(0xffbd60,4,2.7,2);hoodLight.position.set(2.9,1.55,.2);scene.add(hoodLight);
// Sunlit window reflection on the planks, with diffuse leaf silhouettes.
const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,512,512);let seed=71;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};ctx.filter='blur(9px)';for(let i=0;i<45;i++){ctx.fillStyle=`rgba(48,40,20,${.12+rand()*.33})`;ctx.beginPath();ctx.ellipse(rand()*512,rand()*512,8+rand()*32,10+rand()*40,rand()*Math.PI,0,Math.PI*2);ctx.fill()}const gobo=new T.CanvasTexture(canvas);const patch=new T.Mesh(new T.PlaneGeometry(5.7,4.8),new T.MeshBasicMaterial({map:gobo,color:0xffb24d,transparent:true,opacity:.12,depthWrite:false,blending:T.AdditiveBlending}));patch.name='Window sunlight';patch.rotation.x=-Math.PI/2;patch.rotation.z=-.48;patch.position.set(-1.25,.002,2.05);room.add(patch);
// Free navigation; cut away foreground architecture when looking from outside.
let exportingRoom=false;
function updateCutaway(){if(exportingRoom)return false;const hidden={'Left plaster wall':camera.position.x<-4.225,'Left skirting':camera.position.x<-4.225,'Right plaster wall':camera.position.x>4.225,'Right skirting':camera.position.x>4.225,'Back plaster wall':camera.position.z<-3.605,'Back skirting':camera.position.z<-3.605,'Ceiling':camera.position.y>3.62,'Subfloor':camera.position.y<-.015};let changed=false;for(const panel of shell.children){const visible=!hidden[panel.name];if(panel.visible!==visible){panel.visible=visible;changed=true}}return changed}
function setView(position,target){const damping=controls.enableDamping;controls.enableDamping=false;controls.update();camera.position.set(...position);controls.target.set(...target);controls.update();controls.enableDamping=damping}
function reset(){setView([.05,2.35,6.2],[0,1.15,-.9])}reset();
controls.addEventListener('change',()=>dirty=true);function draw(){requestAnimationFrame(draw);controls.update();if(updateCutaway())dirty=true;if(dirty){renderer.render(scene,camera);dirty=false}}draw();addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;fitFov();renderer.setSize(innerWidth,innerHeight);dirty=true});
$('#loading').style.opacity=0;setTimeout(()=>$('#loading').remove(),550);
function visibleInScene(object){for(let node=object;node;node=node.parent)if(!node.visible)return false;return true}
async function exportRoom(){exportingRoom=true;const shellVisibility=shell.children.map(panel=>panel.visible);shell.children.forEach(panel=>panel.visible=true);const was=patch.visible;patch.visible=false;const visibility=nativeSources.map(source=>source.object.visible);for(const source of nativeSources)source.object.visible=false;try{let exported=await new GLTFExporter().parseAsync(room,{binary:true,onlyVisible:true});const sources=[];for(const source of nativeSources)if(visibleInScene(source.group)){let bytes=source.bytes;if(!bytes){const response=await fetch('assets/models/'+encodeURIComponent(source.file)+(source.version?'?v='+encodeURIComponent(source.version):''));if(!response.ok)throw Error('Unable to export model: '+source.file);bytes=await response.arrayBuffer()}sources.push({source:bytes,asset:source.group.userData.asset})}return preserveSources(exported,sources)}finally{exportingRoom=false;shell.children.forEach((panel,i)=>panel.visible=shellVisibility[i]);nativeSources.forEach((source,i)=>source.object.visible=visibility[i]);patch.visible=was;dirty=true}}
window.kitchen={scene,room,camera,renderer,controls,parts,nativeSources,nativeKitchen,nativeObject,windowView,windowLayout,insetWindow,windowTiles,backWindowWall,kitchenCorner,repairedStove,cuttingBoard,rackPlates,flourSack,riceBag,breadPasta,fryingPan,stockpot,bakingSet,doughSequence,exportRoom,ready:true,render:()=>{dirty=true;renderer.render(scene,camera)},reset};
window.kitchenKnife=installKitchenKnife({scene,camera,invalidate:()=>{dirty=true},onRecognition:state=>{window.kitchen.interaction=state}});
