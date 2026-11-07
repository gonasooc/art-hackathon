import {test,expect} from '@playwright/test';

test('demo controls reveal near the toolbar, hide after mouse use, and support keyboard focus',async({page})=>{
  await page.goto('./?mode=visual');
  const controls=page.locator('.experience-controls');
  await expect(page.locator('body')).toHaveAttribute('data-mode','demo');
  await expect(page.locator('#world')).toHaveAttribute('data-assets','ready');
  await page.mouse.move(20,400);
  await expect(controls).toHaveCSS('opacity','0');
  const box=await controls.boundingBox();
  await page.mouse.move(box.x-12,box.y+box.height/2);
  await expect(controls).toHaveCSS('opacity','1');
  await page.locator('#demo-pause').click();
  await expect(page.locator('#demo-pause')).toHaveAttribute('aria-pressed','true');
  await page.mouse.move(20,400);
  await expect(controls).toHaveCSS('opacity','0');
  await page.keyboard.press('Tab');
  await expect(page.locator('#demo-restart')).toBeFocused();
  await expect(controls).toHaveCSS('opacity','1');
  await page.getByRole('button',{name:'시연 종료'}).click();
  await expect(page.locator('body')).toHaveAttribute('data-phase','idle');
});

test.describe('touch controls',()=>{
  test.use({hasTouch:true,viewport:{width:390,height:844}});
  test('remain visible without hover',async({page})=>{
    await page.goto('./?mode=visual');
    await expect(page.locator('body')).toHaveAttribute('data-mode','demo');
    await expect(page.locator('.experience-controls')).toHaveCSS('opacity','1');
    await page.locator('#demo-pause').tap();
    await expect(page.locator('#demo-pause')).toHaveAttribute('aria-pressed','true');
  });
});

test('fullscreen toggles the entire presentation and follows browser exit',async({page})=>{
  await page.goto('./?mode=visual');
  const button=page.locator('#demo-fullscreen');
  await button.click();
  await expect.poll(()=>page.evaluate(()=>document.fullscreenElement===document.documentElement)).toBe(true);
  await expect(button).toHaveText('전체화면 해제');
  await expect(button).toHaveAttribute('aria-pressed','true');
  await button.click();
  await expect.poll(()=>page.evaluate(()=>document.fullscreenElement===null)).toBe(true);
  await expect(button).toHaveText('전체화면');
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed','true');
  await page.evaluate(()=>document.exitFullscreen());
  await expect(button).toHaveText('전체화면');
  await expect(button).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('body')).toHaveAttribute('data-mode','demo');
});

test('a rejected fullscreen request leaves playback controls usable',async({page})=>{
  await page.addInitScript(()=>{Element.prototype.requestFullscreen=()=>Promise.reject(new DOMException('Denied','NotAllowedError'));});
  await page.goto('./?mode=visual');
  await page.locator('#demo-fullscreen').click();
  await expect(page.locator('#fullscreen-status')).toContainText('다시 시도');
  await expect(page.locator('#demo-fullscreen')).toBeEnabled();
  await expect(page.locator('#demo-fullscreen')).toHaveAttribute('aria-pressed','false');
  await page.locator('#demo-pause').click();
  await expect(page.locator('#demo-pause')).toHaveAttribute('aria-pressed','true');
});
