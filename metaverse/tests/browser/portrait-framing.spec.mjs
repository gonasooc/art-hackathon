import {test,expect} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
test.use({viewport:{width:390,height:844},hasTouch:true});
test('portrait observation fits main objects and keeps gaze targets reachable',async({page})=>{
 test.setTimeout(120000);
 const source=await readFile(new URL('../../src/visual-inspector.js',import.meta.url),'utf8');
 await page.route('**/src/visual-inspector.js',route=>route.fulfill({contentType:'text/javascript',body:source.replace('constructor(world){','constructor(world){window.__portrait=this;')}));
 await page.goto('./?mode=inspect&car=01');await expect(page.locator('#world')).toHaveAttribute('data-assets','ready');
 for(const car of ['01','02','03','04','05','06']){
  await page.locator('#visual-room').selectOption(car);
  await expect(page.locator('body')).toHaveAttribute('data-carriage',car,{timeout:45000});
  const result=await page.evaluate(async car=>{
   const T=await import('./vendor/three/three.module.js');const w=window.__portrait.world;
   w.scene.updateMatrixWorld(true);w.camera.updateMatrixWorld();const results=[];
   for(const t of w.objects.targets.filter(t=>t.car===car)){
    const b=new T.Box3().setFromObject(t.group),points=[];
    for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){const p=new T.Vector3(x,y,z).project(w.camera);points.push([p.x,p.y]);}
    const p=t.aim.clone().project(w.camera);results.push({id:t.id,points,hit:w.objects.pick({valid:true,x:(p.x+1)/2,y:(1-p.y)/2},w.camera)});
   }return results;
  },car);
  for(const t of result){for(const [x,y]of t.points){expect(Math.abs(x),t.id).toBeLessThan(1);expect(Math.abs(y),t.id).toBeLessThan(1);}}
  if(car==='01'||car==='04'||car==='06')expect(result[0].hit).toBe(result[0].id);
 }
 await page.locator('#visual-room').selectOption('04');
 await page.locator('#visual-tools-toggle').click();
 await mkdir(new URL('../../.cache/mobile/',import.meta.url),{recursive:true});
 await page.screenshot({path:new URL('../../.cache/mobile/portrait-cafe.png',import.meta.url).pathname});
 await page.setViewportSize({width:844,height:390});
 await expect.poll(()=>page.evaluate(()=>window.__portrait.world.camera.fov)).toBe(48);
});

test('portrait automatic demo frames cafe and remains operable after rotation',async({page})=>{
 test.setTimeout(90000);await page.emulateMedia({reducedMotion:'reduce'});
 const source=await readFile(new URL('../../src/visual-inspector.js',import.meta.url),'utf8');
 await page.route('**/src/visual-inspector.js',route=>route.fulfill({contentType:'text/javascript',body:source.replace('constructor(world){','constructor(world){window.__portrait=this;')}));
 await page.goto('./');await page.locator('#visual-start').tap();await page.locator('#mobile-controls-toggle').tap();
 await expect(page.locator('body')).toHaveAttribute('data-carriage','00',{timeout:30000});
 for(const id of ['01','02','03','04']){await page.locator('#demo-next').tap();await expect(page.locator('body')).toHaveAttribute('data-carriage',id);}
 await page.locator('#mobile-controls-toggle').tap();
 await expect(page.locator('body')).toHaveAttribute('data-phase','objects',{timeout:20000});
 expect(await page.evaluate(()=>window.__portrait.world.camera.fov)).toBeGreaterThan(48);
 await page.locator('#mobile-controls-toggle').tap();await page.locator('#demo-pause').tap();
 await expect(page.locator('#demo-pause')).toHaveAttribute('aria-pressed','true');
 await page.setViewportSize({width:844,height:390});
 await expect.poll(()=>page.evaluate(()=>window.__portrait.world.camera.fov)).toBe(48);
 await expect(page.locator('#demo-pause')).toHaveAttribute('aria-pressed','true');
 await page.locator('#leave').tap();await expect(page.locator('body')).toHaveAttribute('data-phase','idle');
});
