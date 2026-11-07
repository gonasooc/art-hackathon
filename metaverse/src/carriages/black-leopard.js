import {leopardSurface} from './leopard-surface.js';
import * as THREE from '../../vendor/three/three.module.js';
import {canvasTexture,random} from './memory-room-kit.js';

// Shared standing black leopard. All surfaces support the memory dissolve shader.
export function buildBlackLeopard({raisedHead=false,scale=.8}={}){
 const group=new THREE.Group();group.name='black-leopard';
 const texture=canvasTexture(1024,1024,(ctx,w,h)=>{
  const rng=random(127),data=ctx.createImageData(w,h);
  for(let i=0;i<data.data.length;i+=4){const v=38+rng()*11;data.data.set([v,v+1,v+2,255],i);}ctx.putImageData(data,0,0);
  for(let i=0;i<520;i++){
   const x=rng()*w,y=rng()*h,rx=9+rng()*15,ry=8+rng()*12;
   ctx.strokeStyle='rgba(9,11,13,.28)';ctx.lineWidth=2+rng()*2;ctx.beginPath();ctx.ellipse(x,y,rx,ry,rng()*6,.3,5.5);ctx.stroke();
  }
  for(let i=0;i<65000;i++){const x=rng()*w,y=rng()*h;ctx.strokeStyle=rng()>.5?'rgba(115,119,122,.12)':'rgba(4,6,8,.18)';ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+1+rng()*2,y+3+rng()*5);ctx.stroke();}
 });
 const coat=new THREE.MeshStandardMaterial({color:0xb5b7ba,map:texture,bumpMap:texture,bumpScale:.004,roughness:.78});
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
 const anatomy=[
  [0,.88,0,.73,.275,.245],[-.43,.96,0,.31,.30,.255],[.47,.91,0,.30,.28,.24],
  [-.60,1.05,0,.23,.29,.22],[-.70,1.22,0,.20,.25,.185],
 ];
 for(const side of [-1,1]){
  const z=side*.19;
  anatomy.push([-.47,.83,z,.135,.30,.13],[-.47,.51,z,.085,.22,.08],[-.49,.25,z,.065,.18,.07],[-.55,.085,z,.14,.075,.10]);
  anatomy.push([.46,.80,z,.18,.27,.15],[.39,.60,z,.12,.18,.105],[.54,.40,z,.075,.18,.07],[.53,.19,z,.06,.12,.065],[.47,.075,z,.13,.07,.095]);
  for(const x of [-.55,.47])for(const dz of [-.06,-.02,.02,.06])anatomy.push([x-.065,.065,z+dz,.07,.05,.03]);
 }
 group.add(leopardSurface(anatomy,coat,{min:[-.98,-.02,-.42],max:[.9,1.55,.42],step:.032,blend:.065}));
 const head=new THREE.Group();head.position.set(-.74,1.31,0);head.rotation.z=raisedHead?-.23:0;group.add(head);
 head.add(leopardSurface([
  [-.06,.055,0,.22,.18,.18],[-.18,.012,0,.17,.14,.17],[-.23,.07,0,.13,.105,.12],
  [-.285,-.035,-.063,.10,.067,.078],[-.285,-.035,.063,.10,.067,.078],[-.22,-.083,0,.13,.055,.12]
 ],coat,{min:[-.43,-.17,-.25],max:[.21,.26,.25],step:.016,blend:.035}));
 for(const side of [-1,1]){

  const ear=oval(head,[.015,.205,side*.145],[.063,.074,.043]);ear.rotation.x=side*.20;
  oval(head,[-.025,.212,side*.155],[.020,.047,.030],dark);
  for(let i=0;i<4;i++)oval(head,[-.334+i*.016,-.015-(i%2)*.02,side*.119],[.004,.004,.004],nose);
  oval(head,[-.205,.102,side*.151],[.063,.035,.034],dark);
  oval(head,[-.224,.105,side*.169],[.036,.023,.018],eye);
  oval(head,[-.239,.105,side*.18],[.013,.020,.008],pupil);
  oval(head,[-.243,.114,side*.185],[.006,.006,.004],new THREE.MeshStandardMaterial({color:0xe2ddd0,roughness:.2}));
  const brow=oval(head,[-.18,.139,side*.143],[.073,.022,.035]);brow.rotation.z=-.16;
  for(let i=0;i<5;i++){
   const y=-.02-i*.015;
   loft(head,[[-.29,y,side*.105],[-.35,y-.01,side*.22],[-.32,y+.015-i*.012,side*(.32+i*.008)]],[[.0018,.0018],[.0013,.0013],[.0001,.0001]],new THREE.MeshStandardMaterial({color:0x696b6b,roughness:.9}),10);
  }
 }
 oval(head,[-.36,.008,0],[.038,.028,.058],nose);
 for(const side of [-1,1])oval(head,[-.389,.012,side*.035],[.004,.010,.013],pupil);
 loft(head,[[-.385,-.01,0],[-.371,-.045,0],[-.31,-.075,0]],[[.003,.003],[.002,.002],[.001,.001]],dark,12);
 oval(head,[-.24,-.092,0],[.12,.035,.103],dark);
 loft(group,[[.65,.99,0],[.82,.86,0],[.93,.55,.02],[1.03,.24,.04],[1.24,.18,.07],[1.32,.33,.08],[1.25,.39,.08]],[[.065,.065],[.055,.055],[.048,.048],[.044,.044],[.045,.045],[.039,.039],[.025,.025]],coat,64);
 oval(group,[1.25,.39,.08],[.029,.029,.029]);
 for(const side of [-1,1])for(const x of [-.55,.47])for(const dz of [-.055,-.018,.018,.055])oval(group,[x-.125,.046,side*.19+dz],[.020,.012,.008],new THREE.MeshStandardMaterial({color:0x65615a,roughness:.65}));
 group.rotation.y=-Math.PI/2;group.scale.setScalar(scale);
 group.traverse(mesh=>{if(mesh.isMesh){mesh.castShadow=true;mesh.receiveShadow=true;}});
 return group;
}
