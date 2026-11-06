import {test,expect} from '@playwright/test';
import {simulatedEyes,startAndWalk,gazeAt} from './support.mjs';
import {mkdir} from 'node:fs/promises';
test('womb passes without objects; all seven subsequent carriages respond to gaze and blink',async({page})=>{
 test.setTimeout(480000);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&m.text().includes('THREE.WebGLProgram'))errors.push(m.text());});
 await simulatedEyes(page);await startAndWalk(page,.5);
 await expect(page.locator('#object-hint')).toHaveCount(0);
 expect(await page.locator('#world').evaluate(c=>JSON.parse(c.dataset.objectState).some(t=>t.id.startsWith('00-')))).toBe(false);
 await mkdir(new URL('../../.cache/verification/',import.meta.url),{recursive:true});
 const rooms=[
  ['01',[['01-chair',[-8.48,1.89,-8.75]],['01-leopard',[-9,1.65,-7.35]]]],
  ['02',[['02-mural',[-10.18,3.2,-6.92]],['02-ceiling-light',[-10.1,3.37,-7.42]],['02-shelf',[-9.84,1.65,-6.93]]]],
  ['03',[['03-slide',[-9.1,1.77,-6.88]],['03-swing',[-10.2,2.93,-9.14]]]],
  ['04',[['04-teacups',[-8.6,2.19,-7.56]],['04-chairs',[-8.6,1.95,-6.45]],['04-table',[-8.6,1.99,-7.9]]]],
  ['05',[['05-moss',[-8.08,1.77,-6.54]],['05-snow',[-8.7,1.62,-9.26]],['05-tree',[-10.6,2.47,-6.5]]]],
  ['06',[['06-leopard',[-8.6,1.67,-8.95]],['06-shroud',[-9.27,1.58,-7.35]],['06-halo',[-8.837,3.159,-7.25]]]],
  ['07',[['07-incense',[-8.704,1.91,-7.9]]]],
 ];
 for(const [car,targets] of rooms){
  await expect(page.locator('body')).toHaveAttribute('data-carriage',car,{timeout:40000});
  await expect(page.locator('body')).toHaveAttribute('data-phase','objects',{timeout:30000});
  await page.screenshot({path:new URL(`../../.cache/verification/carriage-${car}.png`,import.meta.url).pathname});
  for(const [id,aim] of targets)await gazeAt(page,aim,id);
  // The accelerated gaze can already reach the exit while the last disappearance
  // assertion returns. The next carriage (or ending) is the durable outcome.
  await page.evaluate(()=>window.__eyes={x:.5,y:.5});
 }
 await expect(page.locator('body')).toHaveAttribute('data-phase','finale',{timeout:20000});
 await expect(page.locator('#world')).toHaveAttribute('data-finale','held',{timeout:25000});
 await expect(page.locator('#ending')).toBeHidden();await expect(page.locator('#finale-controls')).toBeVisible();
 await page.getByRole('button',{name:'처음으로',exact:true}).click();
 await expect(page.locator('body')).toHaveAttribute('data-phase','idle');await expect(page.locator('#world')).toHaveAttribute('data-finale','hidden');
 expect(await page.locator('#prologue-video').evaluate(video=>video.paused)).toBe(true);expect(errors).toEqual([]);
});
