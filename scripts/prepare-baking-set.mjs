import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {load,values,displayLOD} from './model-display-utils.mjs';
const file='assets/models/kitchen baking set 3d model.glb',g=load(file),prim=g.json.meshes[0].primitives[0],position=values(g,prim.attributes.POSITION),indices=values(g,prim.indices);
const parent=Int32Array.from({length:position.length/3},(_,i)=>i);
function find(i){while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i]}return i}function union(a,b){a=find(a);b=find(b);if(a!==b)parent[b]=a}
const weld=new Map();for(let i=0;i<parent.length;i++){const key=[position[i*3],position[i*3+1],position[i*3+2]].map(v=>Math.round(v*1e5)).join(',');const same=weld.get(key);if(same!==undefined)union(i,same);else weld.set(key,i)}
for(let i=0;i<indices.length;i+=3){union(indices[i],indices[i+1]);union(indices[i],indices[i+2])}
const components=new Map();for(let i=0;i<indices.length;i+=3){const id=find(indices[i]);let c=components.get(id);if(!c){c={id,triangles:0,min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};components.set(id,c)}c.triangles++;for(let v=0;v<3;v++)for(let d=0;d<3;d++){const value=position[indices[i+v]*3+d];c.min[d]=Math.min(c.min[d],value);c.max[d]=Math.max(c.max[d],value)}}
const towels=[...components.values()].filter(c=>c.min[0]>.36&&c.max[1]<.04&&c.max[2]>.19);assert.equal(towels.length,1,'Identify only the low, right-hand red and white towel');const towel=towels[0],kept=[];
for(let i=0;i<indices.length;i+=3)if(find(indices[i])!==towel.id)kept.push(indices[i],indices[i+1],indices[i+2]);
const retained=[...components.values()].filter(c=>c.id!==towel.id),selections=retained.map(()=>[]),lookup=new Map(retained.map((c,i)=>[c.id,i]));
for(let i=0;i<indices.length;i+=3){const group=lookup.get(find(indices[i]));if(group!==undefined)selections[group].push(indices[i],indices[i+1],indices[i+2])}
// Spread the larger ingredients around the work board without changing shapes.
// Footprint centers in the layout frame; room.js moves the group to the counter edge.
const anchor=[-.3,-2.9],groupScale=2.6;
const placement={878992:['Board_and_rolling_pin',-.15,-2.77,1.75],266930:['Flour_pouch',-1.52,-2.65,2.6],633235:['Egg_bowl',.59,-2.62,2.6],977715:['Ingredient_jar',.98,-2.98,1.8],447203:['Milk_jug',-1.02,-2.62,2.6],260127:['Butter_dish',1.0,-2.60,2.2]};
const part=load(file),originalLength=part.bin.length,bin=new Uint8Array(originalLength+kept.length*4);bin.set(part.bin);part.bin=bin;part.json.meshes=[];part.json.nodes=[{name:'Baking_set_without_towel',children:retained.map((_,i)=>i+1)}];part.json.scenes=[{nodes:[0]}];part.json.scene=0;let offset=originalLength;
for(const [i,component]of retained.entries()){
 const selected=Uint32Array.from(selections[i]),view=part.json.bufferViews.length;part.bin.set(new Uint8Array(selected.buffer),offset);part.json.bufferViews.push({buffer:0,byteOffset:offset,byteLength:selected.byteLength});offset+=selected.byteLength;
 const accessor=part.json.accessors.length;part.json.accessors.push({bufferView:view,componentType:5125,count:selected.length,type:'SCALAR'});const primitive=structuredClone(prim);primitive.indices=accessor;part.json.meshes.push({primitives:[primitive]});const [name,x,z,size]=placement[component.id],scale=size/groupScale,translation=[(x-anchor[0])/groupScale-scale*(component.min[0]+component.max[0])/2,-scale*component.min[1],(z-anchor[1])/groupScale-scale*(component.min[2]+component.max[2])/2];part.json.nodes.push({name:'Baking_'+name,mesh:i,translation,scale:[scale,scale,scale]});
}
part.json.buffers=[{byteLength:bin.length}];part.json.asset.extras={source:'kitchen baking set 3d model.glb',removed:'Right-hand red and white towel only',layout:'Larger original-proportion items spread around the work board',retainedOriginalGeometryUVsAndTextures:true};
const output='assets/models/baking-set-no-towel.glb';displayLOD(part,output,{simplify:false});const full=load(output);
for(const [m,selected]of selections.entries()){const q=full.json.meshes[m].primitives[0],outIndices=values(full,q.indices);for(const [name,id]of Object.entries(prim.attributes)){const original=values(g,id),out=values(full,q.attributes[name]),dim={VEC2:2,VEC3:3,VEC4:4}[g.json.accessors[id].type];for(let i=0;i<selected.length;i++)for(let d=0;d<dim;d++)assert.equal(original[selected[i]*dim+d],out[outIndices[i]*dim+d],'Retained source attributes changed')}}
const hashes=g=>g.json.images.map(im=>{const v=g.json.bufferViews[im.bufferView];return crypto.createHash('sha256').update(g.bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength)).digest('hex')});assert.deepEqual(hashes(g),hashes(full));assert.deepEqual(g.json.materials,full.json.materials);
const display=displayLOD(full,'assets/parts/baking-set-no-towel-display.glb');assert.deepEqual(hashes(g),hashes(load('assets/parts/baking-set-no-towel-display.glb')));
const report={passed:true,sourceTriangles:indices.length/3,retainedTriangles:kept.length/3,removedTowel:towel,retainedComponents:components.size-1,retainedGeometryNormalsUVsAndTexturesUnchanged:true,displayTriangles:display.displayTriangles};fs.writeFileSync('output/baking-set-assets.json',JSON.stringify(report,null,2));console.log(report);
