import {test,expect} from '@playwright/test';

test('new carriage aisles remain clear across the full walking width after memories disappear',async({page})=>{
  await page.goto('./?mode=inspect&car=02');
  await expect(page.locator('body')).toHaveAttribute('data-phase','visual');
  const hits=await page.evaluate(async()=>{
    const T=await import('./vendor/three/three.module.js');
    const {TRAIN,WORLD}=await import('./src/config.js');
    const specs=[
      ['home',(await import('./src/carriages/childhood-home.js')).buildChildhoodHomeCarriage],
      ['playground',(await import('./src/carriages/playground.js')).buildPlaygroundCarriage],
      ['cafe',(await import('./src/carriages/cafe.js')).buildCafeCarriage],
    ];
    const collisions=[];
    for(const [name,build] of specs){
      // Targets vanish before this exit walk. Retained architecture must not cover
      // the camera, even for a passenger at either lateral navigation boundary.
      const {group}=build();group.updateMatrixWorld(true);
      for(const lane of [-TRAIN.interiorHalfWidth,0,TRAIN.interiorHalfWidth]){
        const ray=new T.Raycaster(new T.Vector3(TRAIN.interiorStartX-TRAIN.interiorLength,WORLD.eyeHeight+TRAIN.floorY,TRAIN.centerZ+lane),new T.Vector3(-1,0,0),.04,TRAIN.exitLength-TRAIN.interiorLength);
        const hit=ray.intersectObject(group,true)[0];
        if(hit)collisions.push({name,lane,distance:hit.distance});
      }
    }
    return collisions;
  });
  expect(hits).toEqual([]);
});
