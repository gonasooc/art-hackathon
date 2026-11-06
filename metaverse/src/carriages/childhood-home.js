import * as THREE from '../../vendor/three/three.module.js';
import { box, boxes, tube } from '../train-geometry.js';
import {Z, F, mat, wood, random, canvasTexture, ellipsoid, ring, frame, sideWindow, endDoor, light, mountainScenery, cloudSky} from './memory-room-kit.js';

function mural(woodMaterial, brass) {
  const group = new THREE.Group();
  const ink = canvasTexture(1024, 640, (ctx, w, h) => {
    ctx.fillStyle = '#c8ae7c'; ctx.fillRect(0, 0, w, h); const rng = random(821);
    for (let i = 0; i < 16000; i++) {ctx.fillStyle = `rgba(75,57,33,${rng() * .08})`; ctx.fillRect(rng() * w, rng() * h, 1, 1);}
    for (let layer = 0; layer < 5; layer++) {
      ctx.fillStyle = ['#aa9b78','#9a8c69','#80765b','#635e49','#4b4a3b'][layer];
      ctx.beginPath(); ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 5) {const envelope = Math.sin(x / w * Math.PI); const y = 535 - envelope * (180 + Math.sin(x * .016 + layer) * 90 + Math.sin(x * .043 + layer * 2) * 29) + layer * 24; ctx.lineTo(x, y - (4 - layer) * 42);}
      ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(36,38,29,.22)'; ctx.lineWidth = 1;
      for (let i = 0; i < 160; i++) {const x = rng() * w, y = 300 + rng() * 300; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 8, y + 21); ctx.lineTo(x - 4, y + 40); ctx.stroke();}
    }
    ctx.fillStyle = '#cbb68a'; ctx.beginPath(); ctx.moveTo(600, 390); ctx.bezierCurveTo(450, 480, 850, 490, 510, 640); ctx.lineTo(830,640); ctx.bezierCurveTo(910,490,480,470,600,390); ctx.fill();
    for (let i = 0; i < 24; i++) {const x = 80 + rng() * 850, y = 400 + rng() * 200, s = 13 + rng() * 28; ctx.strokeStyle = '#373d30'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x-3,y-s); ctx.stroke(); for(let k=0;k<4;k++){ctx.beginPath();ctx.ellipse(x+Math.sin(k*4)*s*.25,y-s+k*s*.15,s*.34,s*.1,-.2,0,Math.PI*2);ctx.fillStyle='#414835';ctx.fill();}}
    ctx.fillStyle = '#5e291d'; ctx.fillRect(930, 47, 24, 28);
  });
  const paper = mat(0xffffff); paper.map = ink;
  box(group, [1.6, 1.18, .06], [0, 0, 0], woodMaterial);
  box(group, [1.47, 1.05, .012], [0, 0, .038], brass);
  box(group, [1.39, .97, .012], [0, 0, .05], paper);
  group.rotation.y = Math.PI / 2; return group;
}
function chandelier(brass) {
  const group = new THREE.Group(), glass = mat(0xffedd1, .22); glass.emissive.setHex(0xc4a477); glass.emissiveIntensity = .3;
  tube(group,[[0,.28,0],[0,0,0]],.028,brass); ring(group, .18, .035, [0, 0, 0], brass); ellipsoid(group, [0, -.12, 0], [.12,.1,.12], brass);
  for (let i=0;i<5;i++) {
    const a=i*Math.PI*2/5, x=Math.cos(a)*.48,z=Math.sin(a)*.48;
    tube(group, [[0,-.15,0],[x*.6,-.23,z*.6],[x,-.17,z],[x,-.28,z]],.022,brass);
    ellipsoid(group,[x,-.36,z],[.19,.16,.19],glass);
    ellipsoid(group,[x,-.52,z],[.045,.025,.045],brass);
  }
  return group;
}
function shelf(woodMaterial, brass) {
  const group = new THREE.Group();
  box(group,[1.4,1.47,.1],[0,.77,-.23],woodMaterial);
  for(const x of [-.7,.7])box(group,[.06,1.52,.5],[x,.77,0],woodMaterial);
  for(const y of [.04,.83,1.16,1.52])box(group,[1.46,.055,.54],[0,y,0],woodMaterial);
  for(const x of [-.345,.345]){
    box(group,[.67,.71,.05],[x,.44,.245],woodMaterial);box(group,[.67,.3,.05],[x,1.34,.245],woodMaterial);
    box(group,[.027,.13,.03],[x+Math.sign(-x)*.22,.48,.29],brass);
    ellipsoid(group,[x+Math.sign(-x)*.22,1.32,.29],[.022,.022,.026],brass);
  }
  for(let i=0;i<7;i++)box(group,[.075,.21+(i%3)*.025,.22],[-.15+i*.095,.98,.04],mat([0x344a4c,0xd7c4a0,0x954731,0x6d753d][i%4]));
  box(group,[.29,.06,.24],[-.46,.9,.04],mat(0xc5b392));
  group.rotation.y = Math.PI / 2; return group;
}
export function buildChildhoodHomeCarriage() {
  const group=new THREE.Group();group.name='childhood-home-02';
  const timber=wood(0x94714b), trim=wood(0x62462e), brass=mat(0x9b7740,.32,.65);
  box(group,[16,.16,3.95],[-7,F-.09,Z],trim);
  const floor=[],ceiling=[],walls=[];
  for(let row=0;row<16;row++) for(let i=0;i<8;i++)floor.push([[1.98,.04,.24],[-14.4+i*2+(row%2)*.3,F-.012,Z-1.85+row*.245]]);
  boxes(group,floor,timber);
  for(let i=0;i<56;i++)ceiling.push([[.277,.08,3.94],[-14.85+i*.285,4.05,Z]]);
  boxes(group,ceiling,timber);
  for(const side of [-1,1]){
    for(let i=0;i<54;i++){
      const x=-14.8+i*.295, isWindow=side===1&&x>-9&&x<-6;
      if(isWindow){walls.push([[.288,.94,.12],[x,1.53,Z+side*2]]);walls.push([[.288,.68,.12],[x,3.7,Z+side*2]]);}
      else walls.push([[.288,2.95,.12],[x,2.55,Z+side*2]]);
    }
    for(const y of [1.15,2.05,3.92])box(group,[16,.075,.09],[-7,y,Z+side*1.91],trim);
  }
  boxes(group,walls,timber);sideWindow(group,-7.5,1,2.95,1.32,brass);
  // The cupboard and painting occupy the warm alcove beside the stair landing.
  box(group,[.14,2.95,1.1],[-10.35,2.55,Z+1.4],timber);
  endDoor(group,trim,brass);
  for(let i=0;i<6;i++)box(group,[.36,.12,1.35],[-11.4-i*.43,F+.1+i*.16,Z-.88],timber);
  for(let i=0;i<6;i++){
    const x=-11.4-i*.43,y=F+.1+i*.16;
    box(group,[.065,.9,.065],[x,y+.45,Z-.14],trim);ellipsoid(group,[x,y+.9,Z-.14],[.085,.07,.085],timber);
  }
  tube(group,[[-11.2,F+1.04,Z-.14],[-12.4,F+1.49,Z-.14],[-13.7,F+1.97,Z-.14]],.05,trim);
  // Decorative double door and calligraphy belong to the architecture, not the targets.
  box(group,[2.25,2.5,.06],[-8.1,2.33,Z-1.9],trim);
  for(const x of [-8.64,-7.56]){
    const panel=new THREE.Group();panel.position.set(x,2.35,Z-1.84);group.add(panel);frame(panel,1.01,2.25,.1,brass,.022);
    box(group,[.15,.035,.045],[x,2.25,Z-1.77],brass);
  }
  const scroll=canvasTexture(640,160,ctx=>{ctx.fillStyle='#d4bc8e';ctx.fillRect(0,0,640,160);ctx.fillStyle='#342c20';ctx.font='76px serif';ctx.textAlign='center';ctx.fillText('寧 靜 致 遠',320,105);});
  const scrollMat=mat(0xffffff);scrollMat.map=scroll;box(group,[2.3,.47,.035],[-8.1,3.76,Z-1.89],scrollMat);
  for(const [x,z,s] of [[-10.05,Z+.03,.3],[-10.1,Z+.43,.4]])ellipsoid(group,[x,F+s*.6,z],[s*.4,s,s*.5],mat(0x6b6c59));
  cloudSky(group);mountainScenery(group,{warm:true});
  const outside=new THREE.Group();group.add(outside);
  const bricks=[];
  for(let row=0;row<7;row++)for(let i=0;i<38;i++)bricks.push([[.69,.13,.15],[-22+i*.72+(row%2)*.36,.9+row*.15,Z+3.35]]);
  boxes(outside,bricks,mat(0x985b43));box(outside,[30,.12,.28],[-8,1.94,Z+3.35],mat(0xa19c88));
  for(let i=0;i<8;i++)box(outside,[.17,1.15,.22],[-19+i*3.2,1.4,Z+3.35],mat(0xa19c88));
  const sunlight=new THREE.Mesh(new THREE.PlaneGeometry(3.6,1.8),new THREE.MeshBasicMaterial({color:0xffce7c,transparent:true,opacity:.14,depthWrite:false}));sunlight.rotation.set(-Math.PI/2,0,.32);sunlight.position.set(-8,F+.015,Z+.35);group.add(sunlight);
  light(group,0xffc483,8,[-8.7,3.6,Z]);light(group,0xffd39d,4,[-3,3.6,Z]);
  const targets=[
    {id:'02-mural',group:mural(trim,brass),position:[-10.24,3.2,Z+.98],aim:[-10.18,3.2,Z+.98]},
    {id:'02-ceiling-light',group:chandelier(brass),position:[-10.1,3.73,Z],aim:[-10.1,3.37,Z+.48]},
    {id:'02-shelf',group:shelf(timber,brass),position:[-10.12,F,Z+.97],aim:[-9.84,1.65,Z+.97]},
  ];
  return {group,targets,update(dt,reduced){if(group.visible&&!reduced){outside.position.x=(outside.position.x+Math.min(dt,.1)*.45)%3.2;}}};
}
