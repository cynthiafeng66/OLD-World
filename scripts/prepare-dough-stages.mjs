// Keep the source files intact and make lightweight previews with the same atlases.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {load,displayLOD} from './model-display-utils.mjs';
const sources=['dough ball 3d model.glb','almond 3d model.glb','almond 3d model_副本.glb','almond kernel 3d model.glb'];
const labels=['Round dough','Oval dough','Irregular dough','Flattened dough'];
const hashes=g=>g.json.images.map(im=>{const v=g.json.bufferViews[im.bufferView];return crypto.createHash('sha256').update(g.bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength)).digest('hex');});
const stages=[];
for(const [i,file] of sources.entries()){
 const source='assets/models/'+file,display=`assets/parts/dough-stage-${i+1}-display.glb`,g=load(source);
 const sourceHash=crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
 const result=displayLOD(g,display),out=load(display);
 assert.deepEqual(hashes(g),hashes(out),'Preserve each original texture image byte for byte');assert.deepEqual(g.json.materials,out.json.materials,'Preserve source materials');
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),sourceHash,'Never modify the source model');
 stages.push({label:labels[i],source:file,display:display.split('/').at(-1),sourceSHA256:sourceHash,textureImagesUnchanged:true,materialsUnchanged:true,...result});
}
fs.writeFileSync('output/dough-stage-assets.json',JSON.stringify({passed:true,stages},null,2));console.log(JSON.stringify(stages.map(s=>({label:s.label,source:s.source,sourceTriangles:s.originalTriangles,displayTriangles:s.displayTriangles}))));
