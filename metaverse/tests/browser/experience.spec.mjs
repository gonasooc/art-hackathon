import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { simulatedEyes, startAndWalk } from './support.mjs';

test('real WebGL entry renders at the Pages subpath without external requests or errors',async({page})=>{
  const errors=[],external=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(!request.url().startsWith('http://127.0.0.1:4193/')&&!request.url().startsWith('data:'))external.push(request.url());});
  await page.goto('./');await expect(page.locator('#world')).toBeVisible();
  await expect(page.locator('#world')).toHaveAttribute('data-assets','ready');
  await expect(page.getByRole('heading',{name:'시선이 데려가는 곳.'})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.querySelector('#world').width)).toBeGreaterThan(0);
  await mkdir(new URL('../../.cache/verification/',import.meta.url),{recursive:true});
  await page.screenshot({path:new URL('../../.cache/verification/intro.png',import.meta.url).pathname});
  expect(errors).toEqual([]);expect(external).toEqual([]);
});

test('real pinned MediaPipe worker loads and extracts eyes from a public face fixture',async({page})=>{
  const external=[];page.on('request',request=>{if(!request.url().startsWith('http://127.0.0.1:4193/')&&!request.url().startsWith('data:'))external.push(request.url());});
  await page.goto('./');
  const fixture=new URL('../../.cache/fixtures/portrait.jpg',import.meta.url);
  let bytes;
  try {bytes=await readFile(fixture);}
  catch {
    const response=await fetch('https://storage.googleapis.com/mediapipe-assets/portrait.jpg');
    if(!response.ok)throw new Error(`Official face fixture download failed: ${response.status}`);
    bytes=Buffer.from(await response.arrayBuffer());
    await mkdir(new URL('./',fixture),{recursive:true});await writeFile(fixture,bytes);
  }
  const results=await page.evaluate(async base64=>{
    const blob=await (await fetch(`data:image/jpeg;base64,${base64}`)).blob();
    const worker=new Worker(new URL('./src/vision-worker.js',location.href));
    return await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{worker.terminate();reject(new Error('Real worker timed out'));},30000);
      let delegate,frames=[];
      worker.onerror=event=>{clearTimeout(timer);worker.terminate();reject(new Error(event.message));};
      const frame=async()=>{const bitmap=await createImageBitmap(blob);worker.postMessage({type:'frame',bitmap,time:performance.now()},[bitmap]);};
      worker.onmessage=async({data})=>{
        if(data.type==='error'){clearTimeout(timer);worker.terminate();reject(new Error(data.message));}
        else if(data.type==='ready'){delegate=data.delegate;await frame();}
        else if(data.type==='sample'){
          frames.push(data);
          if(frames.length<3)await frame();else{clearTimeout(timer);worker.terminate();resolve({delegate,frames});}
        }
      };
      worker.postMessage({type:'init'});
    });
  },bytes.toString('base64'));
  expect(['GPU','CPU']).toContain(results.delegate);
  expect(results.frames.some(frame=>frame.valid)).toBe(true);
  expect(results.frames.at(-1).features).toHaveLength(2);
  expect(external).toEqual([]);
});

test('actual camera pipeline blocks entry when no face is present',async({page})=>{
  await page.addInitScript(()=>{
    const getUserMedia=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia=async constraints=>{const stream=await getUserMedia(constraints);window.__cameraStream=stream;return stream;};
  });
  await page.goto('./');await page.getByRole('button',{name:'소리와 함께 시작'}).click();
  await expect(page.locator('body')).toHaveAttribute('data-phase','calibrating',{timeout:45000});
  await expect(page.locator('#tracking-status')).toContainText('얼굴');
  await expect(page.locator('body')).toHaveAttribute('data-validation','pending');
  await page.getByRole('button',{name:'체험 종료'}).click();await expect(page.locator('body')).toHaveAttribute('data-phase','idle');
  expect(await page.evaluate(()=>window.__cameraStream.getTracks().every(track=>track.readyState==='ended'))).toBe(true);
});

for(const [direction,approach] of [[.1,'left'],[.9,'right']]){
  test(`calibration gate, ${approach} gaze approach, boarding car 00, video and ending work together`,async({page})=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await simulatedEyes(page);await startAndWalk(page,direction);
    const stopsBeforeArrival=await page.evaluate(()=>window.__trackerStops);
    await expect(page.locator('body')).toHaveAttribute('data-validation','passed');
    await expect(page.locator('body')).toHaveAttribute('data-journey-stage','platform');
    await expect(page.locator('#world')).toHaveAttribute('data-train-moving','false');
    await page.screenshot({path:new URL(`../../.cache/verification/train-platform-${approach}.png`,import.meta.url).pathname});
    await expect(page.locator('body')).toHaveAttribute('data-phase','boarding',{timeout:20000});
    await expect(page.locator('#world')).toHaveAttribute('data-train-moving','true');
    await expect(page.locator('body')).toHaveAttribute('data-carriage','00');
    await page.screenshot({path:new URL(`../../.cache/verification/car-00-${approach}.png`,import.meta.url).pathname});
    await expect(page.locator('body')).toHaveAttribute('data-phase','playing',{timeout:20000});
    await expect(page.locator('body')).toHaveAttribute('data-destination','00');
    await expect(page.locator('#gaze-particles')).toBeVisible();
    expect(await page.evaluate(()=>window.__trackerStops)).toBe(stopsBeforeArrival);
    const playback=await page.locator('#film').evaluate(video=>({muted:video.muted,volume:video.volume,paused:video.paused,src:video.currentSrc}));
    expect(playback.muted).toBe(false);expect(playback.volume).toBeGreaterThan(0);expect(playback.paused).toBe(false);
    expect(playback.src).toContain('resonance.mp4');
    await expect.poll(()=>page.locator('#film').evaluate(video=>video.currentTime)).toBeGreaterThan(.2);
    const position=await page.locator('#world').getAttribute('data-z');
    await page.evaluate(()=>{window.__eyes={x:0,y:0};});
    await page.waitForTimeout(200);expect(await page.locator('#world').getAttribute('data-z')).toBe(position);
    await page.screenshot({path:new URL(`../../.cache/verification/car-00-film-${approach}.png`,import.meta.url).pathname});
    // Observe a real natural end on one path; verify seeking/range support on the other.
    if(approach==='right')await page.locator('#film').evaluate(video=>{video.currentTime=video.duration-.3;});
    await expect(page.locator('body')).toHaveAttribute('data-phase','ended',{timeout:18000});
    await expect(page.locator('#gaze-particles')).toBeHidden();
    expect(await page.evaluate(()=>window.__trackerStops)).toBeGreaterThan(stopsBeforeArrival);
    await expect(page.getByRole('button',{name:'다시 탑승하기'})).toBeVisible();expect(errors).toEqual([]);
    await page.getByRole('button',{name:'다시 탑승하기'}).click();
    await expect(page.locator('body')).toHaveAttribute('data-phase','calibrating');
    await expect(page.locator('#world')).toHaveAttribute('data-train-moving','false');
  });
}

test('failed independent validation cannot enter the world',async({page})=>{
  await simulatedEyes(page,{wrongValidation:true});await page.goto('./');
  await page.getByRole('button',{name:'소리와 함께 시작'}).click();
  await expect(page.locator('body')).toHaveAttribute('data-phase','calibration-failed');
  await expect(page.locator('body')).toHaveAttribute('data-validation','failed');
  await expect(page.getByRole('button',{name:'다시 맞추기',exact:true})).toBeVisible();
});

test('the train keeps moving while an untracked passenger stays still inside car 00',async({page})=>{
  await simulatedEyes(page,{speed:5});await startAndWalk(page,.5);
  await expect(page.locator('body')).toHaveAttribute('data-carriage','00',{timeout:20000});
  await page.evaluate(()=>{window.__eyes={invalid:'blink'};});await page.waitForTimeout(350);
  const before=await page.locator('#world').evaluate(canvas=>({z:canvas.dataset.z,scenery:Number(canvas.dataset.sceneryDistance)}));
  await page.waitForTimeout(350);
  const after=await page.locator('#world').evaluate(canvas=>({z:canvas.dataset.z,scenery:Number(canvas.dataset.sceneryDistance)}));
  expect(after.z).toBe(before.z);expect(after.scenery).toBeGreaterThan(before.scenery);
  await expect(page.locator('#world')).toHaveAttribute('data-train-moving','true');
  await expect(page.locator('body')).toHaveAttribute('data-carriage','00');
});

test('resizing during boarding requires calibration and restart returns to the stopped train',async({page})=>{
  await simulatedEyes(page,{speed:5});await startAndWalk(page,.5);
  await expect(page.locator('body')).toHaveAttribute('data-phase','boarding',{timeout:25000});
  await page.setViewportSize({width:1280,height:800});
  await expect(page.locator('body')).toHaveAttribute('data-phase','resize-required');
  await expect(page.locator('#boarding-veil')).toBeHidden();
  await page.getByRole('button',{name:'다시 맞추기',exact:true}).click();
  await expect(page.locator('body')).toHaveAttribute('data-phase','calibrating');
  await expect(page.locator('#world')).toHaveAttribute('data-train-moving','false');
  await expect(page.locator('body')).toHaveAttribute('data-carriage','');
});

test('one noisy validation target is remeasured without repeating calibration',async({page})=>{
  await simulatedEyes(page,{validationOutlier:'once'});
  await page.goto('./');
  await page.evaluate(()=>{
    window.__trainingVisits=[];
    new MutationObserver(()=>{
      if(document.body.dataset.phase==='calibrating')window.__trainingVisits.push(document.getElementById('target').dataset.index);
    }).observe(document.getElementById('target'),{attributes:true,attributeFilter:['data-index']});
  });
  await page.getByRole('button',{name:'소리와 함께 시작'}).click();
  await expect(page.locator('body')).toHaveAttribute('data-validation','retrying');
  await expect(page.locator('#setup-title')).toHaveText('이 점만 다시 확인할게요');
  await expect(page.locator('#target')).toHaveAttribute('data-index','0');
  await expect(page.locator('body')).toHaveAttribute('data-validation-attempt','2');
  await expect(page.locator('body')).toHaveAttribute('data-phase','walking');
  await expect(page.locator('body')).toHaveAttribute('data-validation','passed');
  expect(await page.evaluate(()=>window.__trainingVisits)).toEqual(['0','1','2','3','4','5','6','7','8']);
});

test('a persistent validation outlier still blocks entry after one recheck',async({page})=>{
  await simulatedEyes(page,{validationOutlier:'always'});
  await page.goto('./');await page.getByRole('button',{name:'소리와 함께 시작'}).click();
  await expect(page.locator('body')).toHaveAttribute('data-validation','retrying');
  await expect(page.locator('body')).toHaveAttribute('data-phase','calibration-failed');
  await expect(page.locator('body')).toHaveAttribute('data-validation-attempt','2');
  await expect(page.locator('#message-copy')).toContainText('표시된 점과 많이 달랐어요');
  await page.waitForTimeout(250);await expect(page.locator('body')).toHaveAttribute('data-phase','calibration-failed');
});

test('long eye closure stops travel and a resumed valid gaze continues; resize requires fresh calibration',async({page})=>{
  await simulatedEyes(page,{speed:.9});await startAndWalk(page,.5);
  await page.getByRole('button',{name:'흔들림 끄기',exact:true}).click();
  await expect(page.getByRole('button',{name:'흔들림 켜기',exact:true})).toHaveAttribute('aria-pressed','false');
  await page.evaluate(()=>{window.__eyes={invalid:'blink'};});await page.waitForTimeout(350);
  const stopped=await page.locator('#world').getAttribute('data-z');
  await page.keyboard.press('ArrowRight');await page.keyboard.press('w');await page.mouse.move(1400,100);
  await page.waitForTimeout(250);expect(await page.locator('#world').getAttribute('data-z')).toBe(stopped);
  await expect(page.locator('#pause-notice')).toBeVisible();
  await page.evaluate(()=>{window.__eyes={x:.5};});
  await expect.poll(()=>page.locator('#world').getAttribute('data-z')).not.toBe(stopped);
  await expect(page.locator('body')).toHaveAttribute('data-phase','walking');
  await page.setViewportSize({width:1280,height:800});await expect(page.locator('body')).toHaveAttribute('data-phase','resize-required');
});

test('handheld is a tiny camera-only offset and reduced motion removes it',async({page})=>{
  await page.goto('./');
  const check=async()=>page.evaluate(async()=>{
    const {GalleryWorld}=await import('./src/world.js');
    const world=new GalleryWorld(document.createElement('canvas'));
    await world.ready;
    const state={x:0,z:0,yaw:0,pitch:0,moving:true};
    for(let i=0;i<90;i++)world.walk(state,1/60);
    const moving={x:world.camera.position.x,y:world.camera.position.y,pitch:world.camera.rotation.x,yaw:world.camera.rotation.y,roll:world.camera.rotation.z};
    world.handheldEnabled=false;world.walk(state,1/60);
    const disabled={x:world.camera.position.x,y:world.camera.position.y,pitch:world.camera.rotation.x,yaw:world.camera.rotation.y,roll:world.camera.rotation.z};
    world.startBoarding();world.boardingProgress(1);
    const fixedPosition=world.camera.position.toArray(),fixedRotation=world.camera.quaternion.toArray();
    world.render(.05);world.render(.05);
    const scenery=Number(world.canvas.dataset.sceneryDistance);
    const positionAfterScenery=world.camera.position.toArray(),rotationAfterScenery=world.camera.quaternion.toArray();
    world.dispose();return {moving,disabled,state,scenery,fixedPosition,fixedRotation,positionAfterScenery,rotationAfterScenery};
  });
  const normal=await check();expect(Math.abs(normal.moving.pitch)).toBeGreaterThan(0);
  expect(normal.moving.roll).toBe(0);expect(normal.disabled).toEqual({x:0,y:1.62,pitch:0,yaw:0,roll:0});
  expect(normal.state).toEqual({x:0,z:0,yaw:0,pitch:0,moving:true});
  expect(normal.scenery).toBeGreaterThan(0);expect(normal.positionAfterScenery).toEqual(normal.fixedPosition);expect(normal.rotationAfterScenery).toEqual(normal.fixedRotation);
  await page.emulateMedia({reducedMotion:'reduce'});
  const reduced=await check();expect(reduced.moving).toEqual(reduced.disabled);expect(reduced.scenery).toBe(0);
});

test('camera denial has an actionable recovery and never starts movement',async({page})=>{
  await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=()=>Promise.reject(new DOMException('Denied','NotAllowedError'));});
  await page.goto('./');await page.getByRole('button',{name:'소리와 함께 시작'}).click();
  await expect(page.locator('body')).toHaveAttribute('data-phase','error');await expect(page.locator('#message-copy')).toContainText('카메라 권한');
});

test('audible autoplay rejection pauses at arrival and a deliberate retry restores playback',async({page})=>{
  await simulatedEyes(page);
  await page.addInitScript(()=>{
    const original=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){
      if(this.id==='film'&&!this.src.includes('ready.mp4')&&!window.__allowPlayback)return Promise.reject(new DOMException('Blocked','NotAllowedError'));
      return original.call(this);
    };
  });
  await startAndWalk(page,.9);
  await expect(page.locator('body')).toHaveAttribute('data-destination','00',{timeout:25000});
  await expect(page.locator('body')).toHaveAttribute('data-phase','playback-blocked');
  await expect(page.getByRole('button',{name:'영상 재생',exact:true})).toBeVisible();
  await page.evaluate(()=>{window.__allowPlayback=true;});await page.getByRole('button',{name:'영상 재생',exact:true}).click();
  await expect(page.locator('body')).toHaveAttribute('data-phase','playing');
  expect(await page.locator('#film').evaluate(video=>video.muted)).toBe(false);
});

test('backgrounding stops travel and audio until visible/resumed without reviving stale gaze',async({page})=>{
  await simulatedEyes(page);await startAndWalk(page,.5);
  await page.evaluate(()=>{
    window.__background=true;
    Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__background});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const position=await page.locator('#world').getAttribute('data-z');
  await page.waitForTimeout(300);expect(await page.locator('#world').getAttribute('data-z')).toBe(position);
  await page.evaluate(()=>{window.__background=false;document.dispatchEvent(new Event('visibilitychange'));});
  await expect(page.locator('body')).toHaveAttribute('data-destination','00',{timeout:25000});
  await expect(page.locator('body')).toHaveAttribute('data-phase','playing');
  await page.evaluate(()=>{window.__background=true;document.dispatchEvent(new Event('visibilitychange'));});
  await expect(page.locator('body')).toHaveAttribute('data-phase','playback-blocked');
  expect(await page.locator('#film').evaluate(video=>video.paused)).toBe(true);
  await page.evaluate(()=>{window.__background=false;document.dispatchEvent(new Event('visibilitychange'));});
  expect(await page.locator('#film').evaluate(video=>video.paused)).toBe(true);
  await page.getByRole('button',{name:'이어서 보기',exact:true}).click();
  await expect(page.locator('body')).toHaveAttribute('data-phase','playing');
});

test('a missing film shows a retry and successful recovery stays at the same destination',async({page})=>{
  await simulatedEyes(page);let fail=true;
  await page.route('**/assets/films/resonance.mp4',route=>fail?route.fulfill({status:404,body:'Missing'}):route.continue());
  await startAndWalk(page,.1);
  await expect(page.locator('body')).toHaveAttribute('data-destination','00',{timeout:25000});
  await expect(page.locator('body')).toHaveAttribute('data-phase','video-error');
  const destination=await page.locator('body').getAttribute('data-destination');
  fail=false;await page.getByRole('button',{name:'다시 재생',exact:true}).click();
  await expect(page.locator('body')).toHaveAttribute('data-phase','playing');
  await expect.poll(()=>page.locator('#film').evaluate(video=>video.currentTime)).toBeGreaterThan(.1);
  expect(await page.locator('body').getAttribute('data-destination')).toBe(destination);
});
