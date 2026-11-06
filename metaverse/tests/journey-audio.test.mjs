import test from 'node:test';
import assert from 'node:assert/strict';
import { JourneyAudio } from '../src/journey-audio.js';

test('room loops stop at the next room; finale replaces incense once; pause and restart are respected',()=>{
 const originalAudio=globalThis.Audio,originalDocument=globalThis.document;
 globalThis.Audio=class {
  constructor(){this.paused=true;this.ended=false;this.currentTime=0;this.plays=0;}
  play(){this.paused=false;this.plays++;return Promise.resolve();}
  pause(){this.paused=true;}
 };
 globalThis.document={addEventListener(){},removeEventListener(){}};
 try{
  const audio=new JourneyAudio({hidden:true});
  const update=(carId,extra={})=>audio.update({phase:'walking',paused:false,carId,...extra});
  for(const [id,key] of [['01','hospital'],['02','home'],['03','playground'],['04','cafe'],['05','forest'],['06','hospital'],['07','incense']]){
   const previous=audio.ambience;update(id);
   if(previous)assert.equal(previous.paused,true);
   assert.equal(audio.ambience,audio.clips[key]);assert.equal(audio.ambience.loop,true);
   const plays=audio.ambience.plays;update(id);assert.equal(audio.ambience.plays,plays);
  }
  update('07',{paused:true});assert.equal(audio.clips.incense.paused,true);
  update('07');assert.equal(audio.clips.incense.paused,false);
  update('07',{finale:true});assert.equal(audio.clips.incense.paused,true);
  assert.equal(audio.ambience,audio.clips.ash);assert.ok(!audio.clips.ash.loop);
  const plays=audio.clips.ash.plays;audio.clips.ash.ended=true;audio.clips.ash.paused=true;
  update('07',{finale:true});update('07',{finale:true});assert.equal(audio.clips.ash.plays,plays);
  audio.stop();assert.equal(audio.pending.size,0);assert.equal(audio.room,null);
  update('01');assert.equal(audio.clips.hospital.currentTime,0);assert.equal(audio.clips.hospital.paused,false);
 }finally{globalThis.Audio=originalAudio;globalThis.document=originalDocument;}
});
