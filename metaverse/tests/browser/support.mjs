import { readFile } from 'node:fs/promises';
export async function simulatedEyes(page,{wrongValidation=false,speed=9,validationOutlier='none'}={}) {
  // Only the tracker boundary and timing are replaced. There is no production query flag,
  // input endpoint or keyboard shortcut capable of supplying test gaze / skipping validation.
  await page.route('**/src/config.js',async route=>{
    const original=await readFile(new URL('../../src/config.js',import.meta.url),'utf8');
    await route.fulfill({contentType:'text/javascript',body:original
      .replace('speed: 0.9',`speed: ${speed}`).replace('settleMs: 900, captureMs: 1000, minSamples: 12','settleMs: 50, captureMs: 120, minSamples: 4')
      .replace('firstSettleMs: 1800','firstSettleMs: 80')
      .replace('alignmentSeconds: 1.5','alignmentSeconds: 0.15')});
  });
  await page.route('**/src/tracker.js',route=>route.fulfill({contentType:'text/javascript',body:`
    export class EyeTracker {
      constructor(callback){this.callback=callback;}
      async start(){this.stop();this.paused=false;let frame=0;
        this.timer=setInterval(()=>{
          if(this.paused||window.__eyes?.noUpdates)return;
          const phase=document.body.dataset.phase,target=document.getElementById('target');
          let x=.5,y=.5;
          if(phase==='calibrating'||phase==='validating') {x=Number(target.dataset.x);y=Number(target.dataset.y);}
          else {x=window.__eyes?.x??.5;y=window.__eyes?.y??.5;}
          if(phase==='validating'&&${wrongValidation}){x=.5;y=.5;}
          if(phase==='validating'&&target.dataset.index==='0'&&(${validationOutlier==='always'}||(${validationOutlier==='once'}&&document.body.dataset.validationAttempt==='1'))){y+=.25;}
          const invalid=window.__eyes?.invalid;
          const noise=Math.sin(frame++)*.0001;
          this.callback({valid:!invalid,reason:invalid||'',features:[(x-.5)*.18+noise,(y-.5)*.08+noise],pose:[.5,.5,.3,0,0],time:performance.now()});
        },20);
      }
      setPaused(value){this.paused=value;}
      stop(){clearInterval(this.timer);window.__trackerStops=(window.__trackerStops||0)+1;}
    }
  `}));
}

export async function startAndWalk(page,direction=.5) {
  await page.goto('./');
  await page.evaluate(x=>{window.__eyes={x};},direction);
  await page.getByRole('button',{name:'소리와 함께 시작'}).click();
  await page.waitForSelector('body[data-phase="walking"]');
}
