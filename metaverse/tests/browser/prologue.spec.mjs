import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {simulatedEyes} from './support.mjs';

const cache=new URL('../../.cache/planet-reference/',import.meta.url);
async function cleanShot(page,name){
 const style=await page.addStyleTag({content:'#demo-controls,#demo-switch,#leave,#prologue-skip{visibility:hidden!important}'});
 await page.screenshot({path:new URL(name,cache).pathname});await style.evaluate(node=>node.remove());
}

test('original planet film plays without a camera and blends into the unchanged platform start',async({page})=>{
 test.setTimeout(60000);await page.setViewportSize({width:1280,height:720});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=()=>{throw new Error('The prologue must not open a camera');};});
 await page.goto('./?mode=visual');const video=page.locator('#prologue-video');
 await expect(page.locator('body')).toHaveAttribute('data-phase','prologue');
 await expect.poll(()=>video.evaluate(v=>v.currentTime)).toBeGreaterThan(.6);
 await page.locator('#demo-pause').click();await expect(video).toHaveJSProperty('paused',true);
 const paused=await video.evaluate(v=>v.currentTime);await page.waitForTimeout(250);expect(await video.evaluate(v=>v.currentTime)).toBe(paused);
 await expect(page.locator('#world')).toHaveAttribute('data-z','0');await expect(page.locator('body')).toHaveAttribute('data-carriage','');
 await mkdir(cache,{recursive:true});await writeFile(new URL('frame-time.txt',cache),String(paused));await cleanShot(page,'planet-browser.png');
 await page.locator('#demo-pause').click();
 await expect(page.locator('#prologue-layer')).toHaveAttribute('data-stage','transition',{timeout:20000});
 await expect.poll(()=>page.locator('#prologue-layer').evaluate(el=>Number(el.style.opacity))).toBeLessThan(.65);
 await page.locator('#demo-pause').click();await cleanShot(page,'planet-bridge.png');
 const opacity=await page.locator('#prologue-layer').getAttribute('style');await page.waitForTimeout(200);await expect(page.locator('#prologue-layer')).toHaveAttribute('style',opacity);
 await page.locator('#demo-pause').click();await expect(page.locator('body')).toHaveAttribute('data-phase','walking');await page.locator('#demo-pause').click();
 await expect(page.locator('#prologue-layer')).toBeHidden();expect(await video.evaluate(v=>v.paused)).toBe(true);
 await expect(page.locator('body')).toHaveAttribute('data-journey-stage','platform');await cleanShot(page,'planet-platform.png');
 expect(errors).toEqual([]);
});

test('eye input cannot move during the prologue; later demo takeover does not replay it',async({page})=>{
 test.setTimeout(60000);await simulatedEyes(page,{fullPrologue:true,speed:.9});await page.goto('./');
 await page.getByRole('button',{name:'시선으로 시작'}).click();await expect(page.locator('body')).toHaveAttribute('data-phase','prologue');
 await page.evaluate(()=>window.__eyes={invalid:'face'});await page.waitForTimeout(350);
 await expect(page.locator('#world')).toHaveAttribute('data-z','0');await expect(page.locator('#gaze-particles')).toBeHidden();
 await expect(page.locator('body')).toHaveAttribute('data-phase','walking',{timeout:25000});
 await page.waitForTimeout(350);await expect(page.locator('#world')).toHaveAttribute('data-z','0.000');
 await page.locator('#demo-switch').click();await expect(page.locator('body')).toHaveAttribute('data-mode','demo');
 await expect(page.locator('body')).toHaveAttribute('data-phase','walking');await expect(page.locator('#prologue-layer')).toBeHidden();
});

test('switching to demo inside the prologue resumes the current video time',async({page})=>{
 await simulatedEyes(page,{fullPrologue:true});await page.goto('./');await page.getByRole('button',{name:'시선으로 시작'}).click();
 const video=page.locator('#prologue-video');await expect.poll(()=>video.evaluate(v=>v.currentTime)).toBeGreaterThan(1);
 const before=await video.evaluate(v=>v.currentTime);await page.locator('#demo-switch').click();await page.locator('#demo-pause').click();
 expect(await video.evaluate(v=>v.currentTime)).toBeGreaterThanOrEqual(before);await expect(page.locator('body')).toHaveAttribute('data-phase','prologue');
 await page.getByRole('button',{name:'시연 종료'}).click();await expect(video).toHaveJSProperty('paused',true);await expect(page.locator('body')).toHaveAttribute('data-phase','idle');
});

test('reduced motion uses the still planet; a missing video can continue at the platform',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});const films=[];page.on('request',r=>{if(r.url().endsWith('planet-womb.mp4'))films.push(r.url());});
 await page.goto('./?mode=visual');await expect(page.locator('#prologue-still')).toBeVisible();await expect(page.locator('#prologue-video')).toBeHidden();
 await expect(page.locator('body')).toHaveAttribute('data-phase','walking');expect(films).toEqual([]);
 await page.emulateMedia({reducedMotion:'no-preference'});await page.route('**/assets/films/planet-womb.mp4',route=>route.abort());
 await page.goto('./?mode=visual');await expect(page.locator('body')).toHaveAttribute('data-phase','prologue-error');
 await page.getByRole('button',{name:'기차 앞에서 계속'}).click();await expect(page.locator('body')).toHaveAttribute('data-phase','walking');
 await expect(page.locator('#prologue-layer')).toBeHidden();
});
