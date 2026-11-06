import { Navigation } from './navigation.js';
import { TRAIN, WORLD, CARRIAGES, clamp } from './config.js';

// Locomotion remains local to the platform / carriage. Scenery animation never changes it.
export class TrainJourney {
  constructor(options={}) { this.options=options;this.reset(); }
  makeWalker(length,halfWidth,destination) {
    return new Navigation({...WORLD,...this.options,length,halfWidth,destination});
  }
  reset() {
    this.stage='platform';this.carId=null;this.boarded=false;this.travelSeconds=0;
    this.walker=this.makeWalker(TRAIN.approachLength,TRAIN.approachHalfWidth,'boarding');
  }
  invalidate() { this.walker.invalidate(); }
  step(dt,now,sample,enabled=true) {
    if(this.stage==='boarding')return this.snapshot();
    const before=this.walker.trackedSeconds;
    this.walker.step(dt,now,sample,enabled);
    this.travelSeconds+=this.walker.trackedSeconds-before;
    if(this.stage==='platform'){
      // The visible approach lines and handrails taper into the open door.
      const t=clamp((this.walker.z/TRAIN.approachLength-.25)/.65,0,1);
      const width=TRAIN.approachHalfWidth+(TRAIN.doorHalfWidth-TRAIN.approachHalfWidth)*(t*t*(3-2*t));
      this.walker.x=clamp(this.walker.x,-width,width);
    }
    return this.snapshot();
  }
  beginBoarding() {
    if(this.stage!=='platform'||this.walker.arrived!=='boarding')return false;
    this.stage='boarding';this.boarded=true;this.walker.invalidate();return true;
  }
  enterCar(id='00') {
    const car=CARRIAGES.find(car=>car.id===id);
    if(this.stage!=='boarding'||!car?.implemented||(this.carId===null&&id!=='00'))return false;
    this.carId=id;this.stage='carriage';
    this.walker=this.makeWalker(id==='00'?TRAIN.exitLength:TRAIN.interiorLength,TRAIN.interiorHalfWidth,id);
    return true;
  }
  openExit() {
    this.walker.rules.length=TRAIN.exitLength;this.walker.arrived=null;
    this.walker.yaw=0;this.walker.pitch=-.15;this.walker.filtered={x:.5,y:.5};this.invalidate();
  }
  nextCar() {
    if(this.stage!=='carriage'||this.carId!=='00'||this.walker.z<TRAIN.exitLength)return false;
    this.stage='boarding';return this.enterCar('01');
  }
  snapshot() {
    const snapshot=this.walker.snapshot();
    return {...snapshot,stage:this.stage,carId:this.carId,boarded:this.boarded,
      arrived:this.stage==='boarding'?null:snapshot.arrived,
      moving:this.stage==='boarding'?false:snapshot.moving,totalTrackedSeconds:this.travelSeconds};
  }
}
