import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// A four-burner hob in the original kitchen-2 model's local coordinates.
export function createRepairedStove(){
 const root=new T.Group();root.name='Repaired_Gas_Hob';root.userData={asset:'repaired-stove',replacementFor:'malformed cooktop geometry only'};
 const enamel=new T.MeshStandardMaterial({name:'Black enamel hob',color:0x202620,metalness:.32,roughness:.26});
 const iron=new T.MeshStandardMaterial({name:'Cast iron supports',color:0x242520,metalness:.52,roughness:.68});
 const cap=new T.MeshStandardMaterial({name:'Burner caps',color:0x181b18,metalness:.6,roughness:.48});
 const brass=new T.MeshStandardMaterial({name:'Brass burner rings',color:0x927143,metalness:.8,roughness:.38});
 function mesh(name,geometry,material,x,y,z){const o=new T.Mesh(geometry,material);o.name=name;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;root.add(o);return o}
 function rounded(name,w,h,d,x,y,z,material,radius=.0015){return mesh(name,new RoundedBoxGeometry(w,h,d,3,Math.min(radius,h/2,w/2,d/2)),material,x,y,z)}
 rounded('Rounded enamel surface',.314,.0058,.350,-.0765,.2158,.004,enamel,.0025);
 const burnerCenters=[[-.145,.105],[-.008,.105],[-.145,-.073],[-.008,-.073]];
 burnerCenters.forEach(([x,z],i)=>{
  mesh(`Burner ${i+1} drip tray`,new T.CylinderGeometry(.049,.048,.0018,64),enamel,x,.2196,z);
  const ring=mesh(`Burner ${i+1} brass ring`,new T.TorusGeometry(.0288,.0032,12,64),brass,x,.2245,z);ring.rotation.x=Math.PI/2;
  mesh(`Burner ${i+1} cap`,new T.CylinderGeometry(.0257,.0265,.0043,64),cap,x,.227,z);
  for(let k=0;k<28;k++){const a=k/28*Math.PI*2;const slot=rounded(`Burner ${i+1} gas port ${k+1}`,.0015,.0017,.0023,x+Math.cos(a)*.0294,.2247,z+Math.sin(a)*.0294,cap,.0004);slot.rotation.y=-a}
  // Four continuous rounded cast-iron arms, raised above the burner cap.
  const radius=.049;for(let k=0;k<4;k++){const a=k*Math.PI/2;const arm=rounded(`Burner ${i+1} support arm ${k+1}`,.035,.0048,.0062,x+Math.cos(a)*.0358,.2352,z+Math.sin(a)*.0358,iron,.0016);arm.rotation.y=-a;rounded(`Burner ${i+1} support foot ${k+1}`,.0065,.014,.0065,x+Math.cos(a)*radius,.2265,z+Math.sin(a)*radius,iron,.001)}
  const rim=mesh(`Burner ${i+1} support ring`,new T.TorusGeometry(.051,.0028,12,64),iron,x,.2295,z);rim.rotation.x=Math.PI/2;

 });
 return root;
}
