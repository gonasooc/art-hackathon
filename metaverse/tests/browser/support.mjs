import { readFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
export async function simulatedEyes(page,{wrongValidation=false,speed=9,validationOutlier='none',fullPrologue=false}={}) {
  if(!fullPrologue)await page.route('**/src/prologue.js',async route=>route.fulfill({contentType:'text/javascript',body:(await readFile(new URL('../../src/prologue.js',import.meta.url),'utf8')).replace('handoffAt:10.4,blendSeconds:3.2,stillSeconds:1.8','handoffAt:.15,blendSeconds:.15,stillSeconds:.1')}));
  // Only the tracker boundary and timing are replaced. Visual inspection is a separate
  // explicit mode; it never supplies gaze samples or bypasses validation in the eye experience.
  await page.route('**/src/config.js',async route=>{
    const original=await readFile(new URL('../../src/config.js',import.meta.url),'utf8');
    await route.fulfill({contentType:'text/javascript',body:original
      .replace(/speed: [\d.]+/,`speed: ${speed}`).replace('settleMs: 900, captureMs: 1000, minSamples: 12','settleMs: 50, captureMs: 120, minSamples: 4')
      .replace('firstSettleMs: 1800','firstSettleMs: 80')
      .replace('alignmentSeconds: 1.5','alignmentSeconds: 0.15')});
  });
  await page.route('**/src/tracker.js',route=>route.fulfill({contentType:'text/javascript',body:`
    export class EyeTracker {
      constructor(callback){this.callback=callback;}
      async start(){this.stop();this.paused=false;let frame=0;window.__emitEyeSample=sample=>this.callback(sample);
        this.timer=setInterval(()=>{
          if(this.paused||window.__eyes?.noUpdates)return;
          const phase=document.body.dataset.phase,target=document.getElementById('target');
          let x=.5,y=.5;
          if(phase==='calibrating'||phase==='validating') {x=Number(target.dataset.x);y=Number(target.dataset.y);}
          else {x=window.__eyes?.x??.5;y=window.__eyes?.y??.5;}
          if(phase==='validating'&&${wrongValidation}){x=.5;y=.5;}
          if(phase==='validating'&&target.dataset.index==='0'&&(${validationOutlier==='always'}||(${validationOutlier==='once'}&&document.body.dataset.validationAttempt==='1'))){y+=.25;}
          const invalid=window.__eyes?.invalid;
          const noise=Math.sin(frame++)*.0001;
          this.callback({valid:!invalid,reason:invalid||'',features:[(x-.5)*.18+noise,(y-.5)*.08+noise],pose:[.5,.5,.3,0,0],time:performance.now()});
        },20);
      }
      setPaused(value){this.paused=value;}
      stop(){clearInterval(this.timer);window.__trackerStops=(window.__trackerStops||0)+1;}
    }
  `}));
}

export async function startAndWalk(page,direction=.5) {
  await page.goto('./');
  await page.evaluate(x=>{window.__eyes={x};},direction);
  await page.getByRole('button',{name:'시선으로 시작'}).click();
  await page.waitForSelector('body[data-phase="walking"]');
}

export async function gazeAt(page,position,id){
 const gaze=await page.evaluate(async position=>{
  const T=await import('./vendor/three/three.module.js');const {TRAIN,WORLD}=await import('./src/config.js');
  const c=new T.PerspectiveCamera(48,innerWidth/innerHeight,.04,180);c.position.set(TRAIN.interiorStartX-TRAIN.interiorLength,WORLD.eyeHeight+TRAIN.floorY,TRAIN.centerZ);c.lookAt(new T.Vector3(-9,2,TRAIN.centerZ));c.updateMatrixWorld();
  const p=new T.Vector3(...position).project(c);return{x:(p.x+1)/2,y:(1-p.y)/2};
 },position);
 await page.evaluate(gaze=>window.__eyes=gaze,gaze);await page.waitForTimeout(900);
 await expect(page.locator('body')).toHaveAttribute('data-gaze-target',id);
 await page.evaluate(gaze=>new Promise(resolve=>{
   const valid=()=>({valid:true,features:[(gaze.x-.5)*.18,(gaze.y-.5)*.08],pose:[.5,.5,.3,0,0],time:performance.now()});
   window.__emitEyeSample(valid());window.__eyes={invalid:'blink'};
   window.__emitEyeSample({valid:false,reason:'blink',blinkClosed:true,time:performance.now()});
   setTimeout(()=>{window.__eyes=gaze;window.__emitEyeSample(valid());resolve();},120);
 }),gaze);
 await expect(page.locator('body')).toHaveAttribute('data-blink-activated',id);
 await expect.poll(()=>page.locator('#world').evaluate((c,id)=>JSON.parse(c.dataset.objectState).find(t=>t.id===id)?.gone,id),{timeout:15000}).toBe(true);
}
