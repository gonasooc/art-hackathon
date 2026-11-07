import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
for(const car of ['01','06'])test(`leopard ${car} remains reachable and dissolves and restores`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const source=await readFile(new URL('../../src/visual-inspector.js',import.meta.url),'utf8');
 await page.route('**/src/visual-inspector.js',route=>route.fulfill({contentType:'text/javascript',body:source.replace('constructor(world){','constructor(world){window.__leopardWorld=world;')}));
 await page.goto(`./?mode=inspect&car=${car}`);await expect(page.locator('#world')).toHaveAttribute('data-assets','ready');
 const result=await page.evaluate(car=>{
  const w=window.__leopardWorld,t=w.objects.targets.find(t=>t.id===`${car}-leopard`);w.scene.updateMatrixWorld(true);w.camera.updateMatrixWorld();
  const p=t.aim.clone().project(w.camera),hit=w.objects.pick({valid:true,x:(p.x+1)/2,y:(1-p.y)/2},w.camera);
  const started=w.objects.dissolve(t.id);w.objects.update(1.4,false);return {hit,started,gone:t.gone,visible:t.group.visible};
 },car);
 expect(result).toEqual({hit:`${car}-leopard`,started:true,gone:true,visible:false});
 await page.locator('#visual-restore').click();
 expect(await page.evaluate(car=>{const t=window.__leopardWorld.objects.targets.find(t=>t.id===`${car}-leopard`);return !t.gone&&t.group.visible;},car)).toBe(true);
 expect(errors).toEqual([]);
});
