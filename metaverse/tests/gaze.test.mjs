import test from 'node:test';
import assert from 'node:assert/strict';
import { GazeModel, validateGaze } from '../src/gaze-model.js';
import { CALIBRATION } from '../src/config.js';
import { extractEyeFeatures } from '../src/eye-features.js';

const pose=[.5,.5,.3,0,0];
const features=(x,y)=>[(x-.5)*.18,(y-.5)*.08];
const groups=()=>CALIBRATION.training.map(target=>({target,samples:Array.from({length:24},(_,i)=>({features:features(...target).map(v=>v+Math.sin(i)*.0003),pose:[...pose]}))}));
test('calibration learns eye features and generalizes to targets not used during training',()=>{
  const model=new GazeModel().fit(groups());
  const validation=CALIBRATION.validation.map(target=>({target,predictions:Array.from({length:24},()=>model.predict(features(...target)))}));
  assert.equal(validateGaze(validation).passed,true);
  assert.ok(model.predict(features(.8,.3)).x>.7);
  assert.ok(model.predict(features(.2,.7)).x<.3);
});
test('constant eyes, insufficient data, out-of-range predictions and moved head cannot steer',()=>{
  assert.throws(()=>new GazeModel().fit(groups().map(g=>({...g,samples:g.samples.map(s=>({...s,features:[0,0]}))}))));
  assert.throws(()=>new GazeModel().fit(groups().slice(0,3)));
  const model=new GazeModel().fit(groups());assert.equal(model.predict([2,2]),null);
  assert.equal(model.poseMatches(pose),true);assert.equal(model.poseMatches([.7,.5,.3,0,0]),false);
  model.clear();assert.equal(model.predict(features(.2,.7)),null);
});
test('validation rejects center-only predictions, offset, jitter, and insufficient samples',()=>{
  const data=CALIBRATION.validation.map(target=>({target,predictions:Array.from({length:24},()=>({x:.5,y:.5}))}));
  assert.equal(validateGaze(data).passed,false);
  assert.equal(validateGaze(data.slice(0,2)).passed,false);
  assert.equal(validateGaze(data.map(g=>({...g,predictions:[{x:g.target[0],y:g.target[1]}]}))).passed,false);
  const jitter=data.map(g=>({...g,predictions:Array.from({length:24},(_,i)=>({x:g.target[0]+(i%2?.3:-.3),y:g.target[1]}))}));
  assert.equal(validateGaze(jitter).passed,false);
});
test('face extraction uses iris position within eyes and rejects closed eyes or missing faces',()=>{
  const points=Array.from({length:478},()=>({x:.5,y:.5,z:0}));
  for(const [a,b,iris,upper,lower,center] of [[33,133,468,159,145,.4],[362,263,473,386,374,.6]]){
    points[a]={x:center-.04,y:.4};points[b]={x:center+.04,y:.4};points[iris]={x:center,y:.4};
    points[upper]={x:center,y:.38};points[lower]={x:center,y:.42};
  }
  points[234]={x:.3,y:.5};points[454]={x:.7,y:.5};
  const result={faceLandmarks:[points],faceBlendshapes:[{categories:[]}],facialTransformationMatrixes:[]};
  const centered=extractEyeFeatures(result);assert.equal(centered.valid,true);assert.ok(Math.abs(centered.features[0])<1e-10);
  points[468].x+=.01;points[473].x+=.01;assert.ok(extractEyeFeatures(result).features[0]>.1);
  result.faceBlendshapes[0].categories=[{categoryName:'eyeBlinkLeft',score:.8}];assert.equal(extractEyeFeatures(result).reason,'blink');
  assert.equal(extractEyeFeatures({faceLandmarks:[]}).valid,false);
});
