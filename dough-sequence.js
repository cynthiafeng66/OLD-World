import * as T from 'three';

export const DOUGH_STAGES = [
  {label:'Round dough',source:'dough ball 3d model.glb',display:'dough-stage-1-display.glb'},
  {label:'Oval dough',source:'almond 3d model.glb',display:'dough-stage-2-display.glb'},
  {label:'Irregular dough',source:'almond 3d model_副本.glb',display:'dough-stage-3-display.glb'},
  {label:'Flattened dough',source:'almond kernel 3d model.glb',display:'dough-stage-4-display.glb'},
];

export async function installDoughSequence({board,parent,parts,addOriginal,canvas,invalidate}){
  if(!board?.isMesh)throw Error('Unable to locate the brown baking board.');
  board.updateWorldMatrix(true,false);
  // Use the low wooden body to exclude the rolling pin from the board footprint.
  const positions=board.geometry.getAttribute('position');board.geometry.computeBoundingBox();
  const geometryBounds=board.geometry.boundingBox,woodBounds=new T.Box3();
  const low=geometryBounds.min.y+(geometryBounds.max.y-geometryBounds.min.y)*.14;
  for(let i=0;i<positions.count;i++)if(positions.getY(i)<=low)woodBounds.expandByPoint(new T.Vector3().fromBufferAttribute(positions,i));
  if(woodBounds.isEmpty())throw Error('Unable to measure the brown baking board.');
  const center=woodBounds.getCenter(new T.Vector3()).applyMatrix4(board.matrixWorld);
  const boardBounds=new T.Box3().setFromObject(board,true),ray=new T.Raycaster(new T.Vector3(center.x,boardBounds.max.y+.1,center.z),new T.Vector3(0,-1,0));
  const contact=ray.intersectObject(board,false)[0];
  if(!contact)throw Error('Unable to find the wooden board surface.');
  const anchor=new T.Vector3(center.x,contact.point.y+.001,center.z);
  const woodWorld=woodBounds.clone().applyMatrix4(board.matrixWorld),size=woodWorld.getSize(new T.Vector3());
  const group=new T.Group();group.name='Dough on brown board';group.userData={asset:'dough-sequence',stageIndex:0};parent.add(group);parts.push(group);
  const stages=await Promise.all(DOUGH_STAGES.map(async(stage,index)=>{
    const loaded=await addOriginal(stage.source,`native-dough-stage-${index+1}`,stage.label,1,[0,0,0],0,'20261029-dough',stage.display,{parent:group,register:false});
    loaded.group.visible=index===0;
    return {...stage,...loaded};
  }));
  const sourceSizes=stages.map(stage=>new T.Box3().setFromObject(stage.group,true).getSize(new T.Vector3()));
  const scale=Math.min(.55,(size.x-.12)/Math.max(...sourceSizes.map(s=>s.x)),(size.z-.10)/Math.max(...sourceSizes.map(s=>s.z)));
  if(!(scale>0))throw Error('The dough does not fit on the brown board.');
  for(const stage of stages){
    stage.group.scale.setScalar(scale);stage.group.updateWorldMatrix(true,true);
    const bounds=new T.Box3().setFromObject(stage.group,true),base=bounds.getCenter(new T.Vector3());base.y=bounds.min.y;
    const localAnchor=group.worldToLocal(anchor.clone()),localBase=group.worldToLocal(base);
    stage.group.position.add(localAnchor.sub(localBase));stage.group.updateWorldMatrix(true,true);
  }
  let index=0;
  function setStage(next){
    if(!Number.isInteger(next)||next<0||next>=stages.length)return false;
    const changed=index!==next;index=next;
    stages.forEach((stage,i)=>stage.group.visible=i===index);
    group.userData.stageIndex=index;
    canvas.dataset.doughStage=String(index+1);
    canvas.setAttribute('aria-label',`Kitchen scene. ${stages[index].label}. ${index<stages.length-1?'Press Space for the next dough stage.':'Final dough stage.'}`);
    invalidate();
    if(changed)window.dispatchEvent(new CustomEvent('kitchen:dough-stage',{detail:{index,label:stages[index].label,count:stages.length}}));
    return changed;
  }
  function advance(){return index<stages.length-1?setStage(index+1):false;}
  function onKey(event){
    if(event.code!=='Space'&&event.key!==' ')return;
    if(event.repeat||event.isComposing||event.ctrlKey||event.metaKey||event.altKey)return;
    const target=event.target;
    if(target instanceof Element && target.closest('input,textarea,select,button,[contenteditable=""],[contenteditable="true"],#knife-input'))return;
    event.preventDefault();advance();
  }
  const focusScene=()=>canvas.focus({preventScroll:true});
  canvas.tabIndex=0;canvas.addEventListener('pointerdown',focusScene);window.addEventListener('keydown',onKey);
  setStage(0);
  return {group,stages,anchor:anchor.clone(),woodBounds:woodWorld,scale,get index(){return index;},get current(){return stages[index];},advance,setStage,reset:()=>setStage(0),disconnectKeyboard(){window.removeEventListener('keydown',onKey);canvas.removeEventListener('pointerdown',focusScene);}};
}
