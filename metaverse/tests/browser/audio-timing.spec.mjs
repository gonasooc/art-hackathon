import {test,expect} from '@playwright/test';

test('horn precedes boarding and fades in 00; playground waits for the first vanished object',async({page})=>{
 test.setTimeout(90000);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.addInitScript(()=>{
  const OriginalAudio=window.Audio;window.__sounds={};window.__hornHistory=[];
  window.Audio=function(src){const audio=new OriginalAudio(src);window.__sounds[String(src).split('/').at(-1)]=audio;return audio;};
  const sample=()=>{const a=window.__sounds['train-horn.mp3'],world=document.querySelector('#world');if(a&&world&&window.__hornHistory.length<3000)window.__hornHistory.push({phase:document.body.dataset.phase,stage:document.body.dataset.journeyStage,car:document.body.dataset.carriage,z:Number(world.dataset.z),volume:a.volume,paused:a.paused,muted:a.muted});requestAnimationFrame(sample);};requestAnimationFrame(sample);
 });
 await page.goto('./');await page.locator('#visual-start').click();
 await expect(page.locator('body')).toHaveAttribute('data-carriage','01',{timeout:35000});
 const history=await page.evaluate(()=>window.__hornHistory);
 expect(history.some(s=>s.stage==='platform'&&s.phase==='walking'&&!s.paused&&!s.muted&&s.z>=9.8)).toBe(true);
 expect(history.some(s=>s.car==='00'&&s.volume>0&&s.volume<.95&&!s.paused)).toBe(true);
 expect(history.some(s=>s.car==='00'&&s.z>=9.72&&s.volume===0&&s.paused)).toBe(true);
 await page.locator('#demo-next').click();await page.locator('#demo-next').click();await page.locator('#demo-pause').click();
 await expect(page.locator('body')).toHaveAttribute('data-carriage','03');
 expect(await page.evaluate(()=>window.__sounds['playground.wav'].paused)).toBe(true);
 await page.locator('#demo-pause').click();
 await expect.poll(()=>page.locator('#world').evaluate(c=>JSON.parse(c.dataset.objectState).some(t=>t.id.startsWith('03-')&&t.gone)),{timeout:25000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>window.__sounds['playground.wav'].paused)).toBe(false);
 await page.locator('#demo-pause').click();await expect.poll(()=>page.evaluate(()=>window.__sounds['playground.wav'].paused)).toBe(true);
 await page.locator('#demo-pause').click();await expect.poll(()=>page.evaluate(()=>window.__sounds['playground.wav'].paused)).toBe(false);
 await page.locator('#demo-next').click();await expect(page.locator('body')).toHaveAttribute('data-carriage','04');
 await expect.poll(()=>page.evaluate(()=>window.__sounds['playground.wav'].paused)).toBe(true);
});
