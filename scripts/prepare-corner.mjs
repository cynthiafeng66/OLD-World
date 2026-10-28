// Fill the L-junction using cropped copies of original kitchen faces/UVs.
// Existing kitchen models and their images are never rewritten.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {load,values,save} from './model-display-utils.mjs';
const source=load('assets/models/kitchen 1 3d model.glb'),primitive=source.json.meshes[0].primitives[0];
const positions=values(source,primitive.attributes.POSITION),normals=values(source,primitive.attributes.NORMAL),uvs=values(source,primitive.attributes.TEXCOORD_0),indices=values(source,primitive.indices);
function clip(poly,axis,value,above){const result=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ia=above?a[axis]>=value:a[axis]<=value,ib=above?b[axis]>=value:b[axis]<=value;if(ia)result.push(a);if(ia!==ib){const t=(value-a[axis])/(b[axis]-a[axis]);result.push(a.map((n,k)=>n+(b[k]-n)*t));}}return result;}
function crop(poly,limits){for(const [axis,value,above]of limits){poly=clip(poly,axis,value,above);if(poly.length<3)return [];}return poly;}
const row=i=>{const id=indices[i];return [...positions.subarray(id*3,id*3+3),...normals.subarray(id*3,id*3+3),...uvs.subarray(id*2,id*2+2)];};
function triangles(poly,out){for(let k=1;k<poly.length-1;k++)out.push(poly[0],poly[k],poly[k+1]);}
const cabinet=[],patch=[],topPatch=[];
const world=a=>[-.5+a[0]*7.4,.02+a[1]*7.4,-2.5+a[2]*7.4,...a.slice(3)];
const sourceMin=.40,sourceMax=.485,sourceWorldMin=-.5+sourceMin*7.4,repeatWidth=(sourceMax-sourceMin)*7.4;
const cornerMin=3.116,cornerMax=4.22;
for(let i=0;i<indices.length;i+=3){
 const triangle=[row(i),row(i+1),row(i+2)];
 const cropped=crop(triangle,[[0,sourceMin,true],[0,sourceMax,false]]);
 if(cropped.length)for(let x=cornerMin;x<cornerMax;x+=repeatWidth){
  let poly=cropped.map(a=>{const v=world(a);v[0]+=x-sourceWorldMin;return v;});
  poly=crop(poly,[[0,cornerMax,false]]);triangles(poly,cabinet);
 }
 const tile=crop(triangle,[[0,.322,true],[0,.352,false],[1,.134,true],[1,.154,false],[2,-.115,false]]);
 if(tile.length)triangles(tile,patch);
 if(triangle.every(v=>v[4]>.65)){
  const top=crop(triangle,[[0,sourceMin,true],[0,sourceMax,false],[1,.130,true],[1,.136,false],[2,.02,true],[2,.06,false]]);
  if(top.length)triangles(top,topPatch);
 }
}
assert.ok(cabinet.length>10000);assert.ok(patch.length>100);assert.ok(topPatch.length>100);
const tiles=[];
// A return of original green tiles follows the right wall into the original hob backsplash.
const limits={x:4.075,zMin:-3.43,zMax:-1.415,yMin:.992,yMax:1.305};
for(let z=limits.zMin;z<limits.zMax;z+=.222)for(let y=limits.yMin;y<limits.yMax;y+=.148){
 for(let i=0;i<patch.length;i+=3){
  let poly=patch.slice(i,i+3).map(a=>{
   const v=world(a);return [limits.x-(v[2]+3.4028),y+(a[1]-.134)*7.4,z+(a[0]-.322)*7.4,-a[5],a[4],a[3],a[6],a[7]];
  });
  poly=crop(poly,[[1,limits.yMin,true],[1,limits.yMax,false],[2,limits.zMin,true],[2,limits.zMax,false]]);
  triangles(poly,tiles);
 }
}
// A solid closure bridges the original counter-front separation. Its top is
// copied from the clear wooden surface, not from the sink or tap region.
const bridge=[];
for(let x=2.465;x<4.10;x+=repeatWidth)for(let i=0;i<topPatch.length;i+=3){
 let poly=topPatch.slice(i,i+3).map(a=>{const v=world(a);v[0]+=x-sourceWorldMin;v[2]=-1.74+(a[2]-.02)/.04*.31;return v;});
 poly=crop(poly,[[0,4.10,false]]);triangles(poly,bridge);
}
function sampleUV(point,axis,direction=1){let nearest=Infinity,uv;for(let i=0;i<positions.length;i+=3){if(normals[i+axis]*direction<.7)continue;let d=0;for(let k=0;k<3;k++)d+=(positions[i+k]-point[k])**2;if(d<nearest){nearest=d;uv=[uvs[i/3*2],uvs[i/3*2+1]];}}return uv;}
const woodUV=sampleUV([.44,.130,.11],2),greenUV=sampleUV([.44,.10,.105],2),tileUV=sampleUV([.337,.143,-.122],2);
function quad(points,normal,uv,out=bridge){const verts=points.map(p=>[...p,...normal,...uv]);triangles(verts,out);}
quad([[2.465,.955,-1.43],[4.10,.955,-1.43],[4.10,.994,-1.43],[2.465,.994,-1.43]],[0,0,1],woodUV);
quad([[2.465,.02,-1.438],[4.10,.02,-1.438],[4.10,.955,-1.438],[2.465,.955,-1.438]],[0,0,1],greenUV);
quad([[4.075,limits.yMin,-1.415],[4.222,limits.yMin,-1.415],[4.222,limits.yMax,-1.415],[4.075,limits.yMax,-1.415]],[0,0,1],tileUV,tiles);
quad([[4.075,limits.yMax,-3.43],[4.075,limits.yMax,-1.415],[4.222,limits.yMax,-1.415],[4.222,limits.yMax,-3.43]],[0,1,0],tileUV,tiles);
const json={asset:{version:'2.0',generator:'Original kitchen corner completion'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:'Kitchen_corner_completion',children:[1,2,3]},{name:'Corner_cabinet_original_faces',mesh:0},{name:'Corner_green_tile_return',mesh:1},{name:'Counter_front_seam_closure',mesh:2}],meshes:[],materials:structuredClone(source.json.materials),textures:structuredClone(source.json.textures),samplers:structuredClone(source.json.samplers),images:[],bufferViews:[],accessors:[],buffers:[]};
const chunks=[];let offset=0;
function append(bytes){const padded=new Uint8Array(Math.ceil(bytes.byteLength/4)*4);padded.set(new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength));const id=json.bufferViews.length;json.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.byteLength});offset+=padded.length;chunks.push(padded);return id;}
function attribute(data,type,min,max){const id=json.accessors.length;json.accessors.push({bufferView:append(data),componentType:5126,count:data.length/({VEC2:2,VEC3:3}[type]),type,...(min?{min,max}:{})});return id;}
for(const vertices of [cabinet,tiles,bridge]){
 const attributes={};for(const [name,start,size,type]of [['POSITION',0,3,'VEC3'],['NORMAL',3,3,'VEC3'],['TEXCOORD_0',6,2,'VEC2']]){const data=Float32Array.from(vertices.flatMap(v=>v.slice(start,start+size))),min=Array(size).fill(Infinity),max=Array(size).fill(-Infinity);for(let i=0;i<data.length;i++) {min[i%size]=Math.min(min[i%size],data[i]);max[i%size]=Math.max(max[i%size],data[i]);}attributes[name]=attribute(data,type,name==='POSITION'?min:null,max);}json.meshes.push({primitives:[{attributes,material:primitive.material||0}]});
}
for(const im of source.json.images){const view=source.json.bufferViews[im.bufferView];json.images.push({...im,bufferView:append(source.bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength))});}
const bin=new Uint8Array(offset);let cursor=0;for(const chunk of chunks){bin.set(chunk,cursor);cursor+=chunk.length;}json.buffers=[{byteLength:bin.length}];
assert.ok(bridge.length>100);
const output='assets/models/kitchen-corner-completion.glb';save(output,{json,bin});
const out=load(output),hashes=g=>g.json.images.map(im=>{const v=g.json.bufferViews[im.bufferView];return crypto.createHash('sha256').update(g.bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength)).digest('hex');});assert.deepEqual(hashes(source),hashes(out));assert.deepEqual(source.json.materials,out.json.materials);
const report={passed:true,source:'kitchen 1 3d model.glb',output,originalMaterialsAndImageBytesUnchanged:true,cornerBounds:[cornerMin,cornerMax],cabinetTriangles:cabinet.length/3,tileTriangles:tiles.length/3,bridgeTriangles:bridge.length/3,tileLimits:limits};fs.writeFileSync('output/corner-assets.json',JSON.stringify(report,null,2));console.log(report);
