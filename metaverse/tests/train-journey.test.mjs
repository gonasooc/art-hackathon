import test from 'node:test';
import assert from 'node:assert/strict';
import { TrainJourney } from '../src/train-journey.js';
import { TRAIN, CARRIAGES, JOURNEY_ORDER } from '../src/config.js';

const walkToBoundary=(journey,direction,from=0)=>{
  let now=from;
  while(!journey.snapshot().arrived&&now-from<60000){
    now+=1000/60;journey.step(1/60,now,{valid:true,x:direction,y:.5,time:now});
  }
  return now;
};

test('the journey starts outside and cannot board without gaze-driven arrival at the door',()=>{
  const journey=new TrainJourney();
  assert.equal(journey.snapshot().stage,'platform');assert.equal(journey.snapshot().boarded,false);
  assert.equal(journey.beginBoarding(),false);assert.equal(journey.enterCar('00'),false);
  for(let t=0;t<30000;t+=50)journey.step(.05,t,null);
  assert.equal(journey.snapshot().z,0);assert.equal(journey.snapshot().boarded,false);
});

test('left, center and right gaze stay within the entrance and board only car 00',()=>{
  for(const direction of [.1,.5,.9]){
    const journey=new TrainJourney(),now=walkToBoundary(journey,direction);
    assert.equal(journey.snapshot().arrived,'boarding');assert.ok(Math.abs(journey.snapshot().x)<=TRAIN.doorHalfWidth);
    assert.equal(journey.beginBoarding(),true);assert.equal(journey.snapshot().boarded,true);
    const frozen=journey.snapshot();journey.step(.05,now+50,{valid:true,x:direction,y:.5,time:now+50});
    assert.deepEqual(journey.snapshot(),frozen);
    assert.equal(journey.enterCar('01'),false);assert.equal(journey.enterCar('00'),true);
    assert.equal(journey.snapshot().stage,'carriage');assert.equal(journey.snapshot().carId,'00');assert.equal(journey.snapshot().z,0);
    walkToBoundary(journey,direction,now+100);
    assert.equal(journey.snapshot().arrived,'00');assert.ok(Math.abs(journey.snapshot().x)<=TRAIN.interiorHalfWidth);
  }
});

test('a moving train never advances a passenger who has no valid gaze; restart returns outside',()=>{
  const journey=new TrainJourney();const now=walkToBoundary(journey,.5);
  journey.beginBoarding();journey.enterCar('00');
  for(let t=now;t<now+10000;t+=50)journey.step(.05,t,{valid:false,time:t});
  assert.equal(journey.snapshot().z,0);assert.equal(journey.snapshot().boarded,true);
  journey.reset();assert.equal(journey.snapshot().stage,'platform');assert.equal(journey.snapshot().boarded,false);
});

test('eight implemented carriages advance only after their exit boundary',()=>{
  assert.deepEqual(CARRIAGES.map(car=>car.id),Array.from({length:15},(_,i)=>String(i).padStart(2,'0')));
  assert.deepEqual(CARRIAGES.filter(car=>car.implemented).map(car=>car.id),JOURNEY_ORDER);
  assert.deepEqual(JOURNEY_ORDER,['00','01','02','03','04','05','06','07']);
  assert.deepEqual(CARRIAGES.slice(1,6).map(car=>car.title),['병원','유년의 집','놀이터','카페','숲']);
  const journey=new TrainJourney();let now=walkToBoundary(journey,.5);
  journey.beginBoarding();journey.enterCar('00');
  for(const id of JOURNEY_ORDER){
    assert.equal(journey.carId,id);assert.equal(journey.nextCar(),false);
    now=walkToBoundary(journey,.5,now+100);
    if(id!=='00'){
      assert.equal(journey.nextCar(),false);
      journey.openExit();now=walkToBoundary(journey,.5,now+100);
    }
    assert.equal(journey.nextCar(),id!=='07');
  }
  assert.equal(journey.nextCarId,null);
});
