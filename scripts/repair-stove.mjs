import fs from 'node:fs';
import {decodeGLB,encodeGLB} from '../preserve-source-glb.js';
const input='assets/models/kitchen 2 3d model.glb',output='assets/originals/kitchen-2-stove-cleared.glb';
const file=fs.readFileSync(input),{json,bin}=decodeGLB(file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength));
const primitive=json.meshes[0].primitives[0];
function accessor(i){const a=json.accessors[i],v=json.bufferViews[a.bufferView],offset=bin.byteOffset+(v.byteOffset||0)+(a.byteOffset||0),count={SCALAR:1,VEC2:2,VEC3:3}[a.type],Ctor={5126:Float32Array,5125:Uint32Array,5123:Uint16Array}[a.componentType];return new Ctor(bin.buffer,offset,a.count*count)}
const positions=accessor(primitive.attributes.POSITION),indices=accessor(primitive.indices),kept=[];let removed=0;
// The counter, backsplash and extractor remain untouched. Remove only the old
// raised cooktop, malformed supports and pipework above the counter surface.
const region={minX:-.212,maxX:.059,minZ:-.138,maxZ:.176,minY:.2125,maxY:.30};
for(let i=0;i<indices.length;i+=3){let x=0,y=0,z=0;for(let k=0;k<3;k++){const offset=indices[i+k]*3;x+=positions[offset]/3;y+=positions[offset+1]/3;z+=positions[offset+2]/3}const replace=x>region.minX&&x<region.maxX&&z>region.minZ&&z<region.maxZ&&y>region.minY&&y<region.maxY;if(replace)removed++;else kept.push(indices[i],indices[i+1],indices[i+2])}
const a=json.accessors[primitive.indices],view=json.bufferViews[a.bufferView],originalCount=indices.length;indices.set(kept);a.count=kept.length;let minIndex=Infinity,maxIndex=-Infinity;for(const value of kept){minIndex=Math.min(minIndex,value);maxIndex=Math.max(maxIndex,value)}if(a.min)a.min=[minIndex];if(a.max)a.max=[maxIndex];
// Positions, normals, UVs, material definitions, and all encoded image data are
// retained byte for byte. The source GLB itself is never overwritten.
json.asset.extras={...json.asset.extras,stoveRepair:{original:input,removedTriangles:removed,region}};
fs.writeFileSync(output,Buffer.from(encodeGLB(json,bin)));
const report={source:input,corrected:output,originalTriangles:originalCount/3,retainedTriangles:kept.length/3,removedTriangles:removed,region,originalAttributeAndTextureBytesPreserved:true};
fs.writeFileSync('output/stove-repair.json',JSON.stringify(report,null,2));console.log(report);
