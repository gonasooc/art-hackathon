// Keep media playback tied to the experience clock and its pause controls.
export class JourneyAudio {
 constructor(video){
  this.video=video;
  this.clips=Object.fromEntries(Object.entries({prologue:'prologue.mp3',horn:'train-horn.mp3',door:'carriage-door.wav',hospital:'hospital.mp3',deathHospital:'death-hospital.mp3',home:'home.wav',playground:'playground.wav',cafe:'cafe.wav',forest:'forest.wav',incense:'incense.wav',ash:'ash.wav'}).map(([key,file])=>{
   const audio=new Audio(new URL(`../assets/audio/${file}`,import.meta.url).href);audio.preload='auto';
   return [key,audio];
  }));
  this.pending=new Set();this.ambience=null;this.room=null;
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
 stop(){for(const audio of Object.values(this.clips)){audio.pause();audio.currentTime=0;}this.pending.clear();this.ambience=null;this.room=null;}
 update({phase,paused,carId,finale=false}){
  if(!paused){
   const room=finale?'finale':carId||null;
   if(room!==this.room){
    if(this.ambience){this.ambience.pause();this.ambience.currentTime=0;this.pending.delete(this.ambience);}
    this.room=room;
    const key=finale?'ash':({'01':'hospital','02':'home','03':'playground','04':'cafe','05':'forest','06':'deathHospital','07':'incense'})[carId];
    this.ambience=key?this.clips[key]:null;
    if(key)this.play(key);
   }
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
