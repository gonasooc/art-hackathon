import test from 'node:test';
import assert from 'node:assert/strict';
import { HandheldMotion } from '../src/handheld.js';

test('handheld stays within tiny fixed bounds and never rolls or jitters between frames',()=>{
  const motion=new HandheldMotion();let previous=motion.sample(0,false);
  for(let i=0;i<7200;i++){
    const pose=motion.sample(1/60,true);
    assert.ok(Math.abs(pose.x)<=.0025);assert.ok(Math.abs(pose.y)<=.0035);
    assert.ok(Math.abs(pose.yaw)<=.0011);assert.ok(Math.abs(pose.pitch)<=.0015);assert.equal(pose.roll,0);
    assert.ok(Math.abs(pose.pitch-previous.pitch)<.00013);previous=pose;
  }
});
test('stopping settles the motion, and reduced motion or the off switch removes it entirely',()=>{
  const motion=new HandheldMotion();for(let i=0;i<180;i++)motion.sample(1/60,true);
  for(let i=0;i<120;i++)motion.sample(1/60,false);
  assert.equal(motion.amount,0);
  assert.deepEqual(motion.sample(1/60,true,false),{x:0,y:0,yaw:0,pitch:0,roll:0});
  assert.equal(motion.time,0);
});
