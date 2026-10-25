import fs from 'node:fs';
const src=fs.readFileSync('assets/originals/table-with-window-original.glb'),len=src.readUInt32LE(12),doc=JSON.parse(src.subarray(20,20+len)),bin=src.subarray(28+len);
const prim=doc.meshes[0].primitives[0];
function accessor(i){const a=doc.accessors[i],v=doc.bufferViews[a.bufferView],C={5126:Float32Array,5125:Uint32Array,5123:Uint16Array}[a.componentType],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];return new C(bin.buffer,bin.byteOffset+(v.byteOffset||0)+(a.byteOffset||0),a.count*n)}
const pos=accessor(prim.attributes.POSITION),idx=accessor(prim.indices),keep=[];
for(let i=0;i<idx.length;i+=3){if((pos[idx[i]*3+1]+pos[idx[i+1]*3+1]+pos[idx[i+2]*3+1])/3<.5)keep.push(idx[i],idx[i+1],idx[i+2])}
const remap=new Map(),old=[];const indices=new Uint32Array(keep.map(i=>{if(!remap.has(i)){remap.set(i,old.length);old.push(i)}return remap.get(i)}));
const chunks=[],views=[],accessors=[];let offset=0;
function append(b){const bytes=Buffer.from(b.buffer,b.byteOffset,b.byteLength),padded=Buffer.alloc(Math.ceil(bytes.length/4)*4);bytes.copy(padded);views.push({buffer:0,byteOffset:offset,byteLength:bytes.length});chunks.push(padded);offset+=padded.length;return views.length-1}
function attribute(data,template,min,max){accessors.push({...template,bufferView:append(data),byteOffset:0,count:old.length,...(min?{min,max}:{})});return accessors.length-1}
const attributes={};for(const [key,id] of Object.entries(prim.attributes)){const a=doc.accessors[id],src=accessor(id),n=src.length/a.count,out=new src.constructor(old.length*n);for(let i=0;i<old.length;i++)out.set(src.subarray(old[i]*n,(old[i]+1)*n),i*n);let min,max;if(key==='POSITION'){min=[Infinity,Infinity,Infinity];max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<out.length;i++){min[i%3]=Math.min(min[i%3],out[i]);max[i%3]=Math.max(max[i%3],out[i])}}attributes[key]=attribute(out,a,min,max)}
const indexAccessor=accessors.length;accessors.push({bufferView:append(indices),componentType:5125,count:indices.length,type:'SCALAR'});
const images=doc.images.map(im=>{const v=doc.bufferViews[im.bufferView];return{...im,bufferView:append(bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength))}});
const result={...doc,bufferViews:views,accessors,images,meshes:[{...doc.meshes[0],primitives:[{...prim,attributes,indices:indexAccessor}]}],buffers:[{byteLength:offset}]};
const json=Buffer.from(JSON.stringify(result)),j=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(j);const head=Buffer.alloc(20);head.writeUInt32LE(0x46546c67);head.writeUInt32LE(2,4);head.writeUInt32LE(28+j.length+offset,8);head.writeUInt32LE(j.length,12);head.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(offset);bh.writeUInt32LE(0x004e4942,4);fs.writeFileSync('assets/models/table 3d model.glb',Buffer.concat([head,j,bh,...chunks]));
console.log(JSON.stringify({keptTriangles:indices.length/3,removedTriangles:(idx.length-indices.length)/3,remainingHeight:accessors[attributes.POSITION].max[1],texturesPreserved:true}));
