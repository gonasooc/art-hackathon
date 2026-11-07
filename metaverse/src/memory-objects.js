import * as THREE from '../vendor/three/three.module.js';
import {TRAIN} from './config.js';
import {box,tube,plaque} from './train-geometry.js';

const material=(color,roughness=.5,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
function ellipsoid(parent,pos,scale,mat){const m=new THREE.Mesh(new THREE.SphereGeometry(1,28,18),mat);m.position.set(...pos);m.scale.set(...scale);parent.add(m);return m;}
function leopard(){
 const g=new THREE.Group(),skin=material(0x171a19,.92),soft=material(0x30322d,.7),eye=material(0xb3a362,.25);
 const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#292c29';ctx.fillRect(0,0,256,256);
 for(let i=0;i<100;i++){const x=(i*73)%256,y=(i*131)%256;ctx.strokeStyle='#141714';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(x,y,5+(i%4),4, i,0,Math.PI*1.6);ctx.stroke();}
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;skin.map=texture;
 ellipsoid(g,[0,.75,0],[.82,.24,.26],skin);ellipsoid(g,[-.49,.78,0],[.24,.29,.27],skin);
 ellipsoid(g,[.55,.72,0],[.29,.27,.27],skin);
 for(const [x,z] of [[-.45,-.2],[-.4,.2],[.48,-.2],[.57,.2]]){
  ellipsoid(g,[x,.4,z],[.072,.32,.08],skin);ellipsoid(g,[x-.06,.1,z],[.14,.07,.1],skin);
 }
 ellipsoid(g,[-.66,.92,0],[.18,.24,.19],skin);ellipsoid(g,[-.88,1.04,0],[.23,.18,.2],skin);
 ellipsoid(g,[-1.06,.99,0],[.12,.085,.145],soft);ellipsoid(g,[-1.18,1.02,0],[.045,.035,.065],skin);
 for(const z of [-.16,.16]){
  ellipsoid(g,[-.78,1.2,z],[.075,.09,.05],skin);
  ellipsoid(g,[-1.01,1.09,z*1.12],[.034,.022,.014],eye);
  ellipsoid(g,[-1.03,1.09,z*1.16],[.012,.022,.009],material(0x070a08));
 }
 tube(g,[[.65,.83,0],[.96,.65,.04],[1.22,.3,.08],[1.45,.25,.1],[1.53,.5,.1]],.045,skin);
 g.rotation.y=-Math.PI/2;g.scale.setScalar(.8);return g;
}
function chair(){
 const g=new THREE.Group(),chrome=material(0x8b9490,.25,.8),seat=material(0x3c5048,.72);
 box(g,[.68,.13,.64],[0,.58,0],seat);box(g,[.68,.65,.12],[0,.99,-.27],seat,[.12,0,0]);
 for(const x of [-.34,.34]){
  tube(g,[[x,.06,.32],[x,.58,.24],[x,.85,.24],[x,.85,-.24],[x,.08,-.32]],.022,chrome);
  tube(g,[[x,.64,-.28],[x,1.35,-.34],[x,1.36,-.18]],.019,chrome);
 }
 return g;
}
function smokeTexture(){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),a=x.createRadialGradient(32,32,0,32,32,32);a.addColorStop(0,'rgba(255,255,255,.8)');a.addColorStop(.45,'rgba(255,255,255,.3)');a.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=a;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);}
export class MemoryObjects {
 constructor(scene){
  this.scene=scene;this.targets=[];this.ray=new THREE.Raycaster();this.sprite=smokeTexture();this.car='00';
  this.add('01-leopard','01',leopard(),[-9,TRAIN.floorY,TRAIN.centerZ+.55],[-9,1.65,-7.35]);
  const seat=chair();seat.rotation.y=Math.PI/2;seat.scale.setScalar(.85);
  this.add('01-chair','01',seat,[-8.25,TRAIN.floorY,TRAIN.centerZ-.85],[-8.48,1.89,-8.75]);
  this.setCar('00');
 }
 add(id,car,group,position,aim=position){
  group.position.set(...position);group.name=id;group.updateMatrixWorld(true);
  const target={id,car,group,aim:new THREE.Vector3(...aim),progress:null,gone:false,uniforms:[],focusUniforms:[]};
  group.traverse(m=>{if(!m.isMesh)return;m.userData.memoryId=id;m.userData.memoryCastsShadow=m.castShadow;m.material=m.material.clone();m.material.transparent=true;
   const uniform={value:0},focus={value:0};target.uniforms.push(uniform);target.focusUniforms.push(focus);
   m.material.onBeforeCompile=shader=>{
    shader.uniforms.memoryDissolve=uniform;shader.uniforms.memoryFocus=focus;
    shader.fragmentShader=`uniform float memoryDissolve;
uniform float memoryFocus;
float memoryHash(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,42.731)))*43758.5453);}
float memoryNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(memoryHash(i),memoryHash(i+vec3(1,0,0)),f.x),mix(memoryHash(i+vec3(0,1,0)),memoryHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(memoryHash(i+vec3(0,0,1)),memoryHash(i+vec3(1,0,1)),f.x),mix(memoryHash(i+vec3(0,1,1)),memoryHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
`+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`#include <alphatest_fragment>\nfloat grain=0.65*memoryNoise(vViewPosition*7.0)+0.35*memoryNoise(vViewPosition*21.0); if(memoryDissolve>grain) discard;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`float memoryRim=pow(1.0-abs(dot(normal,normalize(vViewPosition))),2.5); outgoingLight+=vec3(0.48,0.65,0.59)*memoryFocus*memoryRim*(1.0-memoryDissolve);\n#include <opaque_fragment>`);
   };m.material.customProgramCacheKey=()=> 'memory-smoke-v2';
  });
  this.scene.add(group);this.targets.push(target);
 }
 setCar(car){this.car=car;this.focusedId=null;for(const t of this.targets)t.group.visible=t.car===car&&!t.gone;}
 reset(){for(const t of this.targets){t.gone=false;t.progress=null;t.group.traverse(m=>{if(m.isMesh){m.material.opacity=1;m.material.depthWrite=true;m.castShadow=m.userData.memoryCastsShadow;}});t.uniforms.forEach(u=>u.value=0);if(t.smoke){this.scene.remove(t.smoke);t.smoke.geometry.dispose();t.smoke.material.dispose();t.smoke=null;}}this.setCar('00');}
 pick(gaze,camera){
  if(!gaze?.valid){this.focusedId=null;return null;}
  camera.updateMatrixWorld();this.ray.setFromCamera(new THREE.Vector2(gaze.x*2-1,1-gaze.y*2),camera);
  const active=this.targets.filter(t=>t.car===this.car&&!t.gone&&t.progress===null);
  const hit=this.ray.intersectObjects(active.map(t=>t.group),true).find(hit=>hit.distance<6&&hit.object.userData.memoryId);
  this.focusedId=hit?.object.userData.memoryId||null;return this.focusedId;
 }
 dissolve(id){
  const t=this.targets.find(t=>t.id===id&&t.car===this.car&&!t.gone&&t.progress===null);if(!t)return false;
  t.progress=0;t.group.traverse(m=>{if(m.isMesh){m.material.depthWrite=false;m.castShadow=false;}});t.group.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(t.group),size=bounds.getSize(new THREE.Vector3());
  const positions=new Float32Array(180*3),origin=[];
  for(let i=0;i<180;i++){const p=[bounds.min.x+((i*37.13)%1)*size.x,bounds.min.y+((i*23.71)%1)*size.y,bounds.min.z+((i*61.17)%1)*size.z];positions.set(p,i*3);origin.push(p);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  t.smoke=new THREE.Points(geometry,new THREE.PointsMaterial({map:this.sprite,color:t.car==='00'?0xd3b5a0:0xadb7b4,size:.32,transparent:true,opacity:0,depthWrite:false}));
  t.origins=origin;this.scene.add(t.smoke);return true;
 }
 update(dt,reduced){
  this.cueTime=(this.cueTime||0)+dt;
  for(const t of this.targets){const strength=t.car===this.car&&!t.gone&&t.progress===null?(this.focusedId===t.id?.2:(reduced?.055:.055+.015*Math.sin(this.cueTime*.9))):0;t.focusUniforms.forEach(u=>u.value=strength);}
  for(const t of this.targets){if(t.progress===null)continue;t.progress+=dt;const duration=reduced?.35:1.3,p=Math.min(1,t.progress/duration);
   t.uniforms.forEach(u=>u.value=Math.min(1,p*1.3));t.group.traverse(m=>{if(m.isMesh)m.material.opacity=1-p;});t.group.visible=p<.85;
   const attr=t.smoke.geometry.attributes.position;
   for(let i=0;i<t.origins.length;i++){const [x,y,z]=t.origins[i];attr.setXYZ(i,x+(reduced?0:Math.sin(i+t.progress*1.6)*p*.35),y+(reduced?0:p*(.8+(i%9)*.1)),z+(reduced?0:Math.cos(i*.7+t.progress)*p*.3));}
   attr.needsUpdate=true;t.smoke.material.opacity=(reduced?.15:.48)*Math.sin(Math.PI*p);t.smoke.material.size=.2+p*.55;
   if(p>=1){t.gone=true;t.progress=null;t.group.visible=false;this.scene.remove(t.smoke);t.smoke.geometry.dispose();t.smoke.material.dispose();t.smoke=null;}
  }
 }
 complete(){return this.targets.filter(t=>t.car===this.car).every(t=>t.gone);}
}
export function buildHospital(){
 const group=new THREE.Group();group.name='hospital-01';const z=TRAIN.centerZ;
 const red=material(0x631d24,.32,.2),floor=material(0x5c6863,.3,.3),metal=material(0xa0aaa2,.25,.75),cyan=new THREE.MeshBasicMaterial({color:0x9be9df,toneMapped:false});
 box(group,[15,.12,3.45],[-7,1.1,z],floor);
 for(const side of [-1,1]){
  // Large observation window in one wall; the room behind it contains no people.
  for(let x=-14;x<1;x+=2){
   if(side===-1&&(x===-6||x===-4)){box(group,[1.97,1,.12],[x,1.61,z+side*1.7],red);box(group,[1.97,.62,.12],[x,3.79,z+side*1.7],red);}
   else box(group,[1.97,2.9,.12],[x,2.6,z+side*1.7],red);
  }
  box(group,[15,.09,.08],[-7,1.2,z+side*1.61],metal);
  for(let x=-13;x<0;x+=2.4)box(group,[1.7,.045,.16],[x,3.98,z+side*.95],cyan);
 }
 box(group,[15,.12,3.45],[-7,4.1,z],red);box(group,[.14,3,3.45],[-14.7,2.6,z],red);
 const clinical=material(0x8ba5a0,.7);
 box(group,[4.6,3,.1],[-5.5,2.6,z-4],clinical);box(group,[4.6,.1,2.3],[-5.5,1.1,z-2.85],floor);
 box(group,[2.3,.25,.9],[-5.6,1.8,z-2.85],material(0xd5ddd3,.9));
 for(const x of [-6.5,-4.7])for(const dz of [-3.1,-2.6])box(group,[.04,.65,.04],[x,1.45,z+dz],metal);
 box(group,[.55,.45,.08],[-4.1,2.55,z-3.2],material(0x122c30));
 box(group,[.44,.018,.01],[-4.1,2.55,z-3.15],cyan);
 const glass=new THREE.MeshBasicMaterial({color:0x5c9f9a,transparent:true,opacity:.55});
 box(group,[4.2,1.35,.03],[-5.5,2.8,z-1.61],glass);
 for(let x=-7.55;x<-3.4;x+=.17)box(group,[.018,1.3,.03],[x,2.8,z-1.58],metal);
 box(group,[4.3,.04,.08],[-5.5,3.48,z-1.55],metal);box(group,[4.3,.04,.08],[-5.5,2.12,z-1.55],metal);
 plaque(group,'01','병원',.65,.3,[-14.59,3.4,z],[0,Math.PI/2,0]);
 for(const x of [-3,-8,-12]){const light=new THREE.PointLight(0x94e4da,7,8,2);light.position.set(x,3.7,z);group.add(light);}
 return group;
}
