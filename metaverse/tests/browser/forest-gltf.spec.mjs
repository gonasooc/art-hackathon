import {test,expect} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
test('Blender forest loads real nodes with clear passage and working memory targets',async({page})=>{
 test.setTimeout(120000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const source=await readFile(new URL('../../src/visual-inspector.js',import.meta.url),'utf8');
 await page.route('**/src/visual-inspector.js',route=>route.fulfill({contentType:'text/javascript',body:source.replace('constructor(world){','constructor(world){window.__forest=this;')}));
 await page.goto('./?mode=inspect&car=05');await expect(page.locator('#world')).toHaveAttribute('data-assets','ready',{timeout:90000});await expect(page.locator('body')).toHaveAttribute('data-carriage','05',{timeout:90000});
 const report=await page.evaluate(async()=>{
  const T=await import('./vendor/three/three.module.js'),{TRAIN,WORLD}=await import('./src/config.js');
  const w=window.__forest.world,spec=w.extraCarriages.get('05');w.scene.updateMatrixWorld(true);w.camera.updateMatrixWorld();
  const nodes=[];spec.group.traverse(n=>{if(n.isMesh)nodes.push(n.userData.name||n.name);});
  const hits=w.objects.targets.filter(t=>t.car==='05').map(t=>{const p=t.aim.clone().project(w.camera);const hit=w.objects.pick({valid:true,x:(p.x+1)/2,y:(1-p.y)/2},w.camera);const started=w.objects.dissolve(t.id);w.objects.update(1.4,false);return {id:t.id,hit,started,gone:t.gone};});
  const collisions=[];
  for(const lane of [-TRAIN.interiorHalfWidth,0,TRAIN.interiorHalfWidth]){
   const ray=new T.Raycaster(new T.Vector3(TRAIN.interiorStartX-TRAIN.interiorLength,WORLD.eyeHeight+TRAIN.floorY,TRAIN.centerZ+lane),new T.Vector3(-1,0,0),.04,TRAIN.exitLength-TRAIN.interiorLength);
   const hit=ray.intersectObject(spec.group,true)[0];if(hit)collisions.push({lane,name:hit.object.userData.name||hit.object.name,distance:hit.distance});
  }
  return {source:spec.source,model:spec.group.userData.model,nodes:spec.sourceMeshCount,batches:spec.staticBatches,hits,collisions,aims:spec.targets.map(t=>[t.id,t.aim])};
 });
 console.log(JSON.stringify(report));expect(report.model).toBe('forest.glb');expect(report.source.generator).toContain('Blender');expect(report.nodes).toBeGreaterThan(200);
 for(const t of report.hits){expect(t.hit,t.id).toBe(t.id);expect(t.started).toBe(true);expect(t.gone).toBe(true);}
 expect(report.collisions).toEqual([]);
 await page.locator('#visual-restore').click();
 await expect.poll(()=>page.locator('#world').evaluate(c=>JSON.parse(c.dataset.objectState).filter(t=>t.id.startsWith('05-')).every(t=>!t.gone))).toBe(true);
 await page.locator('#visual-tools-toggle').click();await mkdir(new URL('../../.cache/forest-glb/',import.meta.url),{recursive:true});await page.screenshot({path:new URL('../../.cache/forest-glb/restored.png',import.meta.url).pathname});
 expect(errors).toEqual([]);
});


test('automatic demo enters the Blender forest and completes its three memories',async({page})=>{
 test.setTimeout(120000);await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('./');await page.locator('#visual-start').click();
 await expect(page.locator('body')).toHaveAttribute('data-carriage','00',{timeout:60000});
 for(const car of ['01','02','03','04','05']){await page.locator('#demo-next').click();await expect(page.locator('body')).toHaveAttribute('data-carriage',car);}
 await expect(page.locator('body')).toHaveAttribute('data-phase','objects',{timeout:20000});
 await expect.poll(()=>page.locator('#world').evaluate(c=>JSON.parse(c.dataset.objectState).filter(t=>t.id.startsWith('05-')).every(t=>t.gone)),{timeout:45000}).toBe(true);
 await expect(page.locator('body')).toHaveAttribute('data-carriage','06',{timeout:20000});
});

test('forest download is deferred, shared buffers stay bounded, and interrupted selection stays cancelled',async({page})=>{
 test.setTimeout(90000);let requests=0,unblock;const gate=new Promise(resolve=>unblock=resolve);
 await page.route('**/assets/models/forest.glb',async route=>{requests++;await gate;await route.continue();});
 const source=await readFile(new URL('../../src/visual-inspector.js',import.meta.url),'utf8');
 await page.route('**/src/visual-inspector.js',route=>route.fulfill({contentType:'text/javascript',body:source.replace('constructor(world){','constructor(world){window.__forest=this;')}));
 await page.goto('./');await expect(page.locator('#world')).toHaveAttribute('data-assets','ready');expect(requests).toBe(0);
 await page.goto('./?mode=inspect&car=01');await expect(page.locator('body')).toHaveAttribute('data-carriage','01');expect(requests).toBe(0);
 await page.locator('#visual-room').selectOption('05');await expect.poll(()=>requests).toBe(1);
 await page.locator('#visual-room').selectOption('06');await expect(page.locator('body')).toHaveAttribute('data-carriage','06');
 unblock();await expect.poll(()=>page.evaluate(()=>window.__forest.world.isCarReady('05')),{timeout:45000}).toBe(true);
 await expect(page.locator('body')).toHaveAttribute('data-carriage','06');
 await page.locator('#visual-room').selectOption('05');await expect(page.locator('body')).toHaveAttribute('data-carriage','05');expect(requests).toBe(1);
 const metrics=await page.evaluate(()=>{
  const spec=window.__forest.world.extraCarriages.get('05'),geometries=new Set();
  for(const root of [spec.group,...spec.targets.map(t=>t.group)])root.traverse(n=>{if(n.isMesh)geometries.add(n.geometry);});
  let bytes=0;for(const g of geometries)for(const a of [...Object.values(g.attributes),g.index].filter(Boolean))bytes+=(a.array||a.data.array).byteLength;
  return {bytes,instances:spec.instanceCount};
 });
 expect(metrics.bytes).toBeLessThan(30*1024*1024);expect(metrics.instances).toBeGreaterThan(500);
});
