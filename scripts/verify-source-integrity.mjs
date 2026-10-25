import fs from 'node:fs';import crypto from 'node:crypto';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function load(file){const b=fs.readFileSync(file),n=b.readUInt32LE(12);return{j:JSON.parse(b.subarray(20,20+n)),bin:b.subarray(28+n),bytes:b}}
function data(g,i){const a=g.j.accessors[i],v=g.j.bufferViews[a.bufferView],components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],size={5126:4,5125:4,5123:2,5121:1}[a.componentType],start=(v.byteOffset||0)+(a.byteOffset||0);return g.bin.subarray(start,start+a.count*components*size)}
function check(ok,msg){if(!ok)throw Error(msg)}
const exp=load('output/warm-kitchen.glb');
const imageHashes=g=>g.j.images.map(im=>{const v=g.j.bufferViews[im.bufferView];return hash(g.bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength))});const exportedImages=new Set(imageHashes(exp));
const verified=[];
for(const file of ['kitchen 1 3d model.glb','kitchen 2 3d model.glb','wooden shelf 3d model.glb','kitchen oven 3d model.glb']){
 const original=load('/Users/cynthiafeng/Desktop/旧世界/'+file),current=load('assets/models/'+file);check(hash(original.bytes)===hash(current.bytes),file+' source changed');
 for(const sourceNode of original.j.nodes.filter(n=>n.mesh!==undefined)){const exportNode=exp.j.nodes.find(n=>n.name===sourceNode.name);check(exportNode,file+' source node missing');const sourcePrim=original.j.meshes[sourceNode.mesh].primitives[0],exportPrim=exp.j.meshes[exportNode.mesh].primitives[0];for(const key of Object.keys(sourcePrim.attributes))check(hash(data(original,sourcePrim.attributes[key]))===hash(data(exp,exportPrim.attributes[key])),file+' export changed '+key);check(hash(data(original,sourcePrim.indices))===hash(data(exp,exportPrim.indices)),file+' export changed indices')}
 for(const h of imageHashes(original))check(exportedImages.has(h),file+' original texture bytes missing');
 verified.push({file,sourceSHA256:hash(original.bytes),sourceUnchanged:true,exportedGeometryUVNormalsAndIndicesByteIdentical:true,exportedTextureImagesByteIdentical:true});
}
const table=load('assets/models/table 3d model.glb'),tableBackup=load('assets/originals/table-with-window-original.glb');for(const h of imageHashes(tableBackup))check(imageHashes(table).includes(h),'Table texture changed');check(table.j.accessors[table.j.meshes[0].primitives[0].attributes.POSITION].max[1]<.3,'Window still present in table model');
for(const n of exp.j.nodes.filter(n=>n.extras?.preserveOriginal)){const scale=n.scale||[1,1,1];check(Math.max(...scale)-Math.min(...scale)<.000001,'Nonuniform original model scale')}
const result={allOriginalModelGroupsUseUniformScale:true,originalModels:verified,tableTextureImagesByteIdentical:true,tableWindowRemoved:true};fs.writeFileSync('output/source-integrity.json',JSON.stringify(result,null,2));console.log(result);
