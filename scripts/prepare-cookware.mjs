import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {load,values,displayLOD} from './model-display-utils.mjs';
const file='assets/models/cookware 3d model.glb',g=load(file),primitive=g.json.meshes[0].primitives[0],position=values(g,primitive.attributes.POSITION),indices=values(g,primitive.indices);
const parent=Int32Array.from({length:position.length/3},(_,i)=>i);
function find(i){while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i]}return i}
function union(a,b){a=find(a);b=find(b);if(a!==b)parent[b]=a}
// Rejoin UV seams before finding the two separate source objects.
const weld=new Map();for(let i=0;i<parent.length;i++){const key=[position[i*3],position[i*3+1],position[i*3+2]].map(v=>Math.round(v*1e5)).join(',');const same=weld.get(key);if(same!==undefined)union(i,same);else weld.set(key,i)}
for(let i=0;i<indices.length;i+=3){union(indices[i],indices[i+1]);union(indices[i],indices[i+2])}
const groups=new Map();for(let i=0;i<indices.length;i+=3){const id=find(indices[i]);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(indices[i],indices[i+1],indices[i+2])}
assert.equal(groups.size,2,'Source contains exactly a frying pan and a stockpot');
const report=[];let triangleCount=0;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const images=g=>g.json.images.map(im=>{const v=g.json.bufferViews[im.bufferView];return hash(g.bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength))});
for(const selected of groups.values()){
 let minX=Infinity,minY=Infinity,maxY=-Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;
 // The low, flat base provides a body center without including either handle.
 for(const i of selected){const x=position[i*3],y=position[i*3+1],z=position[i*3+2];minY=Math.min(minY,y);maxY=Math.max(maxY,y);if(y<.004){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z)}}
 const name=maxY>.25?'stockpot':'frying-pan',label=name==='stockpot'?'Stockpot':'Frying_pan';
 const part=load(file),prim=part.json.meshes[0].primitives[0],indexAccessor=part.json.accessors[prim.indices];values(part,prim.indices).set(selected);indexAccessor.count=selected.length;
 const center=[(minX+maxX)/2,minY,(minZ+maxZ)/2];
 part.json.nodes[0].name=label;part.json.nodes[0].translation=center.map(v=>-v);part.json.asset.extras={source:'cookware 3d model.glb',part:name,originalGeometryUVsMaterialsAndImagesPreserved:true};
 const output='assets/models/'+name+'.glb';displayLOD(part,output,{simplify:false});const full=load(output);
 assert.deepEqual(images(g),images(full));assert.deepEqual(g.json.materials,full.json.materials);
 const packed=full.json.meshes[0].primitives[0],exportedIndices=values(full,packed.indices);
 for(const [attribute,id]of Object.entries(primitive.attributes)){
  const source=values(g,id),out=values(full,packed.attributes[attribute]),dim={VEC2:2,VEC3:3,VEC4:4}[g.json.accessors[id].type];
  for(let i=0;i<selected.length;i++)for(let d=0;d<dim;d++)assert.equal(out[exportedIndices[i]*dim+d],source[selected[i]*dim+d],name+' source attributes changed');
 }
 const display=displayLOD(full,'assets/parts/'+name+'-display.glb');triangleCount+=selected.length/3;
 report.push({name,sourceTriangles:selected.length/3,center,displayTriangles:display.displayTriangles,sourceGeometryNormalsUVsAndTextureImagesUnchanged:true});
}
assert.equal(triangleCount,indices.length/3,'All source faces assigned exactly once');
fs.writeFileSync('output/cookware-assets.json',JSON.stringify({passed:true,sourceFacesPartitionedWithoutLoss:true,parts:report},null,2));console.log(report);
