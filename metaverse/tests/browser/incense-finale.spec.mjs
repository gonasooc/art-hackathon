import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

test('incense finishes dissolving before smoke letters bloom; preview can pause, restore and replay',async({page})=>{
 test.setTimeout(120000);const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=()=>{throw new Error('Finale preview must not open the camera');};});
 await page.goto('./?mode=inspect&car=07');const canvas=page.locator('#world');
 await expect(canvas).toHaveAttribute('data-finale','hidden');
 await page.locator('#visual-dissolve').click();
 expect(await canvas.evaluate(c=>JSON.parse(c.dataset.objectState).find(t=>t.id==='07-incense').gone||c.dataset.finale==='hidden')).toBe(true);
 await expect(canvas).toHaveAttribute('data-finale','blooming',{timeout:20000});
 expect(await canvas.evaluate(c=>JSON.parse(c.dataset.objectState).find(t=>t.id==='07-incense').gone)).toBe(true);
 await page.locator('#visual-animation').click();
 const time=await canvas.getAttribute('data-finale-time');await page.waitForTimeout(250);await expect(canvas).toHaveAttribute('data-finale-time',time);
 await page.locator('#visual-animation').click();await page.keyboard.press('KeyH');
 await mkdir(new URL('../../.cache/verification/',import.meta.url),{recursive:true});
 await page.screenshot({path:new URL('../../.cache/verification/incense-finale-bloom.png',import.meta.url).pathname});
 await expect(canvas).toHaveAttribute('data-finale','held',{timeout:25000});
 await page.screenshot({path:new URL('../../.cache/verification/incense-finale.png',import.meta.url).pathname});
 await expect(page.locator('body')).toHaveAttribute('data-phase','visual');await expect(page.locator('#ending')).toBeHidden();
 await page.keyboard.press('KeyH');await page.locator('#visual-restore').click();await expect(canvas).toHaveAttribute('data-finale','hidden');
 await page.locator('#visual-dissolve').click();await expect(canvas).toHaveAttribute('data-finale','held',{timeout:30000});
 await page.locator('#visual-room').selectOption('01');await expect(canvas).toHaveAttribute('data-finale','hidden');
 expect(errors).toEqual([]);
});

test('reduced motion gives a stationary final composition and short text fade',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('./?mode=inspect&car=07');
 const canvas=page.locator('#world');await page.locator('#visual-dissolve').click();
 await expect(canvas).toHaveAttribute('data-finale','held',{timeout:15000});
 const pose=await canvas.getAttribute('data-visual-pose');await page.waitForTimeout(300);await expect(canvas).toHaveAttribute('data-visual-pose',pose);
 await page.locator('#visual-restore').click();await expect(canvas).toHaveAttribute('data-finale','hidden');
});
