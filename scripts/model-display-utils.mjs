import fs from 'node:fs';
import {MeshoptSimplifier} from '../vendor/meshoptimizer/meshopt_simplifier.js';
import {decodeGLB,encodeGLB} from '../preserve-source-glb.js';
await MeshoptSimplifier.ready;
export const load=file=>{const b=fs.readFileSync(file);return decodeGLB(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength))};
export const save=(file,g)=>fs.writeFileSync(file,Buffer.from(encodeGLB(g.json,g.bin)));
export function values(g,i){const a=g.json.accessors[i],v=g.json.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],C={5126:Float32Array,5125:Uint32Array,5123:Uint16Array,5121:Uint8Array}[a.componentType];return new C(g.bin.buffer,g.bin.byteOffset+(v.byteOffset||0)+(a.byteOffset||0),a.count*n)}
export function displayLOD(g,file,{simplify=true}={}){
 const j=structuredClone(g.json),chunks=[];let length=0;j.bufferViews=[];j.accessors=[];
 function append(data){const bytes=new Uint8Array(data.buffer,data.byteOffset,data.byteLength),padded=new Uint8Array(Math.ceil(bytes.length/4)*4);padded.set(bytes);const id=j.bufferViews.length;j.bufferViews.push({buffer:0,byteOffset:length,byteLength:bytes.length});chunks.push(padded);length+=padded.length;return id}
 function accessor(data,type,bounds={}){const id=j.accessors.length;j.accessors.push({bufferView:append(data),componentType:data instanceof Float32Array?5126:5125,count:data.length/({SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[type]),type,...bounds});return id}
 let triangles=0,originalTriangles=0;
 j.meshes.forEach((mesh,m)=>mesh.primitives.forEach((prim,p)=>{
  const original=g.json.meshes[m].primitives[p],position=values(g,original.attributes.POSITION),uv=values(g,original.attributes.TEXCOORD_0),input=Uint32Array.from(values(g,original.indices));
  const target=Math.floor(input.length*.055/3)*3;
  const indices=simplify?MeshoptSimplifier.simplifyWithAttributes(input,position,3,uv,2,[1,1],null,target,.001,['LockBorder','Sparse'])[0]:input;
  const [remap,count]=MeshoptSimplifier.compactMesh(indices);prim.attributes={};
  for(const [name,id] of Object.entries(original.attributes)){
   const old=g.json.accessors[id],source=values(g,id),dim={VEC2:2,VEC3:3,VEC4:4}[old.type],packed=new source.constructor(count*dim),min=Array(dim).fill(Infinity),max=Array(dim).fill(-Infinity);
   for(let n=0;n<remap.length;n++){const dest=remap[n];if(dest===0xffffffff)continue;for(let k=0;k<dim;k++){const value=source[n*dim+k];packed[dest*dim+k]=value;min[k]=Math.min(min[k],value);max[k]=Math.max(max[k],value)}}
   prim.attributes[name]=accessor(packed,old.type,name==='POSITION'?{min,max}:{});
  }
  prim.indices=accessor(indices,'SCALAR');triangles+=indices.length/3;originalTriangles+=input.length/3;
 }));
 j.images=(g.json.images||[]).map(im=>{const view=g.json.bufferViews[im.bufferView];return{...im,bufferView:append(g.bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength))}});
 const bin=new Uint8Array(length);let offset=0;for(const chunk of chunks){bin.set(chunk,offset);offset+=chunk.length}j.buffers=[{byteLength:length}];save(file,{json:j,bin});return {file,originalTriangles,displayTriangles:triangles,textureImagesCopiedVerbatim:true};
}
