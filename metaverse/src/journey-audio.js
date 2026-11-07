import {TRAIN} from './config.js';
export const FOOTSTEP_VOLUME=.18;

// Keep media playback tied to the experience clock and its pause controls.
export class JourneyAudio {
 constructor(video){
  this.video=video;
  this.clips=Object.fromEntries(Object.entries({prologue:'prologue.mp3',horn:'train-horn.mp3',door:'carriage-door.wav',hospital:'hospital.mp3',deathHospital:'death-hospital.mp3',home:'home.wav',playground:'playground.wav',cafe:'cafe.wav',forest:'forest.wav',incense:'incense.wav',footsteps:'footsteps.wav'}).map(([key,file])=>{
   const audio=new Audio(new URL(`../assets/audio/${file}`,import.meta.url).href);audio.preload='auto';
   return [key,audio];
  }));
  this.clips.footsteps.loop=true;this.clips.footsteps.volume=0;
  this.pending=new Set();this.ambience=null;this.room=null;this.hornStarted=false;
  for(const key of ['hospital','deathHospital','home','playground','cafe','forest','incense'])this.clips[key].loop=true;
  const unlock=()=>{
   for(const audio of Object.values(this.clips)){
    if(this.pending.has(audio))continue;
    audio.muted=true;
    audio.play()?.then(()=>{audio.pause();audio.currentTime=0;audio.muted=false;}).catch(()=>{audio.muted=false;});
   }
   document.removeEventListener('pointerdown',unlock);
   document.removeEventListener('keydown',unlock);
  };
  document.addEventListener('pointerdown',unlock);
  document.addEventListener('keydown',unlock);
 }
 play(key){const audio=this.clips[key];audio.currentTime=0;this.pending.add(audio);this.tryPlay(audio);}
 tryPlay(audio){if(audio.paused)audio.play()?.catch(()=>{});}
 stop(){for(const audio of Object.values(this.clips)){audio.pause();audio.currentTime=0;}this.pending.clear();this.ambience=null;this.room=null;this.hornStarted=false;this.clips.horn.volume=1;this.clips.footsteps.volume=0;}
 updateHorn({phase,paused,carId,journeyStage,travelDistance}){
  if(paused)return;
  const horn=this.clips.horn;
  if(!this.hornStarted&&phase==='walking'&&journeyStage==='platform'&&travelDistance>=TRAIN.stairStart){
   this.hornStarted=true;horn.volume=1;this.play('horn');
  }
  if(!this.hornStarted||!this.pending.has(horn))return;
  if(carId&&carId!=='00'){
   horn.pause();horn.currentTime=0;this.pending.delete(horn);return;
  }
  let volume=1;
  if(carId==='00'){
   const start=TRAIN.exitLength*.5,end=TRAIN.exitLength*.9;
   const p=Math.min(1,Math.max(0,(travelDistance-start)/(end-start)));
   volume=1-p*p*(3-2*p);
  }
  // Even a slow journey gets a fade before the source clip naturally ends.
  if(Number.isFinite(horn.duration))volume=Math.min(volume,Math.max(0,(horn.duration-horn.currentTime)/1.6));
  horn.volume=Math.min(horn.volume,volume);
  if(horn.volume===0){horn.pause();horn.currentTime=0;this.pending.delete(horn);}
 }
 updateFootsteps(moving,paused,dt){
  const audio=this.clips.footsteps;
  if(paused){audio.pause();audio.currentTime=0;audio.volume=0;return;}
  const step=Math.min(Math.max(dt,0),.08)*FOOTSTEP_VOLUME/(moving?.09:.12);
  audio.volume=moving?Math.min(FOOTSTEP_VOLUME,audio.volume+step):Math.max(0,audio.volume-step);
  if(moving)this.tryPlay(audio);
  else if(audio.volume===0){audio.pause();audio.currentTime=0;}
 }
 update({phase,paused,carId,moving=false,footstepsPaused=paused,dt=.016,journeyStage,travelDistance=0,playgroundGone=false}){
  this.updateFootsteps(moving,footstepsPaused,dt);
  this.updateHorn({phase,paused,carId,journeyStage,travelDistance});
  if(!paused){
   const room=carId||null;
   if(room!==this.room){
    if(this.ambience){this.ambience.pause();this.ambience.currentTime=0;this.pending.delete(this.ambience);}
    this.room=room;
    const key=({'01':'hospital','02':'home','04':'cafe','05':'forest','06':'deathHospital','07':'incense'})[carId];
    this.ambience=key?this.clips[key]:null;
    if(key)this.play(key);
   }
   if(room==='03'&&playgroundGone&&!this.ambience){this.ambience=this.clips.playground;this.play('playground');}
  }
  const intro=this.clips.prologue;
  if(phase==='prologue'&&!this.video.hidden&&!this.video.paused&&!this.video.ended){
   if(Math.abs(intro.currentTime-this.video.currentTime)>.3)intro.currentTime=this.video.currentTime;
   if(!paused&&!intro.ended)this.tryPlay(intro);else intro.pause();
  }else intro.pause();
  for(const audio of this.pending){
   if(audio.ended){this.pending.delete(audio);continue;}
   if(paused)audio.pause();else this.tryPlay(audio);
  }
 }
}
