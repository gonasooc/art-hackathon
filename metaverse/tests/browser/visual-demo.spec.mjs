import {test,expect} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
import {simulatedEyes,startAndWalk,gazeAt} from './support.mjs';

async function fastDemo(page,{walking=true}={}){
 if(walking)await page.route('**/src/config.js',async route=>route.fulfill({contentType:'text/javascript',body:(await readFile(new URL('../../src/config.js',import.meta.url),'utf8')).replace(/speed: [\d.]+/,'speed: 6').replace('alignmentSeconds: 1.5','alignmentSeconds: 0.15')}));
 await page.route('**/src/visual-demo.js',async route=>route.fulfill({contentType:'text/javascript',body:(await readFile(new URL('../../src/visual-demo.js',import.meta.url),'utf8')).replace('turn:1.2,dwell:1.1,blink:.16,after:.65','turn:.25,dwell:.3,blink:.16,after:.15')}));
}
const states=page=>page.locator('#world').evaluate(canvas=>JSON.parse(canvas.dataset.objectState));

test('camera failure can switch to a complete hands-off demonstration with all seventeen gaze/blink interactions',async({page})=>{
 test.setTimeout(360000);await fastDemo(page);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&m.text().includes('THREE'))errors.push(m.text());});
 await page.addInitScript(()=>{window.__cameraRequests=0;navigator.mediaDevices.getUserMedia=()=>{window.__cameraRequests++;return Promise.reject(new DOMException('Denied','NotAllowedError'));};});
 await page.goto('./');await page.getByRole('button',{name:'시선으로 시작'}).click();await expect(page.locator('body')).toHaveAttribute('data-phase','error');
 await page.evaluate(()=>{
  window.__cars=[];window.__blinks=[];
  new MutationObserver(()=>{
   const {carriage,blinkActivated}=document.body.dataset;
   if(carriage&&!window.__cars.includes(carriage))window.__cars.push(carriage);
   if(blinkActivated&&window.__blinks.at(-1)!==blinkActivated)window.__blinks.push(blinkActivated);
  }).observe(document.body,{attributes:true,attributeFilter:['data-carriage','data-blink-activated']});
 });
 await page.locator('#demo-switch').click();await expect(page.locator('body')).toHaveAttribute('data-mode','demo');
 await expect(page.locator('#visual-panel')).toBeHidden();await expect(page.locator('#setup')).toBeHidden();
 await expect(page.locator('body')).toHaveAttribute('data-carriage','01',{timeout:40000});await expect(page.locator('body')).toHaveAttribute('data-phase','objects');
 await page.locator('#demo-pause').click();
 const snapshot=await page.locator('#world').evaluate(c=>[c.dataset.z,c.dataset.sceneryDistance,c.dataset.objectState]);
 await page.waitForTimeout(250);expect(await page.locator('#world').evaluate(c=>[c.dataset.z,c.dataset.sceneryDistance,c.dataset.objectState])).toEqual(snapshot);
 await page.setViewportSize({width:1280,height:800});await expect(page.locator('body')).toHaveAttribute('data-mode','demo');await expect(page.locator('#message')).toBeHidden();
 await mkdir(new URL('../../.cache/verification/',import.meta.url),{recursive:true});await page.screenshot({path:new URL('../../.cache/verification/automatic-demo.png',import.meta.url).pathname});
 await page.locator('#demo-pause').click();
 await expect(page.locator('body')).toHaveAttribute('data-phase','finale',{timeout:240000});await expect(page.locator('#world')).toHaveAttribute('data-finale','held',{timeout:20000});
 expect(await page.evaluate(()=>window.__cars)).toEqual(['00','01','02','03','04','05','06','07']);
 expect(await page.evaluate(()=>window.__blinks)).toEqual(['01-leopard','01-chair','02-mural','02-ceiling-light','02-shelf','03-slide','03-swing','04-teacups','04-chairs','04-table','05-moss','05-snow','05-tree','06-leopard','06-shroud','06-halo','07-incense']);
 expect((await states(page)).every(target=>target.gone)).toBe(true);expect(await page.evaluate(()=>window.__cameraRequests)).toBe(1);expect(errors).toEqual([]);
 await page.locator('#finale-restart').click();await expect(page.locator('body')).toHaveAttribute('data-phase','prologue');await expect(page.locator('body')).toHaveAttribute('data-phase','walking',{timeout:30000});
 await expect(page.locator('body')).toHaveAttribute('data-carriage','');expect((await states(page)).every(target=>!target.gone)).toBe(true);
 expect(await page.evaluate(()=>window.__cameraRequests)).toBe(1);
});

test('switching during object observation keeps removed objects and finishes only the remaining target',async({page})=>{
 test.setTimeout(120000);await simulatedEyes(page);await fastDemo(page,{walking:false});await startAndWalk(page);
 await expect(page.locator('body')).toHaveAttribute('data-carriage','01',{timeout:30000});await expect(page.locator('body')).toHaveAttribute('data-phase','objects');
 await gazeAt(page,[-8.48,1.89,-8.75],'01-chair');
 const before=await page.locator('#world').getAttribute('data-z'),stops=await page.evaluate(()=>window.__trackerStops);
 await page.locator('#demo-switch').click();await expect(page.locator('body')).toHaveAttribute('data-mode','demo');
 expect(await page.locator('#world').getAttribute('data-z')).toBe(before);expect((await states(page)).find(t=>t.id==='01-chair').gone).toBe(true);
 expect(await page.evaluate(()=>window.__trackerStops)).toBeGreaterThan(stops);
 await expect(page.locator('body')).toHaveAttribute('data-blink-activated','01-leopard',{timeout:20000});
 await expect(page.locator('body')).toHaveAttribute('data-carriage','02',{timeout:25000});
 await page.getByRole('button',{name:'시연 종료'}).click();await expect(page.locator('body')).toHaveAttribute('data-phase','idle');
 await page.getByRole('button',{name:'시선으로 시작'}).click();await expect(page.locator('body')).toHaveAttribute('data-mode','eye');await expect(page.locator('body')).toHaveAttribute('data-phase','calibrating');await expect(page.locator('#demo-controls')).toBeHidden();
});

test('resize recovery switches to automatic walking at the current position instead of restarting',async({page})=>{
 test.setTimeout(60000);await simulatedEyes(page,{speed:.9});await startAndWalk(page);
 await expect.poll(async()=>Number(await page.locator('#world').getAttribute('data-z'))).toBeGreaterThan(.4);
 await page.setViewportSize({width:1280,height:800});await expect(page.locator('body')).toHaveAttribute('data-phase','resize-required');
 const z=Number(await page.locator('#world').getAttribute('data-z'));
 await page.locator('#demo-switch').click();await page.locator('#demo-pause').click();
 const resumed=Number(await page.locator('#world').getAttribute('data-z'));expect(resumed).toBeGreaterThanOrEqual(z);expect(resumed).toBeLessThan(z+.8);
 await expect(page.locator('body')).toHaveAttribute('data-phase','walking');await expect(page.locator('body')).toHaveAttribute('data-mode','demo');
});

test('switching during actual camera calibration releases the camera and starts the presentation',async({page})=>{
 await page.addInitScript(()=>{
  const getUserMedia=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia=async constraints=>{const stream=await getUserMedia(constraints);window.__cameraStream=stream;return stream;};
 });
 await page.goto('./');await page.getByRole('button',{name:'시선으로 시작'}).click();
 await expect(page.locator('body')).toHaveAttribute('data-phase','calibrating',{timeout:45000});
 await page.locator('#demo-switch').click();await expect(page.locator('body')).toHaveAttribute('data-mode','demo');
 expect(await page.evaluate(()=>window.__cameraStream.getTracks().every(track=>track.readyState==='ended'))).toBe(true);
 await expect(page.locator('#setup')).toBeHidden();await expect(page.locator('#visual-panel')).toBeHidden();
 await expect.poll(async()=>Number(await page.locator('#world').getAttribute('data-z')),{timeout:30000}).toBeGreaterThan(0);
});
