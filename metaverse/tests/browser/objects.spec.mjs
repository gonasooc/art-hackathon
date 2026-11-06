import {test,expect} from '@playwright/test';
import {simulatedEyes,startAndWalk} from './support.mjs';
import {mkdir} from 'node:fs/promises';
async function gazeAt(page,position){
 const gaze=await page.evaluate(async position=>{
  const T=await import('./vendor/three/three.module.js');const {TRAIN,WORLD}=await import('./src/config.js');
  const c=new T.PerspectiveCamera(48,innerWidth/innerHeight,.04,180);c.position.set(TRAIN.interiorStartX-TRAIN.interiorLength,WORLD.eyeHeight+TRAIN.floorY,TRAIN.centerZ);c.lookAt(new T.Vector3(-9,2,TRAIN.centerZ));c.updateMatrixWorld();
  const p=new T.Vector3(...position).project(c);return{x:(p.x+1)/2,y:(1-p.y)/2};
 },position);
 await page.evaluate(gaze=>window.__eyes=gaze,gaze);await page.waitForTimeout(900);
 await expect(page.locator('body')).not.toHaveAttribute('data-gaze-target','');
 await page.evaluate(gaze=>new Promise(resolve=>{
   const valid=()=>({valid:true,features:[(gaze.x-.5)*.18,(gaze.y-.5)*.08],pose:[.5,.5,.3,0,0],time:performance.now()});
   window.__emitEyeSample(valid());window.__eyes={invalid:'blink'};
   window.__emitEyeSample({valid:false,reason:'blink',blinkClosed:true,time:performance.now()});
   setTimeout(()=>{window.__eyes=gaze;window.__emitEyeSample(valid());resolve();},120);
 }),gaze);
}
test('womb passes without objects; hospital gaze and blink dissolve the two objects',async({page})=>{
 test.setTimeout(120000);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&m.text().includes('THREE.WebGLProgram'))errors.push(m.text());});
 await simulatedEyes(page);await startAndWalk(page,.5);
 await expect(page.locator('#object-hint')).toHaveCount(0);
 expect(await page.locator('#world').evaluate(c=>JSON.parse(c.dataset.objectState).some(t=>t.id.startsWith('00-')))).toBe(false);
 await expect(page.locator('body')).toHaveAttribute('data-carriage','01',{timeout:30000});
 await expect(page.locator('body')).toHaveAttribute('data-phase','objects',{timeout:20000});
 await mkdir(new URL('../../.cache/verification/',import.meta.url),{recursive:true});
 await page.screenshot({path:new URL('../../.cache/verification/hospital-01.png',import.meta.url).pathname});
 await gazeAt(page,[-8.48,1.89,-8.75]);await page.waitForTimeout(3000);
 await gazeAt(page,[-9,1.65,-7.35]);
 await expect(page.locator('body')).toHaveAttribute('data-phase','walking',{timeout:10000});
 await page.evaluate(()=>window.__eyes={x:.5,y:.5});
 await expect(page.locator('body')).toHaveAttribute('data-phase','ended',{timeout:20000});
 expect(await page.locator('video').count()).toBe(0);expect(errors).toEqual([]);
});
