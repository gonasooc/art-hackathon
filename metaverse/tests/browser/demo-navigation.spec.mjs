import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('demo changes rooms, resets interrupted effects, preserves pause and respects boundaries',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>{
    navigator.mediaDevices.getUserMedia=()=>{throw new Error('Demo navigation must not request a camera');};
    const AudioClass=window.Audio;window.__audio=[];
    window.Audio=function(...args){const audio=new AudioClass(...args);window.__audio.push(audio);return audio;};
  });
  const source=await readFile(new URL('../../src/visual-inspector.js',import.meta.url),'utf8');
  await page.route('**/src/visual-inspector.js',route=>route.fulfill({contentType:'text/javascript',body:source.replace('constructor(world){','constructor(world){window.__demoWorld=world;')}));
  await page.goto('./?mode=visual');
  const prev=page.locator('#demo-prev'),next=page.locator('#demo-next'),pause=page.locator('#demo-pause');
  await expect(prev).toBeDisabled();await expect(next).toBeDisabled();
  await expect(page.locator('body')).toHaveAttribute('data-carriage','00',{timeout:30000});
  await pause.click();await expect(prev).toBeDisabled();await expect(next).toBeEnabled();
  await next.click();await expect(page.locator('body')).toHaveAttribute('data-carriage','01');
  await expect(pause).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#world')).toHaveAttribute('data-z','0');
  await page.evaluate(()=>{const objects=window.__demoWorld.objects;objects.dissolve('01-chair');objects.update(.1,false);});
  await next.click();await expect(page.locator('body')).toHaveAttribute('data-carriage','02');
  await prev.click();await expect(page.locator('body')).toHaveAttribute('data-carriage','01');
  expect(await page.evaluate(()=>window.__demoWorld.objects.targets.filter(t=>t.car==='01').map(t=>({id:t.id,gone:t.gone,progress:t.progress,smoke:Boolean(t.smoke),visible:t.group.visible})))).toEqual(['01-leopard','01-chair'].map(id=>({id,gone:false,progress:null,smoke:false,visible:true})));
  for(const id of ['02','03','04','05','06','07']){
    await next.click();await expect(page.locator('body')).toHaveAttribute('data-carriage',id);
    await expect(page.locator('body')).toHaveAttribute('data-phase','walking');
    await expect(pause).toHaveAttribute('aria-pressed','true');
  }
  await expect(next).toBeDisabled();await expect(prev).toBeEnabled();
  await pause.click();await expect(page.locator('body')).toHaveAttribute('data-phase','finale',{timeout:20000});
  await pause.click();
  await prev.click();await expect(page.locator('body')).toHaveAttribute('data-carriage','06');
  await expect(page.locator('#world')).toHaveAttribute('data-finale','hidden');
  await expect(page.locator('#world')).toHaveAttribute('data-train-moving','true');
  await pause.click();await expect(pause).toHaveAttribute('aria-pressed','false');
  await expect.poll(()=>page.locator('#world').getAttribute('data-z')).not.toBe('0');
  await expect.poll(()=>page.evaluate(()=>window.__audio.some(a=>a.src.endsWith('/death-hospital.mp3')&&!a.paused))).toBe(true);
  await next.click();await expect(page.locator('body')).toHaveAttribute('data-carriage','07');
  await expect.poll(()=>page.evaluate(()=>window.__audio.find(a=>a.src.endsWith('/death-hospital.mp3')).paused)).toBe(true);
  await expect(page.locator('#setup')).toBeHidden();expect(errors).toEqual([]);
});
