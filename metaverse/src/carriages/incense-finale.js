import * as THREE from '../../vendor/three/three.module.js';
import {TRAIN,clamp} from '../config.js';

export const FINALE_TEXT='No click,\none blink.';
const circle=(x,y,rx,ry,from=0,to=Math.PI*2)=>Array.from({length:25},(_,i)=>{const a=from+(to-from)*i/24;return[x+Math.cos(a)*rx,y+Math.sin(a)*ry];});
// Single-stroke letterforms rather than a solid font: each stroke is made of smoke.
const glyphs={
 N:{w:.91,s:[[[.03,0],[.18,1.03],[.25,1.06],[.67,.04],[.77,.04],[.9,1.04]]]},
 o:{w:.68,s:[circle(.31,.34,.26,.32)]},
 c:{w:.6,s:[circle(.32,.34,.27,.32,.7,Math.PI*2-.6)]},
 l:{w:.46,s:[[[.1,.02],[.27,.61],[.36,1.02],[.29,1.12],[.12,.9],[.09,.4],[.12,.05],[.37,0]]]},
 i:{w:.32,s:[[[.15,.65],[.1,.33],[.08,.04],[.25,.01]],circle(.2,.9,.027,.03)]},
 k:{w:.65,s:[[[.12,0],[.19,.52],[.31,1.08],[.22,1.1],[.13,.82],[.1,.18]],[[.59,.7],[.38,.48],[.15,.3],[.35,.37],[.48,.04],[.63,.01]]]},
 e:{w:.63,s:[[[.08,.31],[.35,.38],[.52,.54],[.42,.67],[.19,.62],[.06,.34],[.14,.05],[.38,.02],[.56,.15]]]},
 n:{w:.69,s:[[[.04,0],[.15,.65],[.12,.24],[.29,.59],[.46,.65],[.57,.48],[.52,.04],[.65,.01]]]},
 b:{w:.68,s:[[[.08,.03],[.24,.68],[.36,1.05],[.25,1.1],[.09,.68],[.05,.18],[.21,0],[.47,.09],[.6,.37],[.53,.61],[.34,.66],[.15,.47]]]},
 ',':{w:.25,s:[[[.14,.04],[.13,-.08],[.03,-.2]]]},
 '.':{w:.2,s:[circle(.08,.02,.025,.026)]},
 ' ':{w:.34,s:[]},
};

function cloudTexture(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
 const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,0,32,32,32);
 gradient.addColorStop(0,'rgba(255,255,255,.8)');gradient.addColorStop(.3,'rgba(255,255,255,.4)');gradient.addColorStop(1,'rgba(255,255,255,0)');
 ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);return new THREE.CanvasTexture(canvas);
}
const random=(i,s=0)=>{const n=Math.sin(i*127.1+s*311.7)*43758.5453;return n-Math.floor(n);};
function ribbonTexture(){
 const canvas=document.createElement('canvas');canvas.width=32;canvas.height=128;const ctx=canvas.getContext('2d'),data=ctx.createImageData(32,128);
 for(let y=0;y<128;y++)for(let x=0;x<32;x++){const i=(y*32+x)*4;data.data.set([255,255,255,255*Math.exp(-(((x-15.5)/7)**2))*Math.pow(Math.sin(Math.PI*(y+.5)/128),.35)],i);}
 ctx.putImageData(data,0,0);return new THREE.CanvasTexture(canvas);
}

class SmokeFinale {
 constructor(){
  this.group=new THREE.Group();this.group.name='incense-final-smoke-lettering';
  this.group.position.set(-8.98,TRAIN.floorY+.75,TRAIN.centerZ);this.group.rotation.y=Math.PI/2;
  this.destinations=[];this.seeds=[];const strokes=[];
  for(const [row,line] of FINALE_TEXT.split('\n').entries()){
   const scale=.57,width=[...line].reduce((sum,char)=>sum+glyphs[char].w+.07,0)*scale;
   let pen=-width/2;
   for(const char of line){const glyph=glyphs[char];
    for(const stroke of glyph.s){
     const curve=new THREE.CatmullRomCurve3(stroke.map(([x,y])=>new THREE.Vector3(pen+(x+y*.1)*scale,(row===0?2.42:1.55)+y*scale,0)));
     const points=curve.getSpacedPoints(Math.max(12,Math.ceil(curve.getLength()/.014)));
     strokes.push(points);
     for(const point of points)for(let strand=0;strand<3;strand++){
      const i=this.destinations.length;
      this.destinations.push([point.x+(random(i)-.5)*.025,point.y+(random(i,1)-.5)*.025,(random(i,2)-.5)*.035]);
      this.seeds.push(random(i,3));
     }
    }
    pen+=(glyph.w+.07)*scale;
   }
  }
  const texture=cloudTexture(),geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(this.destinations.length*3),3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(this.destinations.length*3),3));
  this.letters=new THREE.Points(geometry,new THREE.PointsMaterial({map:texture,color:0xd2c7b0,size:.052,vertexColors:true,transparent:true,opacity:0,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending}));
  this.letters.frustumCulled=false;this.group.add(this.letters);
  this.haze=new THREE.Points(geometry,new THREE.PointsMaterial({map:texture,color:0xa69c8c,size:.12,vertexColors:true,transparent:true,opacity:0,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending}));
  this.haze.frustumCulled=false;this.group.add(this.haze);
  // Connected translucent ribbons keep the writing wispy rather than dotted.
  this.filaments=[];const uv=[],indices=[];
  strokes.forEach((points,index)=>{
   for(let strand=0;strand<3;strand++){
    const base=this.filaments.length,seed=random(index,7);
    points.forEach((point,i)=>{
     const tangent=points[Math.min(i+1,points.length-1)].clone().sub(points[Math.max(0,i-1)]).normalize();
     for(const side of [-1,1]){
      const width=side*(.021+.008*Math.sin(i*.15+index))+(strand-1)*.018;
      this.filaments.push([point.x-tangent.y*width,point.y+tangent.x*width,(strand-1)*.015,seed]);uv.push(side<0?0:1,i/(points.length-1));
     }
     if(i<points.length-1){const a=base+i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
    });
   }
  });
  const ribbonMap=ribbonTexture(),ribbons=new THREE.BufferGeometry();ribbons.setIndex(indices);
  ribbons.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(this.filaments.length*3),3));
  ribbons.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(this.filaments.length*3),3));
  ribbons.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  this.ink=new THREE.Mesh(ribbons,new THREE.MeshBasicMaterial({map:ribbonMap,color:0xd1c6b0,vertexColors:true,transparent:true,opacity:.32,side:THREE.DoubleSide,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending}));
  this.ink.frustumCulled=false;this.group.add(this.ink);
  this.streams=Array.from({length:5},(_,index)=>{
   const g=new THREE.BufferGeometry(),uv=[],indices=[];
   for(let i=0;i<=64;i++){uv.push(0,i/64,1,i/64);if(i<64){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}}
   g.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(130*3),3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);
   const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({map:ribbonMap,color:0xc0b7a5,transparent:true,opacity:.14,side:THREE.DoubleSide,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending}));
   mesh.frustumCulled=false;this.group.add(mesh);return mesh;
  });this.reset();
 }
 reset(){this.active=false;this.complete=false;this.elapsed=0;this.group.visible=false;}
 start(){if(this.active)return;this.active=true;this.group.visible=true;this.elapsed=0;this.complete=false;this.update(0,false);}
 update(dt,reduced){
  if(!this.active)return;
  this.elapsed+=Math.max(0,dt);const time=this.elapsed,attr=this.letters.geometry.attributes.position,colors=this.letters.geometry.attributes.color;
  this.destinations.forEach(([x,y,z],i)=>{
   const seed=this.seeds[i],delay=.4+y*.32+seed*.65;
   const p=reduced?1:clamp((time-delay)/3.9,0,1),ease=1-Math.pow(1-p,3),unformed=1-ease;
   const curl=Math.sin(p*Math.PI)*(.12+seed*.16);
   attr.setXYZ(i,x*ease+Math.sin(p*9+seed*12)*curl,y*ease,z+Math.cos(p*8+seed*7)*curl*.4+unformed*(seed-.5)*.06);
   const brightness=clamp((p-.03)/.22,0,1);colors.setXYZ(i,brightness,brightness,brightness);
  });
  attr.needsUpdate=true;colors.needsUpdate=true;
  const ribbonPoints=this.ink.geometry.attributes.position,ribbonColors=this.ink.geometry.attributes.color;
  this.filaments.forEach(([x,y,z,seed],i)=>{
   const p=reduced?1:clamp((time-.4-y*.32-seed*.65)/3.9,0,1),ease=1-Math.pow(1-p,3),curl=Math.sin(p*Math.PI)*.16;
   ribbonPoints.setXYZ(i,x*ease+Math.sin(p*9+seed*12)*curl,y*ease,z+Math.cos(p*8+seed*7)*curl*.4);
   const brightness=clamp((p-.05)/.25,0,1);ribbonColors.setXYZ(i,brightness,brightness,brightness);
  });ribbonPoints.needsUpdate=true;ribbonColors.needsUpdate=true;
  const presence=clamp(time/(reduced?1:1.6),0,1);
  this.letters.material.opacity=presence*.16;this.haze.material.opacity=presence*.025;this.ink.material.opacity=presence*.32;
  this.streams.forEach((mesh,branch)=>{
   mesh.visible=!reduced;if(reduced)return;
   const points=mesh.geometry.attributes.position;
   for(let i=0;i<=64;i++){
    const rise=i/64,y=rise*Math.min(3.25,time*.85),spread=Math.pow(rise,1.7);
    const x=Math.sin(y*3-time*.3+branch*.7)*(.02+spread*.24)+(branch-2)*spread*.2;
    const width=.014+Math.sin(rise*Math.PI)*.045;
    points.setXYZ(i*2,x-width,y,Math.sin(y*4+branch)*.045);points.setXYZ(i*2+1,x+width,y,Math.sin(y*4+branch)*.045);
   }
   points.needsUpdate=true;mesh.material.opacity=presence*(time<6?.16:.1);
  });
  this.complete=time>=(reduced?1:6.5);
 }
}


// Keep the procedural scene as an offline fallback if the ending film cannot play.
export class IncenseFinale {
 constructor(){
  this.fallback=new SmokeFinale();this.group=this.fallback.group;
  this.layer=document.getElementById('incense-film-layer');this.video=document.getElementById('incense-film');this.still=document.getElementById('incense-film-still');
  this.token=0;this.reset();
  this.video.addEventListener('error',()=>{if(this.active&&!this.reduced)this.fail();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.pause();});
 }
 reset(){
  this.pause();this.active=false;this.complete=false;this.failed=false;this.elapsed=0;this.stalled=0;this.lastTime=0;
  this.fallback.reset();this.layer.hidden=true;this.layer.style.opacity='0';this.layer.dataset.stage='idle';
  if(this.video.readyState)this.video.currentTime=0;
 }
 start(reduced=false){
  if(this.active)return;this.reset();this.active=true;this.reduced=reduced;
  this.video.hidden=reduced;this.video.muted=true;this.still.hidden=!reduced;this.layer.hidden=false;this.layer.dataset.stage='loading';
  if(!reduced){
   if(!this.video.getAttribute('src'))this.video.src=new URL('../../assets/films/incense-ending.mp4',import.meta.url).href;
   else if(this.video.error)this.video.load();
  }
 }
 pause(){
  if(!this.paused){this.token++;this.pending=false;}
  this.paused=true;this.video.pause();
 }
 play(){
  if(this.pending||!this.video.paused||this.video.ended||this.failed||this.complete)return;
  const token=++this.token;this.pending=true;
  this.video.play().catch(()=>{
   if(token!==this.token||!this.active||this.paused)return;
   this.fail();
  }).finally(()=>{if(token===this.token)this.pending=false;});
 }
 fail(){
  if(!this.active||this.failed)return;this.pause();this.failed=true;this.layer.hidden=true;this.layer.dataset.stage='fallback';this.fallback.start();
 }
 update(dt,reduced){
  if(!this.active)return;
  if(document.hidden||dt<=0){this.pause();return;}
  if(this.complete)return;
  this.paused=false;
  if(reduced&&!this.reduced){this.reduced=true;this.video.pause();this.video.hidden=true;this.still.hidden=false;}
  if(this.failed){this.fallback.update(dt,reduced);this.elapsed+=dt;this.complete=this.fallback.complete;return;}
  if(!this.reduced){
   this.play();
   this.stalled=this.video.currentTime>this.lastTime+.001?0:this.stalled+dt;this.lastTime=this.video.currentTime;
   if(this.stalled>10){this.fail();return;}
   if(this.video.readyState<2)return;
  }
  this.elapsed+=dt;
  const p=clamp(this.elapsed/(this.reduced?.6:1.3),0,1),mix=p*p*(3-2*p);
  this.layer.style.opacity=String(mix);this.layer.dataset.stage=p<1?'transition':'playing';
  if(p>=1&&(this.reduced||this.video.ended)){
   this.complete=true;this.video.pause();this.layer.dataset.stage='held';
  }
 }
}
