import * as THREE from '../../vendor/three/three.module.js';
import {canvasTexture,random} from './memory-room-kit.js';

// Shared standing black leopard. All surfaces support the memory dissolve shader.
export function buildBlackLeopard({raisedHead=false,scale=.8}={}){
 const group=new THREE.Group();group.name='black-leopard';
 const texture=canvasTexture(512,512,(ctx,w,h)=>{
  const rng=random(127),data=ctx.createImageData(w,h);
  for(let i=0;i<data.data.length;i+=4){const v=38+rng()*11;data.data.set([v,v+1,v+2,255],i);}ctx.putImageData(data,0,0);
  for(let i=0;i<190;i++){
   const x=rng()*w,y=rng()*h,rx=5+rng()*10,ry=5+rng()*8;
   ctx.strokeStyle='rgba(9,11,13,.28)';ctx.lineWidth=2+rng()*2;ctx.beginPath();ctx.ellipse(x,y,rx,ry,rng()*6,.3,5.5);ctx.stroke();
  }
  for(let i=0;i<14000;i++){const x=rng()*w,y=rng()*h;ctx.strokeStyle=rng()>.5?'rgba(115,119,122,.12)':'rgba(4,6,8,.18)';ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+1+rng()*2,y+3+rng()*5);ctx.stroke();}
 });
 const coat=new THREE.MeshStandardMaterial({color:0xb5b7ba,map:texture,bumpMap:texture,bumpScale:.002,roughness:.78});
 const dark=new THREE.MeshStandardMaterial({color:0x101216,roughness:.62}),nose=new THREE.MeshStandardMaterial({color:0x090b0e,roughness:.4});
 const eye=new THREE.MeshStandardMaterial({color:0xb69a56,roughness:.28});
 const pupil=new THREE.MeshStandardMaterial({color:0x08090a,roughness:.3});
 function oval(parent,pos,size,material=coat){const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,32,24),material);mesh.position.set(...pos);mesh.scale.set(...size);parent.add(mesh);return mesh;}
 // Smooth variable-radius lofts define muscles and tapering joints rather than round beads.
 function loft(parent,points,radii,material=coat,segments=44){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),frames=curve.computeFrenetFrames(segments,false),radiusCurve=new THREE.CatmullRomCurve3(radii.map(([x,y])=>new THREE.Vector3(x,y,0))),positions=[],uv=[],indices=[],sides=20;
  for(let i=0;i<=segments;i++){
   const t=i/segments;
   const radius=radiusCurve.getPoint(t),rx=Math.max(.0001,radius.x),ry=Math.max(.0001,radius.y),center=curve.getPointAt(t);
   for(let j=0;j<=sides;j++){const angle=j/sides*Math.PI*2,p=center.clone().addScaledVector(frames.normals[i],Math.cos(angle)*rx).addScaledVector(frames.binormals[i],Math.sin(angle)*ry);positions.push(...p.toArray());uv.push(t,j/sides);if(i<segments&&j<sides){const n=i*(sides+1)+j,b=n+sides+1;indices.push(n,n+1,b,b,n+1,b+1);}}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,material);parent.add(mesh);return mesh;
 }
 loft(group,[[-.68,.94,0],[-.4,.99,0],[.05,.94,0],[.48,.96,0],[.72,.91,0]],[[.09,.10],[.31,.32],[.28,.30],[.29,.30],[.07,.08]]);
 oval(group,[-.43,.96,0],[.30,.29,.245]);oval(group,[.49,.94,0],[.26,.27,.235]);
 for(const side of [-1,1]){
  const z=side*.215;
  loft(group,[[-.46,1.04,z],[-.48,.76,z],[-.43,.49,z],[-.46,.22,z],[-.49,.105,z]],[[.15,.16],[.12,.14],[.075,.085],[.055,.065],[.085,.07]]);
  loft(group,[[.49,1.02,z],[.39,.74,z],[.59,.45,z],[.57,.23,z],[.49,.105,z]],[[.18,.18],[.15,.16],[.075,.08],[.055,.06],[.085,.07]]);
  for(const x of [-.51,.47]){
   oval(group,[x-.025,.085,z],[.14,.077,.10]);
   for(const dz of [-.062,-.021,.021,.062])oval(group,[x-.12,.065,z+dz],[.049,.046,.027]);
  }
 }
 loft(group,[[-.49,.95,0],[-.65,1.14,0],[-.74,1.35,0]],[[.25,.26],[.24,.23],[.16,.18]]);
 const head=new THREE.Group();head.position.set(-.74,1.31,0);head.rotation.z=raisedHead?-.23:0;group.add(head);
 oval(head,[-.08,.06,0],[.235,.18,.18]);
 oval(head,[-.22,-.025,0],[.17,.115,.16]);
 for(const side of [-1,1]){
  oval(head,[-.28,-.025,side*.068],[.105,.074,.085]);
  oval(head,[.015,.215,side*.14],[.073,.078,.045]);
  oval(head,[-.025,.22,side*.153],[.018,.046,.029],dark);
  oval(head,[-.225,.125,side*.143],[.068,.048,.044],dark);
  oval(head,[-.245,.125,side*.157],[.039,.029,.025],eye);
  oval(head,[-.263,.125,side*.167],[.016,.023,.012],pupil);
  oval(head,[-.265,.137,side*.174],[.006,.006,.004],new THREE.MeshStandardMaterial({color:0xe2ddd0,roughness:.2}));
  const brow=oval(head,[-.195,.16,side*.142],[.065,.019,.038]);brow.rotation.z=-.16;
  for(let i=0;i<5;i++){
   const y=-.02-i*.015;
   loft(head,[[-.29,y,side*.105],[-.35,y-.01,side*.22],[-.32,y+.015-i*.012,side*(.32+i*.008)]],[[.0018,.0018],[.0013,.0013],[.0001,.0001]],new THREE.MeshStandardMaterial({color:0x696b6b,roughness:.9}),10);
  }
 }
 oval(head,[-.36,.018,0],[.045,.036,.062],nose);
 oval(head,[-.24,-.092,0],[.12,.035,.103],dark);
 loft(group,[[.65,.99,0],[.82,.86,0],[.93,.55,.02],[1.03,.24,.04],[1.24,.18,.07],[1.32,.33,.08],[1.25,.39,.08]],[[.065,.065],[.055,.055],[.048,.048],[.044,.044],[.045,.045],[.039,.039],[.005,.005]],coat,64);
 group.rotation.y=-Math.PI/2;group.scale.setScalar(scale);
 group.traverse(mesh=>{if(mesh.isMesh){mesh.castShadow=true;mesh.receiveShadow=true;}});
 return group;
}
