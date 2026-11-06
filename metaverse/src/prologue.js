export const PROLOGUE=Object.freeze({handoffAt:10.4,blendSeconds:3.2,stillSeconds:1.8,stillBlend:1.2});
const smooth=p=>p*p*(3-2*p);

export class PlanetPrologue {
 constructor({video,still,layer,light,onProgress,onDone,onError}){
  Object.assign(this,{video,still,layer,light,onProgress,onDone,onError});this.token=0;
  video.addEventListener('error',()=>{if(this.active&&!this.reduced)this.fail();});this.reset();
 }
 reset(){
  this.pause();this.active=false;this.failed=false;this.finished=false;this.elapsed=0;this.bridge=null;this.lastMediaTime=0;this.stalled=0;
  if(this.video.readyState)this.video.currentTime=0;
  this.layer.style.opacity='1';this.video.style.transform='none';this.light.style.opacity='0';this.layer.dataset.stage='idle';
 }
 start(reduced=false){
  this.reset();this.active=true;this.reduced=reduced;this.paused=false;
  this.video.hidden=reduced;this.still.hidden=!reduced;this.layer.dataset.stage=reduced?'still':'planet';this.onProgress(0,reduced);
  if(!reduced){
   if(!this.video.getAttribute('src'))this.video.src=new URL('../assets/films/planet-womb.mp4',import.meta.url).href;
   else if(this.video.error)this.video.load();
   this.play();
  }
 }
 async play(){
  if(!this.active||this.reduced||this.failed||this.video.ended)return;
  const token=++this.token;
  try{await this.video.play();}catch(error){if(token===this.token&&this.active&&!this.paused&&error.name!=='AbortError')this.fail();}
 }
 pause(){this.paused=true;this.token++;this.video.pause();}
 resume(){if(!this.active||this.failed)return;this.paused=false;this.play();}
 fail(){if(this.failed)return;this.failed=true;this.pause();this.layer.dataset.stage='error';this.onError();}
 finish(){
  if(this.finished)return;this.finished=true;this.active=false;this.pause();
  this.layer.style.opacity='0';this.light.style.opacity='0';this.layer.dataset.stage='complete';this.onProgress(1,this.reduced);this.onDone();
 }
 update(dt){
  if(!this.active||this.paused||this.failed)return;
  this.elapsed+=dt;
  if(!this.reduced&&this.bridge===null){
   this.stalled=this.video.currentTime>this.lastMediaTime+.001?0:this.stalled+dt;this.lastMediaTime=this.video.currentTime;
   if(this.stalled>10){this.fail();return;}
  }
  if(this.bridge===null){
   if(this.reduced?this.elapsed>=PROLOGUE.stillSeconds:this.video.currentTime>=PROLOGUE.handoffAt||this.video.ended)this.bridge=0;
   else return;
  }
  this.bridge+=dt;const p=Math.min(1,this.bridge/(this.reduced?PROLOGUE.stillBlend:PROLOGUE.blendSeconds));
  const mix=smooth(p);this.layer.dataset.stage='transition';
  this.layer.style.opacity=String(1-mix);this.light.style.opacity=String(Math.sin(Math.PI*p)*(this.reduced?.08:.28));
  this.video.style.transform=this.reduced?'none':`scale(${1+mix*.12})`;
  this.onProgress(p,this.reduced);
  if(p>=1)this.finish();
 }
}
