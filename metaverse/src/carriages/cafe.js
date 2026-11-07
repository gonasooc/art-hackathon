import * as THREE from '../../vendor/three/three.module.js';
import {box,tube} from '../train-geometry.js';
import {Z,F,mat,wood,grain,ellipsoid,ring,sideWindow,frame,light,canvasTexture,random} from './memory-room-kit.js';

// Bevelled upholstery and timber avoid the stacked-sphere silhouette of the study.
function softBox(parent,size,position,material,radius=.06){
  const [w,h,d]=size,r=Math.min(radius,w/3,h/3,d/3),shape=new THREE.Shape();
  const a=w/2-r,b=h/2-r,c=Math.min(r,a,b);
  shape.moveTo(-a+c,-b);shape.lineTo(a-c,-b);shape.quadraticCurveTo(a,-b,a,-b+c);shape.lineTo(a,b-c);shape.quadraticCurveTo(a,b,a-c,b);shape.lineTo(-a+c,b);shape.quadraticCurveTo(-a,b,-a,b-c);shape.lineTo(-a,-b+c);shape.quadraticCurveTo(-a,-b,-a+c,-b);shape.closePath();
  const geo=new THREE.ExtrudeGeometry(shape,{depth:d-2*r,steps:1,bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:5,curveSegments:12});
  geo.translate(0,0,-d/2+r);geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,material);mesh.position.set(...position);parent.add(mesh);return mesh;
}
function teacup(parent,position,porcelain,side){
  const group=new THREE.Group();group.position.set(...position);group.scale.setScalar(.72);parent.add(group);
  const points=[[.001,.035],[.065,.035],[.09,.06],[.117,.11],[.132,.19],[.137,.23],[.128,.234],[.122,.19],[.108,.12],[.075,.065],[.001,.065]].map(p=>new THREE.Vector2(...p));
  group.add(new THREE.Mesh(new THREE.LatheGeometry(points,48),porcelain));
  ellipsoid(group,[0,.02,0],[.205,.018,.205],porcelain);
  ring(group,.137,.004,[0,.231,0],porcelain);
  const coffee=new THREE.Mesh(new THREE.CircleGeometry(.123,48),mat(0x29201a,.24));coffee.rotation.x=-Math.PI/2;coffee.position.y=.213;group.add(coffee);
  const handle=ring(group,.068,.014,[0,.145,side*.155],porcelain,[0,Math.PI/2,0]);handle.scale.y=1.08;
}
function chairs(fabric,timber){
  const group=new THREE.Group(),positions=[],uvs=[],indices=[],segments=64,sides=24;
  // One swept shell connects both arms to the back; its height rises at the rear.
  for(let i=0;i<=segments;i++){
    const theta=-.65+(Math.PI+1.3)*i/segments;
    for(let j=0;j<=sides;j++){
      const phi=j/sides*Math.PI*2;
      positions.push((.45+.10*Math.cos(phi))*Math.cos(theta),.85+.14*Math.sin(theta)+.33*Math.sin(phi),.03-(.40+.10*Math.cos(phi))*Math.sin(theta));
      uvs.push(i/segments,j/sides);
      if(i<segments&&j<sides){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,b,a+1,b,b+1,a+1);}
    }
  }
  const shell=new THREE.BufferGeometry();shell.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));shell.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));shell.setIndex(indices);shell.computeVertexNormals();
  for(const side of [-1,1]){
    const chair=new THREE.Group();chair.position.z=side*1.22;chair.rotation.y=side===1?Math.PI:0;group.add(chair);
    softBox(chair,[1.04,.35,.96],[0,.39,.02],fabric,.09);
    softBox(chair,[.84,.18,.78],[0,.64,.06],fabric,.07);
    chair.add(new THREE.Mesh(shell,fabric));
    for(const theta of [-.65,Math.PI+.65])ellipsoid(chair,[.45*Math.cos(theta),.85+.14*Math.sin(theta),.03-.40*Math.sin(theta)],[.10,.33,.10],fabric);
    const back=softBox(chair,[.70,.48,.18],[0,.91,-.29],fabric,.065);back.rotation.x=-.12;
    for(const x of [-.35,.35])for(const z of [-.29,.32])box(chair,[.07,.16,.07],[x,.14,z],timber,[0,0,x*.12]);
  }
  return group;
}
function table(timber){
  const group=new THREE.Group();softBox(group,[1.08,.065,1.65],[0,.95,0],timber,.015);box(group,[.24,.86,.30],[0,.46,0],timber);softBox(group,[.54,.06,.62],[0,.04,0],timber,.012);return group;
}
function cafeEnd(parent,timber,brass){
  // Low end wall continues the side panelling; only the door rises above it.
  const end=new THREE.Group();end.position.set(-14.8,F,Z);end.rotation.y=Math.PI/2;parent.add(end);
  box(end,[3.95,1.05,.14],[0,.525,0],timber);
  box(end,[3.95,.045,.17],[0,1.065,0],timber);
  const shape=new THREE.Shape();shape.moveTo(-.64,0);shape.lineTo(.64,0);shape.lineTo(.64,2.32);shape.quadraticCurveTo(.64,2.65,0,2.65);shape.quadraticCurveTo(-.64,2.65,-.64,2.32);shape.closePath();
  const window=new THREE.Path();window.moveTo(-.20,1.61);window.lineTo(-.20,2.23);window.quadraticCurveTo(-.20,2.35,0,2.35);window.quadraticCurveTo(.20,2.35,.20,2.23);window.lineTo(.20,1.61);window.quadraticCurveTo(.20,1.49,0,1.49);window.quadraticCurveTo(-.20,1.49,-.20,1.61);shape.holes.push(window);
  const door=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:true,bevelThickness:.015,bevelSize:.015,bevelSegments:3,curveSegments:24}),timber);end.add(door);
  const trim=new THREE.Group();trim.position.set(0,1.92,.14);end.add(trim);frame(trim,.48,.94,.13,brass,.03);
  box(end,[.055,.25,.04],[.46,1.18,.15],brass);box(end,[.19,.035,.065],[.39,1.22,.17],brass);
  box(end,[3.95,.075,.16],[0,.04,.02],mat(0x242524));
}
function wallWood(){
  const texture=canvasTexture(512,512,(ctx,w,h)=>{
    const rng=random(419);ctx.fillStyle='#a49b90';ctx.fillRect(0,0,w,h);
    for(let i=0;i<2100;i++){const x=rng()*w,v=70+Math.floor(rng()*110);ctx.strokeStyle=`rgba(${v},${v},${v},.16)`;ctx.lineWidth=.3+rng();ctx.beginPath();ctx.moveTo(x,0);ctx.bezierCurveTo(x+3,180,x-2,350,x+1,h);ctx.stroke();}
    for(let x=0;x<w;x+=64){ctx.fillStyle='#4e4941';ctx.fillRect(x,0,2,h);ctx.fillStyle='#b5aba0';ctx.fillRect(x+3,0,1,h);}
  });texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  const material=mat(0x746a5d,.65);material.map=texture;material.bumpMap=texture;material.bumpScale=.006;return material;
}
// A continuous distant landscape also fills the view through the end-door opening.
function cafeLandscape(parent){
  const rng=random(631),grid=Array.from({length:65*33},()=>rng());
  const noise=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);const at=(a,b)=>grid[(b%33)*65+(a%65)];return (at(ix,iy)*(1-sx)+at(ix+1,iy)*sx)*(1-sy)+(at(ix,iy+1)*(1-sx)+at(ix+1,iy+1)*sx)*sy;};
  const texture=canvasTexture(1024,512,(ctx,w,h)=>{
    const data=ctx.createImageData(w,h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const n=noise(x/w*12,y/h*12)*.55+noise(x/w*32,y/h*24)*.3+noise(x/w*64,y/h*32)*.15;
      const cloud=Math.max(0,Math.min(1,(n-.30)*1.7)),haze=y/h;
      const i=(y*w+x)*4;data.data.set([105+cloud*105+haze*9,122+cloud*91+haze*7,143+cloud*68,255],i);
    }ctx.putImageData(data,0,0);
  });
  const sky=new THREE.Mesh(new THREE.SphereGeometry(95,48,24),new THREE.MeshBasicMaterial({map:texture,side:THREE.BackSide,fog:false}));sky.position.set(-7,0,Z);parent.add(sky);
  const segments=192,steps=32,positions=[],colors=[],indices=[];
  const height=(angle,r)=>-2.7+Math.pow(r/70, .7)*(3.2+Math.sin(angle*5+r*.13)*1.1+Math.cos(angle*9-r*.17)*.7+Math.sin(angle*19+r*.32)*.3);
  for(let j=0;j<=steps;j++)for(let i=0;i<=segments;i++){
    const angle=i/segments*Math.PI*2,r=12+j*1.9,y=height(angle,r);positions.push(-7+Math.cos(angle)*r,y,Z+Math.sin(angle)*r);
    const c=new THREE.Color(0x435d59).lerp(new THREE.Color(0xaebfc8),Math.min(.93,j/steps));const mist=.12+.13*Math.sin(r*.4+angle*3);c.lerp(new THREE.Color(0xc9d1d2),mist);colors.push(c.r,c.g,c.b);
    if(j<steps&&i<segments){const a=j*(segments+1)+i,b=a+segments+1;indices.push(a,a+1,b,b,a+1,b+1);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const material=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,fog:false});parent.add(new THREE.Mesh(geometry,material));
  const trees=new THREE.InstancedMesh(new THREE.ConeGeometry(1,1,5),new THREE.MeshBasicMaterial({color:0x4a615c,fog:true}),3200),matrix=new THREE.Matrix4(),q=new THREE.Quaternion();
  for(let i=0;i<3200;i++){const angle=rng()*Math.PI*2,r=12+rng()*24,h=.08+rng()*.18;matrix.compose(new THREE.Vector3(-7+Math.cos(angle)*r,height(angle,r)+h*.4,Z+Math.sin(angle)*r),q,new THREE.Vector3(h*.35,h,h*.35));trees.setMatrixAt(i,matrix);}parent.add(trees);
}
export function buildCafeCarriage(){
  const group=new THREE.Group();group.name='cafe-04';
  const timber=wallWood(),furniture=wallWood(),trim=wood(0x65584b),brass=mat(0x9d8b61,.5,.5),fabric=grain(0x62696c,17);
  fabric.map.repeat.set(16,16);fabric.bumpScale=.003;
  const carpet=grain(0x777a7b);carpet.map.repeat.set(64,16);carpet.bumpScale=.002;
  box(group,[16,.15,3.95],[-7,F-.09,Z],carpet);
  for(const side of [-1,1]){
    for(let i=0;i<16;i++)box(group,[1,1.05,.13],[-14.5+i,F+.525,Z+side*1.98],timber);
    box(group,[16,.045,.15],[-7,F+1.07,Z+side*1.97],timber);
    box(group,[16,.075,.15],[-7,F+.04,Z+side*1.97],mat(0x242524));
  }
  // A single tall brass window remains on the left; the remaining walls open to sky.
  sideWindow(group,-8.05,1,3.5,1.48,brass);
  for(const x of [-10,-6.1])box(group,[.18,1.63,.13],[x,2.76,Z+1.98],timber);
  box(group,[4.1,.18,.13],[-8.05,3.63,Z+1.98],timber);
  for(const x of [-5,-8.7,-12.8])tube(group,Array.from({length:33},(_,i)=>{const a=i/32*Math.PI;return [x,3.15+Math.sin(a)*1.04,Z+Math.cos(a)*1.96];}),.016,brass);
  cafeEnd(group,timber,brass);
  // The low wall becomes a bookshelf under the open horizon.
  for(const y of [1.13,1.63,2.14])box(group,[5.6,.055,.43],[-9.4,y,Z-1.73],trim);
  for(const x of [-6.6,-7.8,-9,-10.2,-11.4,-12.2])box(group,[.055,1.01,.43],[x,1.63,Z-1.73],trim);
  for(let i=0;i<9;i++)box(group,[.055,.27+(i%3)*.035,.19],[-9.8+i*.075,1.72,Z-1.64],mat([0xb4aa98,0x71695e,0xd6c9ad,0x665846][i%4]));
  for(const x of [-7.1,-10.8])for(let i=0;i<3;i++)box(group,[.48,.055,.26],[x,1.2+i*.06,Z-1.68],mat(i===2?0x987966:0xb8b3a4));
  const photo=mat(0xc7c4b9);box(group,[.38,.39,.025],[-8.3,1.76,Z-1.68],trim,[.1,0,0]);box(group,[.31,.32,.027],[-8.3,1.76,Z-1.65],photo,[.1,0,0]);
  ellipsoid(group,[-8.3,1.76,Z-1.628],[.075,.11,.007],mat(0x7b817a));
  const glow=mat(0xfff3db,.26);glow.emissive.setHex(0xffdba0);glow.emissiveIntensity=.5;
  for(const x of [-8.7,-12.8]){
    ring(group,.57,.055,[x,3.53,Z],glow);
    for(const side of [-1,1])tube(group,[[x,3.53,Z+side*.48],[x,4.12,Z+side*.48]],.009,brass);
    light(group,0xffe2bc,4,[x,3.45,Z]);
  }
  cafeLandscape(group);
  // Broad low-contrast rib shadows on the carpet keep the open room grounded.
  const shadow=new THREE.MeshBasicMaterial({color:0x252d32,transparent:true,opacity:.15,depthWrite:false});
  for(const x of [-5,-8.7,-12.8])tube(group,[[x+1,F+.012,Z-1.9],[x+.6,F+.012,Z],[x+1,F+.012,Z+1.9]],.035,shadow);
  const cups=new THREE.Group(),porcelain=mat(0xf0f0ed,.24);teacup(cups,[0,0,.48],porcelain,1);teacup(cups,[0,0,-.48],porcelain,-1);
  const targets=[
    {id:'04-teacups',group:cups,position:[-8.6,F+.99,Z],aim:[-8.6,F+1.10,Z+.48]},
    {id:'04-chairs',group:chairs(fabric,trim),position:[-8.6,F,Z],aim:[-8.6,F+.9,Z+1.45]},
    {id:'04-table',group:table(furniture),position:[-8.6,F,Z],aim:[-8.6,F+.94,Z]},
  ];
  for(const root of [group,...targets.map(t=>t.group)])root.traverse(mesh=>{if(mesh.isMesh&&mesh.material.isMeshStandardMaterial)mesh.material.envMapIntensity=.12;});
  return {group,targets};
}
