import {clamp,JOURNEY_ORDER} from './config.js';

export const DEMO_TIMING=Object.freeze({turn:1.2,dwell:1.1,blink:.16,after:.65});
const axisInput=value=>Math.abs(value)<.015?.5:.5+Math.sign(value)*(.16+.84*Math.min(1,Math.abs(value)))/2;

// Presentation input only. The real camera/training pipeline is never forged or marked passed.
export class VisualDemo {
 constructor(world){this.world=world;this.active=false;this.paused=false;this.preparing=false;this.time=0;this.gaze={x:.5,y:.5};this.resetFocus();}
 start(){this.active=true;this.paused=false;this.time=0;this.gaze={x:.5,y:.5};this.resetFocus();}
 stop(){this.active=false;this.paused=false;this.preparing=false;this.resetFocus();}
 resetFocus(){this.target=null;this.elapsed=0;this.dwell=0;this.closed=null;this.rest=0;this.blinkAmount=0;this.stage='walking';}
 seekCar(navigation,id){
  if(!this.active||this.preparing||!navigation.boarded||!navigation.carId||!JOURNEY_ORDER.includes(id))return false;
  // Presentation-only navigation; normal eye-driven exit guards stay unchanged.
  navigation.stage='boarding';
  if(!navigation.enterCar(id))return false;
  this.gaze={x:.5,y:.5};this.resetFocus();return true;
 }
 sample(phase,dt,navigation){
  this.time+=dt*1000;this.blinkAmount=0;
  if(phase!=='objects'){
   this.resetFocus();
   const walker=navigation.walker;
   // Correct an interrupted turn gently through the same steering input as the eyes.
   this.gaze={x:axisInput((clamp(-walker.x*.4,-.25,.25)-walker.yaw)*2.5),y:axisInput((walker.pitch+.04)*3)};
   return {...this.gaze,valid:true,time:this.time};
  }
  if(this.target?.gone){
   this.rest+=dt;this.stage='watching';
   if(this.rest<DEMO_TIMING.after)return {...this.gaze,valid:true,time:this.time};
   this.target=null;
  }
  if(!this.target){
   this.target=this.world.objects.targets.find(target=>target.car===navigation.carId&&!target.gone);
   this.from={...this.gaze};this.elapsed=0;this.dwell=0;this.closed=null;this.rest=0;
  }
  if(!this.target)return {valid:false,time:this.time};
  if(this.target.progress!==null){this.stage='watching';return {...this.gaze,valid:true,time:this.time};}
  this.world.camera.updateMatrixWorld();
  const point=this.target.aim.clone().project(this.world.camera),to={x:(point.x+1)/2,y:(1-point.y)/2};
  this.elapsed+=dt;const progress=clamp(this.elapsed/DEMO_TIMING.turn,0,1),ease=progress*progress*(3-2*progress);
  this.gaze={x:this.from.x+(to.x-this.from.x)*ease,y:this.from.y+(to.y-this.from.y)*ease};
  if(this.closed!==null){
   this.closed+=dt;this.stage='blink';
   if(this.closed<DEMO_TIMING.blink){this.blinkAmount=Math.sin(Math.PI*this.closed/DEMO_TIMING.blink);return {valid:false,reason:'blink',blinkClosed:true,time:this.time};}
   this.closed=null;this.dwell=0;this.stage='watching';
   return {...this.gaze,valid:true,time:this.time};
  }
  this.stage=progress<1?'looking':'holding';
  if(progress>=1){
   this.dwell=this.world.objects.focusedId===this.target.id?this.dwell+dt:0;
   if(this.dwell>=DEMO_TIMING.dwell){this.closed=0;this.stage='blink';return {valid:false,reason:'blink',blinkClosed:true,time:this.time};}
  }
  return {...this.gaze,valid:true,time:this.time};
 }
}
