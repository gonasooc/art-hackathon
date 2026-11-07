import test from 'node:test';
import assert from 'node:assert/strict';
import { JourneyAudio } from '../src/journey-audio.js';

test('room loops stop at the next room; finale continues incense without restarting; pause and restart are respected',()=>{
 const originalAudio=globalThis.Audio,originalDocument=globalThis.document;
 globalThis.Audio=class {
  constructor(src){this.src=src;this.paused=true;this.ended=false;this.currentTime=0;this.plays=0;}
  play(){this.paused=false;this.plays++;return Promise.resolve();}
  pause(){this.paused=true;}
 };
 globalThis.document={addEventListener(){},removeEventListener(){}};
 try{
  const audio=new JourneyAudio({hidden:true});
  assert.match(audio.clips.hospital.src,/\/hospital\.mp3$/);
  assert.match(audio.clips.deathHospital.src,/\/death-hospital\.mp3$/);
  assert.notEqual(audio.clips.hospital,audio.clips.deathHospital);
  const update=(carId,extra={})=>audio.update({phase:'walking',paused:false,carId,...extra});
  for(const [id,key] of [['01','hospital'],['02','home'],['03','playground'],['04','cafe'],['05','forest'],['06','deathHospital'],['07','incense']]){
   const previous=audio.ambience;update(id);
   if(previous)assert.equal(previous.paused,true);
   assert.equal(audio.ambience,audio.clips[key]);assert.equal(audio.ambience.loop,true);
   const plays=audio.ambience.plays;update(id);assert.equal(audio.ambience.plays,plays);
  }
  update('06');update('06',{paused:true});assert.equal(audio.clips.deathHospital.paused,true);
  update('06');assert.equal(audio.clips.deathHospital.paused,false);
  update('07');assert.equal(audio.clips.deathHospital.paused,true);
  update('07',{paused:true});assert.equal(audio.clips.incense.paused,true);
  update('07');assert.equal(audio.clips.incense.paused,false);
  audio.clips.incense.currentTime=2.5;
  const plays=audio.clips.incense.plays;
  update('07',{phase:'finale'});update('07',{phase:'finale'});
  assert.equal(audio.ambience,audio.clips.incense);assert.equal(audio.clips.incense.plays,plays);
  assert.equal(audio.clips.incense.currentTime,2.5);assert.equal(audio.clips.incense.loop,true);
  assert.deepEqual(Object.entries(audio.clips).filter(([,clip])=>!clip.paused).map(([key])=>key),['incense']);
  update('07',{phase:'finale',paused:true});assert.equal(audio.clips.incense.paused,true);
  update('07',{phase:'finale'});assert.equal(audio.clips.incense.paused,false);assert.equal(audio.clips.incense.currentTime,2.5);
  audio.stop();assert.equal(audio.pending.size,0);assert.equal(audio.room,null);
  update('01');assert.equal(audio.clips.hospital.currentTime,0);assert.equal(audio.clips.hospital.paused,false);
 }finally{globalThis.Audio=originalAudio;globalThis.document=originalDocument;}
});
