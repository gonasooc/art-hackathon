import * as THREE from '../../vendor/three/three.module.js';
import {box, boxes, tube} from '../train-geometry.js';
import {Z,F,mat,grain,random,ellipsoid,ring,sideWindow,ribs,endDoor,light,canopy,dappledFloor,cloudSky} from './memory-room-kit.js';

function balloon(parent, points, radius, material) {
  tube(parent, points, radius, material);
  for(const point of [points[0],points.at(-1)])ellipsoid(parent,point,[radius,radius,radius],material);
}
function slide(pink,yellow,mint) {
  const group=new THREE.Group(),blue=mat(0x79b0b9,.22);
  const leftZ=1.02,rightZ=-.86;
  // Two raised play towers connected across the carriage by inflated crawling rings.
  for(const [z,roof] of [[leftZ,mint],[rightZ,pink]]){
    ellipsoid(group,[-.28,1.4,z],[.58,.09,.49],yellow);
    for(const x of [-.65,.13])for(const dz of [-.36,.36]){
      balloon(group,[[x,.09,z+dz],[x,2.12,z+dz]],.055,blue);
      ellipsoid(group,[x,.08,z+dz],[.105,.075,.105],pink);
      ellipsoid(group,[x,2.12,z+dz],[.085,.1,.085],yellow);
    }
    for(const x of [-.6,.1])balloon(group,[[x,2.12,z-.38],[x,2.51,z-.25],[x,2.62,z],[x,2.51,z+.25],[x,2.12,z+.38]],.085,roof);
    for(const dz of [-.37,.37])balloon(group,[[-.62,1.75,z+dz],[-.28,1.75,z+dz],[.12,1.75,z+dz]],.035,yellow);
    ellipsoid(group,[-.25,2.64,z],[.08,.07,.08],pink);
  }
  for(let i=0;i<9;i++)ring(group,.43,.09,[-.28,1.72,.69-i*.175],[yellow,mint,blue,pink][i%4],[0,0,0]);
  // The bridge underside remains hollow, with a low arch under the tunnel.
  balloon(group,[[-.28,.08,.78],[-.28,.65,.6],[-.28,.92,0],[-.28,.65,-.6],[-.28,.08,-.78]],.065,yellow);
  const points=[[1.9,.14,leftZ],[1.4,.22,leftZ],[.9,.65,leftZ],[.4,1.27,leftZ],[0,1.42,leftZ]],curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  const positions=[],uv=[],indices=[];
  for(let i=0;i<=50;i++){
    const p=curve.getPoint(i/50);
    for(let j=0;j<=12;j++){const z=(j/12-.5)*.6;positions.push(p.x,p.y+.09*(Math.abs(z)/.3)**4,p.z+z);uv.push(i/50,j/12);if(i<50&&j<12){const a=i*13+j;indices.push(a,a+13,a+1,a+1,a+13,a+14);}}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const surface=yellow.clone();surface.side=THREE.DoubleSide;group.add(new THREE.Mesh(geometry,surface));
  for(const dz of [-.38,.38])balloon(group,points.map(p=>[p[0],p[1]+.12,p[2]+dz]),.1,pink);
  // The forward ladder sits beside the slide; the right stair is a stack of soft discs.
  for(const z of [.08,.53])balloon(group,[[1.65,.08,z],[.87,.8,z],[.12,1.55,z]],.055,blue);
  for(let i=0;i<5;i++)balloon(group,[[1.5-i*.29,.26+i*.24,.08],[1.5-i*.29,.26+i*.24,.53]],.055,yellow);
  for(let i=0;i<5;i++){
    const x=1.35-i*.3,y=.12+i*.28;
    const stepMaterial=[pink,mint,yellow,mint,pink][i];
    const step=new THREE.Mesh(new THREE.CylinderGeometry(.37,.37,y+.05,32),stepMaterial);step.position.set(x,(y+.05)/2,rightZ);group.add(step);
    ellipsoid(group,[x,y,rightZ],[.4,.13,.41],stepMaterial);
  }
  for(const dz of [-.4,.4]){
    balloon(group,[[1.65,.66,rightZ+dz],[.9,1.08,rightZ+dz],[.12,1.88,rightZ+dz]],.045,pink);
    balloon(group,[[1.65,.06,rightZ+dz],[1.65,.66,rightZ+dz]],.04,mint);
  }
  ellipsoid(group,[1.6,.13,-.05],[.29,.115,.3],yellow);ellipsoid(group,[1.6,.27,-.05],[.29,.09,.3],pink);
  return group;
}
function swing(pink,yellow,mint) {
  const group=new THREE.Group();
  for(const z of [-.63,.63]){
    balloon(group,[[.46,.08,z],[0,1.88,z],[-.46,.08,z]],.085,mint);
    for(const x of [-.46,.46])ellipsoid(group,[x,.09,z],[.12,.1,.12],pink);
    ellipsoid(group,[0,1.88,z],[.14,.14,.14],yellow);
  }
  balloon(group,[[0,1.88,-.77],[0,1.88,.77]],.085,mint);
  const seat=new THREE.Group();group.add(seat);
  for(const z of [-.31,.31])balloon(seat,[[0,1.82,z],[.03,.5,z]],.018,pink);
  ellipsoid(seat,[.03,.44,0],[.23,.065,.41],yellow);
  return group;
}
export function buildPlaygroundCarriage(){
  const group=new THREE.Group();group.name='playground-03';
  const bronze=grain(0x736849,43),dark=mat(0x4e4a31,.8,.2),pink=mat(0xf28d76,.23),yellow=mat(0xf2bd4d,.23),mint=mat(0x91c1a3,.25);
  box(group,[16,.15,3.95],[-7,F-.09,Z],grain(0x967d58));
  for(const side of [-1,1]){
    box(group,[16,.65,.14],[-7,1.37,Z+side*1.98],dark);box(group,[16,.18,.14],[-7,3.24,Z+side*1.98],bronze);
    for(let x=-.3;x>-15;x-=2.25){box(group,[.3,1.5,.14],[x-1.1,2.45,Z+side*1.98],bronze);sideWindow(group,x,side,1.87,1.4,bronze);}
    box(group,[16,.06,.09],[-7,F+.05,Z+side*1.87],bronze);
  }
  ribs(group,bronze,[-.3,-2.5,-4.7,-6.9,-9.1,-11.3,-13.5]);endDoor(group,dark,bronze);
  cloudSky(group);canopy(group);dappledFloor(group,'#ffe9b1',.3);
  box(group,[45,.1,35],[-7,.78,Z],grain(0x72724a));
  const leaves=[],rng=random(713);
  for(let i=0;i<170;i++)leaves.push([[.025+rng()*.06,.008,.02+rng()*.04],[-14.8+rng()*15.5,F+.004,Z-1.9+rng()*3.8]]);
  boxes(group,leaves,mat(0x9b793d));
  light(group,0xffe3ab,5,[-7,4.05,Z]);light(group,0xffe3ab,4,[-12,3.9,Z]);
  return {group,targets:[
    {id:'03-slide',group:slide(pink,yellow,mint),position:[-10,F,Z],aim:[-9.1,F+.72,Z+1.02]},
    {id:'03-swing',group:swing(pink,yellow,mint),position:[-10.2,F,Z-1.24],aim:[-10.2,F+1.88,Z-1.24]},
  ]};
}
