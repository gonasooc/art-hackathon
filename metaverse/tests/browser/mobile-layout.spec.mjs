import {test,expect} from '@playwright/test';
test.use({hasTouch:true});
for(const size of [{width:360,height:740},{width:844,height:390}])test(`mobile presentation fits ${size.width}x${size.height}`,async({page})=>{
 await page.setViewportSize(size);await page.goto('./');
 await expect(page.locator('.mobile-view-note')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('#visual-start').tap();await expect(page.locator('#demo-pause')).toBeEnabled({timeout:30000});
 const controls=page.locator('.experience-controls');await expect(controls).toHaveCSS('opacity','1');
 const buttons=await controls.locator('button:visible').evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}));
 for(const r of buttons){expect(r.x).toBeGreaterThanOrEqual(0);expect(r.y).toBeGreaterThanOrEqual(0);expect(r.x+r.width).toBeLessThanOrEqual(size.width);expect(r.y+r.height).toBeLessThanOrEqual(size.height);expect(r.height).toBeGreaterThanOrEqual(44);}
 for(let i=0;i<buttons.length;i++)for(let j=i+1;j<buttons.length;j++){const a=buttons[i],b=buttons[j];expect(a.x+a.width<=b.x+1||b.x+b.width<=a.x+1||a.y+a.height<=b.y+1||b.y+b.height<=a.y+1).toBe(true);}
 await page.locator('#demo-pause').tap();await expect(page.locator('#demo-pause')).toHaveAttribute('aria-pressed','true');
 await page.locator('#leave').tap();await expect(page.locator('body')).toHaveAttribute('data-phase','idle');
});
