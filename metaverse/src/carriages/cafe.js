import * as THREE from '../../vendor/three/three.module.js';
import {box,tube} from '../train-geometry.js';
import {Z,F,mat,wood,grain,ellipsoid,ring,sideWindow,ribs,endDoor,light,mountainScenery,cloudSky} from './memory-room-kit.js';

function teacup(parent,position,porcelain,brass){
  const group=new THREE.Group();group.position.set(...position);parent.add(group);
  const points=[[.001,.035],[.065,.035],[.08,.05],[.095,.095],[.13,.17],[.145,.23],[.135,.235],[.12,.18],[.08,.08],[.001,.065]].map(p=>new THREE.Vector2(...p));
  group.add(new THREE.Mesh(new THREE.LatheGeometry(points,40),porcelain));
  ellipsoid(group,[0,.02,0],[.23,.022,.23],porcelain);ring(group,.21,.005,[0,.033,0],brass);
  ring(group,.14,.005,[0,.233,0],brass);
  const tea=new THREE.Mesh(new THREE.CircleGeometry(.12,40),mat(0x704320,.16));tea.rotation.x=-Math.PI/2;tea.position.y=.187;group.add(tea);
  const handle=ring(group,.069,.015,[0,.153,.16],porcelain,[0,Math.PI/2,0]);handle.scale.y=1.07;
}
function chairs(fabric,timber){
  const group=new THREE.Group();
  for(const side of [-1,1]){
    const chair=new THREE.Group();chair.position.z=side*1.14;chair.rotation.y=side===1?Math.PI:0;group.add(chair);
    ellipsoid(chair,[0,.47,0],[.57,.19,.49],fabric);ellipsoid(chair,[0,.64,.02],[.46,.12,.42],fabric);
    const back=ellipsoid(chair,[0,.91,-.31],[.55,.49,.18],fabric);back.rotation.x=-.16;
    for(const x of [-.46,.46]){
      ellipsoid(chair,[x,.74,.02],[.115,.25,.48],fabric);
      tube(chair,[[x,.9,.37],[x,.98,.15],[x,1.07,-.2],[x*.8,1.3,-.32]],.012,mat(0x635f59));
      for(const z of [-.3,.3])box(chair,[.075,.25,.075],[x*.8,.16,z],timber,[0,0,x*.15]);
    }
  }
  return group;
}
function table(timber){
  const group=new THREE.Group();box(group,[1.25,.09,1.2],[0,.94,0],timber);box(group,[.22,.86,.32],[0,.46,0],timber);box(group,[.7,.06,.62],[0,.04,0],timber);return group;
}
export function buildCafeCarriage(){
  const group=new THREE.Group();group.name='cafe-04';
  const timber=wood(0x514033),trim=wood(0x382d24),brass=mat(0x9d8b61,.35,.65),fabric=grain(0x555350,17);
  box(group,[16,.15,3.95],[-7,F-.09,Z],grain(0x555451));
  for(const side of [-1,1]){
    box(group,[16,.93,.13],[-7,1.49,Z+side*1.98],timber);
    box(group,[16,.05,.15],[-7,1.98,Z+side*1.97],brass);
  }
  // A single tall brass window remains on the left; the remaining walls open to sky.
  sideWindow(group,-8.05,1,3.5,1.48,brass);
  for(const x of [-10,-6.1])box(group,[.18,1.63,.13],[x,2.76,Z+1.98],timber);
  box(group,[4.1,.18,.13],[-8.05,3.63,Z+1.98],timber);
  ribs(group,brass,[-1.2,-5,-8.7,-12.8]);endDoor(group,timber,brass,-14.8,true);
  // The low wall becomes a bookshelf under the open horizon.
  for(const y of [1.13,1.53,1.99])box(group,[5.6,.055,.43],[-9.4,y,Z-1.73],trim);
  for(const x of [-6.6,-7.8,-9,-10.2,-11.4,-12.2])box(group,[.055,.85,.43],[x,1.56,Z-1.73],trim);
  for(let i=0;i<9;i++)box(group,[.055,.27+(i%3)*.035,.19],[-9.8+i*.075,1.72,Z-1.64],mat([0xb4aa98,0x71695e,0xd6c9ad,0x665846][i%4]));
  for(const x of [-7.1,-10.8])for(let i=0;i<3;i++)box(group,[.48,.055,.26],[x,1.2+i*.06,Z-1.68],mat(i===2?0x987966:0xb8b3a4));
  const photo=mat(0xc7c4b9);box(group,[.38,.39,.025],[-8.3,1.76,Z-1.68],trim,[.1,0,0]);box(group,[.31,.32,.027],[-8.3,1.76,Z-1.65],photo,[.1,0,0]);
  ellipsoid(group,[-8.3,1.76,Z-1.628],[.075,.11,.007],mat(0x7b817a));
  const glow=mat(0xfff3db,.26);glow.emissive.setHex(0xffdba0);glow.emissiveIntensity=.5;
  for(const x of [-4.8,-8.7,-12.8]){
    ring(group,.57,.055,[x,3.53,Z],glow);
    for(const side of [-1,1])tube(group,[[x,3.53,Z+side*.48],[x,4.12,Z+side*.48]],.009,brass);
    light(group,0xffe2bc,4,[x,3.45,Z]);
  }
  cloudSky(group);mountainScenery(group);
  // Broad low-contrast rib shadows on the carpet keep the open room grounded.
  const shadow=new THREE.MeshBasicMaterial({color:0x252d32,transparent:true,opacity:.15,depthWrite:false});
  for(const x of [-5,-8.7,-12.8])tube(group,[[x+1,F+.012,Z-1.9],[x+.6,F+.012,Z],[x+1,F+.012,Z+1.9]],.035,shadow);
  const cups=new THREE.Group(),porcelain=mat(0xf3e6cd,.2);teacup(cups,[0,0,.34],porcelain,brass);teacup(cups,[0,0,-.34],porcelain,brass);
  return {group,targets:[
    {id:'04-teacups',group:cups,position:[-8.6,F+.99,Z],aim:[-8.6,F+1.14,Z+.34]},
    {id:'04-chairs',group:chairs(fabric,timber),position:[-8.6,F,Z],aim:[-8.6,F+.9,Z+1.45]},
    {id:'04-table',group:table(timber),position:[-8.6,F,Z],aim:[-8.6,F+.94,Z]},
  ]};
}
