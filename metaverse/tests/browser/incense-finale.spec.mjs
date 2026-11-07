import {test,expect} from '@playwright/test';
import {mkdir,readFile} from 'node:fs/promises';

test('incense dissolves into the film; preview can pause, restore and replay',async({page})=>{
 test.setTimeout(120000);const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=()=>{throw new Error('Finale preview must not open the camera');};});
 const source=await readFile(new URL('../../src/visual-inspector.js',import.meta.url),'utf8');
 await page.route('**/src/visual-inspector.js',route=>route.fulfill({contentType:'text/javascript',body:source.replace('constructor(world){','constructor(world){window.__incenseWorld=world;')}));
 await page.goto('./?mode=inspect&car=07');const canvas=page.locator('#world');
 await expect(canvas).toHaveAttribute('data-finale','hidden');
 expect(await page.evaluate(()=>{const w=window.__incenseWorld,t=w.objects.targets.find(t=>t.id==='07-incense');w.scene.updateMatrixWorld(true);const p=t.aim.clone().project(w.camera);return w.objects.pick({valid:true,x:(p.x+1)/2,y:(1-p.y)/2},w.camera);})).toBe('07-incense');
 await page.locator('#visual-dissolve').click();
 await expect(page.locator('#incense-film-layer')).toBeVisible();
 await expect(canvas).toHaveAttribute('data-finale','blooming',{timeout:20000});
 await expect.poll(()=>page.locator('#incense-film').evaluate(v=>v.currentTime)).toBeGreaterThan(.1);
 await page.locator('#visual-animation').click();
 await expect(page.locator('#incense-film')).toHaveJSProperty('paused',true);
 const mediaTime=await page.locator('#incense-film').evaluate(v=>v.currentTime);
 const time=await canvas.getAttribute('data-finale-time');await page.waitForTimeout(250);await expect(canvas).toHaveAttribute('data-finale-time',time);expect(await page.locator('#incense-film').evaluate(v=>v.currentTime)).toBe(mediaTime);
 await page.locator('#visual-animation').click();await page.keyboard.press('KeyH');
 await mkdir(new URL('../../.cache/verification/',import.meta.url),{recursive:true});
 await page.screenshot({path:new URL('../../.cache/verification/incense-finale-bloom.png',import.meta.url).pathname});
 await expect(canvas).toHaveAttribute('data-finale','held',{timeout:25000});
 await expect(page.locator('#incense-film')).toHaveJSProperty('ended',true);
 await expect(page.locator('#incense-film-layer')).toHaveCSS('opacity','1');
 expect(await canvas.evaluate(c=>JSON.parse(c.dataset.objectState).find(t=>t.id==='07-incense').gone)).toBe(true);
 await page.screenshot({path:new URL('../../.cache/verification/incense-finale.png',import.meta.url).pathname});
 await expect(page.locator('body')).toHaveAttribute('data-phase','visual');await expect(page.locator('#ending')).toBeHidden();
 await page.keyboard.press('KeyH');await page.locator('#visual-restore').click();await expect(canvas).toHaveAttribute('data-finale','hidden');await expect(page.locator('#incense-film-layer')).toBeHidden();
 await page.locator('#visual-dissolve').click();await expect(canvas).toHaveAttribute('data-finale','held',{timeout:30000});
 await page.locator('#visual-room').selectOption('01');await expect(canvas).toHaveAttribute('data-finale','hidden');
 expect(errors).toEqual([]);
});

test('reduced motion gives a stationary final composition and short text fade',async({page})=>{
 const films=[];page.on('request',r=>{if(r.url().endsWith('incense-ending.mp4'))films.push(r.url());});
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('./?mode=inspect&car=07');
 const canvas=page.locator('#world');await page.locator('#visual-dissolve').click();
 await expect(canvas).toHaveAttribute('data-finale','held',{timeout:15000});
 await expect(page.locator('#incense-film-still')).toBeVisible();await expect(page.locator('#incense-film')).toBeHidden();expect(films).toEqual([]);
 const pose=await canvas.getAttribute('data-visual-pose');await page.waitForTimeout(300);await expect(canvas).toHaveAttribute('data-visual-pose',pose);
 await page.locator('#visual-restore').click();await expect(canvas).toHaveAttribute('data-finale','hidden');
});


test('a failed ending film falls back to smoke and can return to another room',async({page})=>{
 await page.route('**/assets/films/incense-ending.mp4',route=>route.abort());
 await page.goto('./?mode=inspect&car=07');
 await page.locator('#visual-dissolve').click();
 await expect(page.locator('#incense-film-layer')).toHaveAttribute('data-stage','fallback');
 await expect(page.locator('#incense-film-layer')).toBeHidden();
 await expect(page.locator('#world')).toHaveAttribute('data-finale','held',{timeout:20000});
 await page.locator('#visual-room').selectOption('06');
 await expect(page.locator('#world')).toHaveAttribute('data-finale','hidden');
 await expect(page.locator('#incense-film')).toHaveJSProperty('paused',true);
});

test('ending film stops immediately when leaving the room mid-playback',async({page})=>{
 await page.goto('./?mode=inspect&car=07');await page.locator('#visual-dissolve').click();
 const video=page.locator('#incense-film');await expect.poll(()=>video.evaluate(v=>v.currentTime)).toBeGreaterThan(.2);
 await expect(video).toHaveJSProperty('muted',true);
 await page.locator('#visual-room').selectOption('06');
 await expect(page.locator('#incense-film-layer')).toBeHidden();await expect(video).toHaveJSProperty('paused',true);
 const time=await video.evaluate(v=>v.currentTime);await page.waitForTimeout(200);expect(await video.evaluate(v=>v.currentTime)).toBe(time);
});

test('the ending film never requests playback with its embedded audio',async({page})=>{
 await page.addInitScript(()=>{
  const play=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(){if(this.id==='incense-film'&&!this.muted)return Promise.reject(new DOMException('Denied','NotAllowedError'));return play.call(this);};
 });
 await page.goto('./?mode=inspect&car=07');await page.locator('#visual-dissolve').click();
 await expect(page.locator('#incense-film')).toHaveJSProperty('muted',true);
 await expect(page.locator('#incense-film-layer')).toHaveAttribute('data-stage','held',{timeout:15000});
});
