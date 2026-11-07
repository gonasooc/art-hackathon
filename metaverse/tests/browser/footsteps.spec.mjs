import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{
  const OriginalAudio=window.Audio;
  window.Audio=function(...args){const audio=new OriginalAudio(...args);if(String(args[0]).endsWith('/footsteps.wav'))window.__footsteps=audio;return audio;};
 });
});
const audible=page=>page.evaluate(()=>!window.__footsteps.paused&&window.__footsteps.volume>0);

test('inspection footsteps follow horizontal translation and stop on release or exit',async({page})=>{
 await page.goto('./?mode=inspect&car=04');
 await expect(page.locator('#world')).toHaveAttribute('data-assets','ready');
 expect(await audible(page)).toBe(false);
 await page.locator('#world').focus();await page.keyboard.down('KeyW');
 await expect.poll(()=>audible(page)).toBe(true);
 expect(await page.evaluate(()=>window.__footsteps.volume)).toBeLessThanOrEqual(.18);
 await page.keyboard.up('KeyW');await expect.poll(()=>audible(page)).toBe(false);
 await page.keyboard.down('KeyE');await page.waitForTimeout(150);expect(await audible(page)).toBe(false);await page.keyboard.up('KeyE');
 await page.keyboard.down('KeyD');await expect.poll(()=>audible(page)).toBe(true);await page.keyboard.up('KeyD');
 await page.locator('#leave').click();await expect.poll(()=>audible(page)).toBe(false);
});

test('automatic demonstration has footsteps only while walking and respects pause',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('./');await page.locator('#visual-start').click();
 await expect(page.locator('body')).toHaveAttribute('data-phase','prologue');expect(await audible(page)).toBe(false);
 await expect(page.locator('body')).toHaveAttribute('data-phase','walking');
 await expect.poll(()=>audible(page)).toBe(true);
 await page.locator('#demo-pause').click();await expect.poll(()=>audible(page)).toBe(false);
 await page.locator('#demo-pause').click();await expect.poll(()=>audible(page)).toBe(true);
 await page.locator('#leave').click();await expect.poll(()=>audible(page)).toBe(false);
});
