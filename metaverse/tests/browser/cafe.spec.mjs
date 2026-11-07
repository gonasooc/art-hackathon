import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('cafe furniture remains reachable by gaze and dissolves in presentation order',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const source=await readFile(new URL('../../src/visual-inspector.js',import.meta.url),'utf8');
  await page.route('**/src/visual-inspector.js',route=>route.fulfill({contentType:'text/javascript',body:source.replace('constructor(world){','constructor(world){window.__cafeInspector=this;')}));
  await page.goto('./?mode=inspect&car=04');
  await expect(page.locator('#world')).toHaveAttribute('data-assets','ready');
  const result=await page.evaluate(()=>{
    const {world}=window.__cafeInspector,objects=world.objects,camera=world.camera;
    camera.position.set(-5.45,2.67,-7.9);camera.lookAt(-9,2,-7.9);camera.updateMatrixWorld();world.scene.updateMatrixWorld(true);
    return objects.targets.filter(t=>t.car==='04').map(target=>{
      const projected=target.aim.clone().project(camera),gaze={valid:true,x:(projected.x+1)/2,y:(1-projected.y)/2};
      const hit=objects.pick(gaze,camera),started=objects.dissolve(target.id);objects.update(3,false);
      return {id:target.id,hit,started,gone:target.gone,visible:target.group.visible,gaze};
    });
  });
  expect(result.map(t=>t.id)).toEqual(['04-teacups','04-chairs','04-table']);
  for(const target of result){
    expect(target.hit).toBe(target.id);expect(target.started).toBe(true);expect(target.gone).toBe(true);expect(target.visible).toBe(false);
    expect(target.gaze.x).toBeGreaterThan(0);expect(target.gaze.x).toBeLessThan(1);expect(target.gaze.y).toBeGreaterThan(0);expect(target.gaze.y).toBeLessThan(1);
  }
  await page.locator('#visual-restore').click();
  expect(await page.locator('#world').evaluate(c=>JSON.parse(c.dataset.objectState).filter(t=>t.id.startsWith('04-')).every(t=>!t.gone))).toBe(true);
  expect(errors).toEqual([]);
});
