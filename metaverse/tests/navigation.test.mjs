import test from 'node:test';
import assert from 'node:assert/strict';
import { Navigation } from '../src/navigation.js';
import { WORLD } from '../src/config.js';

function walk(direction,options={}) {
  const navigation=new Navigation(options);let now=0;
  while(!navigation.arrived&&now<45000){now+=1000/60;navigation.step(1/60,now,{valid:true,x:direction,y:.5,time:now});}
  return {navigation,seconds:now/1000};
}
test('no camera signal never produces travel or an encounter',()=>{
  const n=new Navigation();for(let t=0;t<60000;t+=50)n.step(.05,t,null);
  assert.equal(n.z,0);assert.equal(n.arrived,null);
});
test('eyes choose different destinations; arrivals stay within 5–10 seconds at the doubled walking speed',()=>{
  for(const [direction,id] of [[0,'left'],[1,'right'],[.5,'left'],[.37,'left'],[.63,'right']]){
    const {navigation:n,seconds}=walk(direction);
    assert.equal(n.arrived,id);assert.ok(seconds>=4.99&&seconds<=10.1);
    assert.ok(Math.abs(n.x)<=WORLD.halfWidth);assert.ok(Math.abs(n.yaw)<=WORLD.yawLimit);
  }
});
test('side boundaries remove outward travel without losing forward progress or auto-turning',()=>{
  const n=new Navigation();n.x=WORLD.halfWidth;n.yaw=WORLD.yawLimit;
  n.step(.05,10,{valid:true,x:.5,y:.5,time:10});
  assert.equal(n.x,WORLD.halfWidth);assert.ok(n.z>0);assert.equal(n.yaw,WORLD.yawLimit);
});
test('a centered gaze preserves the acquired heading instead of snapping back to the corridor',()=>{
  const n=new Navigation();n.yaw=.6;n.pitch=.2;
  for(let t=0;t<1000;t+=50)n.step(.05,t,{valid:true,x:.5,y:.5,time:t});
  assert.equal(n.yaw,.6);assert.equal(n.pitch,.2);assert.ok(n.x>0);
});
test('brief blink continues the last heading, prolonged closure and stale samples stop it',()=>{
  const n=new Navigation();n.step(.05,0,{valid:true,x:.5,y:.5,time:0});
  n.step(.05,200,{valid:false,time:200});const before=n.z;assert.equal(n.moving,true);
  n.step(.05,300,{valid:false,time:300});assert.equal(n.moving,false);assert.equal(n.z,before);
  n.step(.05,400,{valid:true,x:1,y:.5,time:0});assert.equal(n.z,before);
  n.step(.05,450,{valid:true,x:.5,y:.5,time:450});assert.ok(n.z>before);
});
test('background invalidation and arrival prevent input from moving the camera',()=>{
  const n=new Navigation();n.step(.05,0,{valid:true,x:.5,y:.5,time:0});n.invalidate();
  const before=n.z;n.step(.05,100,null);assert.equal(n.z,before);
  n.step(.05,150,{valid:true,x:.5,y:.5,time:150},false);assert.equal(n.z,before);
  const {navigation:done}=walk(1);const snapshot=done.snapshot();
  done.step(.05,50000,{valid:true,x:0,y:0,time:50000});assert.deepEqual(done.snapshot(),snapshot);
});
test('extreme vertical gaze rotates only within pitch limits and does not change eye height or floor progression',()=>{
  const n=new Navigation();for(let t=0;t<2500;t+=50)n.step(.05,t,{valid:true,x:.5,y:0,time:t});
  assert.equal(n.pitch,WORLD.pitchLimit);assert.equal(n.x,0);assert.ok(Math.abs(n.z-9)<.02);
});
