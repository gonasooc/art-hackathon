import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { simulatedEyes, startAndWalk } from './support.mjs';

test('particle center marks a fresh model estimate, ignores mouse input, and disappears on loss', async ({ page }) => {
  await simulatedEyes(page, { speed: .9 });
  await page.goto('./');
  const marker = page.locator('#gaze-particles');
  await expect(marker).toBeHidden();
  await page.evaluate(() => { window.__eyes = { x: .74, y: .48 }; });
  await page.getByRole('button', { name: '소리와 함께 시작' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'calibrating');
  await expect(marker).toBeHidden();
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'validating');
  await expect(marker).toBeHidden();
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'walking');
  await expect(marker).toHaveAttribute('data-tracking', 'live');
  const point = await marker.evaluate(canvas => {
    const box = canvas.getBoundingClientRect();
    return { x: Number(canvas.dataset.x), y: Number(canvas.dataset.y), centerX: box.x + box.width / 2,
      centerY: box.y + box.height / 2, width: innerWidth, height: innerHeight, pointerEvents: getComputedStyle(canvas).pointerEvents };
  });
  expect(point.x).toBeGreaterThan(.68);
  expect(point.x).toBeLessThan(.8);
  expect(Math.abs(point.centerX - point.x * point.width)).toBeLessThan(.1);
  expect(Math.abs(point.centerY - point.y * point.height)).toBeLessThan(.1);
  expect(point.pointerEvents).toBe('none');
  await page.mouse.move(10, 10);
  await expect.poll(async () => parseFloat(await marker.getAttribute('data-x'))).toBeGreaterThan(.68);
  await mkdir(new URL('../../.cache/verification/', import.meta.url), { recursive: true });
  await page.screenshot({ path: new URL('../../.cache/verification/gaze-particles.png', import.meta.url).pathname });
  const clip = await marker.boundingBox();
  await page.screenshot({ clip, path: new URL('../../.cache/verification/gaze-particles-detail.png', import.meta.url).pathname });
  await page.evaluate(() => { window.__eyes = { x: .25, y: .7 }; });
  await expect.poll(async () => parseFloat(await marker.getAttribute('data-x'))).toBeLessThan(.32);
  await expect.poll(async () => parseFloat(await marker.getAttribute('data-y'))).toBeGreaterThan(.62);
  await page.getByRole('button', { name: '시선 표시 끄기', exact: true }).click();
  await expect(marker).toBeHidden();
  await page.getByRole('button', { name: '시선 표시 켜기', exact: true }).click();
  await expect(marker).toBeVisible();
  await page.evaluate(() => { window.__eyes = { invalid: 'blink' }; });
  await expect(marker).toBeHidden();
  expect(await marker.getAttribute('data-x')).toBeNull();
  await page.evaluate(() => { window.__eyes = { x: .65, y: .4 }; });
  await expect(marker).toHaveAttribute('data-tracking', 'live');
  await page.evaluate(() => { window.__eyes = { noUpdates: true }; });
  await expect(marker).toBeHidden();
  expect(await marker.getAttribute('data-x')).toBeNull();
  await page.evaluate(() => { window.__eyes = { x: .65, y: .4 }; });
  await expect(marker).toHaveAttribute('data-tracking', 'live');
  await page.getByRole('button', { name: '체험 종료' }).click();
  await expect(marker).toBeHidden();
});

test('reduced motion keeps the particle shape static while the exact point still follows gaze', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await simulatedEyes(page, { speed: .9 });
  await startAndWalk(page, .65);
  const marker = page.locator('#gaze-particles');
  await expect(marker).toHaveAttribute('data-tracking', 'live');
  const shape=()=>marker.evaluate(canvas=>{
    if(canvas.dataset.tracking!=='live')return null;
    const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    let hash=2166136261;for(const value of pixels)hash=Math.imul(hash^value,16777619);
    return hash>>>0;
  });
  let before=null;
  await expect.poll(async()=>{before=await shape();return before;}).not.toBeNull();
  await page.waitForTimeout(300);
  await expect.poll(shape).toBe(before);
  await page.evaluate(() => { window.__eyes = { x: .3, y: .65 }; });
  await expect.poll(async () => parseFloat(await marker.getAttribute('data-x'))).toBeLessThan(.36);
  await expect.poll(shape).toBe(before);
  await page.evaluate(() => { window.__eyes = { invalid: 'face' }; });
  await expect(marker).toBeHidden();
});
