import test from 'node:test';
import assert from 'node:assert/strict';
import {BlinkInteraction} from '../src/blink-interaction.js';
function arm(b){b.observe({valid:true,time:0},'chair');b.observe({valid:true,time:220},'chair');}
test('a short closed/reopen blink activates exactly the gazed object once',()=>{const b=new BlinkInteraction();arm(b);assert.equal(b.observe({valid:false,reason:'blink',time:250},null),null);assert.equal(b.observe({valid:true,time:370},'chair'),'chair');assert.equal(b.observe({valid:true,time:390},'chair'),null);});
test('face loss, wink, long closure, stale aim and a different reopened target do not activate',()=>{
 for(const scenario of ['face','wink','long','different','stale']){const b=new BlinkInteraction();arm(b);b.observe({valid:false,reason:scenario==='face'?'face':'blink',blinkClosed:scenario!=='wink',time:scenario==='stale'?600:250},null);assert.equal(b.observe({valid:true,time:scenario==='long'?1000:scenario==='stale'?720:370},scenario==='different'?'leopard':'chair'),null,scenario);}
});
test('slightly asynchronous eyelids preserve the pre-blink target',()=>{const b=new BlinkInteraction();arm(b);b.observe({valid:false,reason:'blink',blinkClosed:false,time:240},null);b.observe({valid:false,reason:'blink',blinkClosed:true,time:270},null);assert.equal(b.observe({valid:true,time:370},null),'chair');});
