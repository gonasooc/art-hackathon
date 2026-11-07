import { CALIBRATION, WORLD, TRAIN, CARRIAGES, JOURNEY_ORDER, clamp } from './config.js';
import { GazeModel, median, validateGaze } from './gaze-model.js';
import { BlinkInteraction } from './blink-interaction.js';
import { TrainJourney } from './train-journey.js';
import { EyeTracker } from './tracker.js';
import { GalleryWorld } from './world.js';
import { GazeParticles } from './gaze-particles.js';
import { VisualInspector } from './visual-inspector.js';
import { VisualDemo } from './visual-demo.js';
import { PlanetPrologue } from './prologue.js';
import { JourneyAudio } from './journey-audio.js';

const byId=id=>document.getElementById(id);
const gazePhases=new Set(['walking','boarding','aligning','objects','car-transition']);
const messages={face:'얼굴을 화면 정면에 두어 주세요.',blink:'눈을 뜨고 점을 바라봐 주세요.',distance:'화면에서 팔 길이 정도 떨어져 앉아 주세요.',pose:'보정할 때의 자세로 돌아와 주세요.',inference:'눈을 다시 읽고 있어요. 다른 카메라 앱과 무거운 탭을 닫아 주세요.',stale:'눈 추적이 느려 잠시 멈췄어요. 다른 탭을 닫아 주세요.'};
const poseMatches=(pose,anchor)=>Math.abs(pose[0]-anchor[0])<.055&&Math.abs(pose[1]-anchor[1])<.065&&Math.abs(pose[2]/anchor[2]-1)<.2&&Math.abs(pose[3]-anchor[3])<.16&&Math.abs(pose[4]-anchor[4])<.16;

class Experience {
  constructor() {
    this.phase='idle';this.mode='eye';this.prologueSeen=false;this.serial=0;this.playAttempt=0;this.viewport=[innerWidth,innerHeight];
    this.blink=new BlinkInteraction();this.exitOpen=false;this.model=new GazeModel();this.navigation=new TrainJourney();
    this.gazeParticles=new GazeParticles(byId('gaze-particles'));
    this.tracker=new EyeTracker(sample=>this.receive(sample));
    try {this.world=new GalleryWorld(byId('world'));}
    catch {
      this.showMessage('error','공간을 열지 못했어요','Chrome의 그래픽 가속을 켠 뒤 새로고침해 주세요.','새로고침',()=>location.reload());
      byId('message-action').addEventListener('click',()=>location.reload());
      byId('message-home').addEventListener('click',()=>location.reload());byId('leave').hidden=true;return;
    }
    this.prologue=new PlanetPrologue({video:byId('prologue-video'),still:byId('prologue-still'),layer:byId('prologue-layer'),light:byId('prologue-light'),
      onProgress:(progress,reduced)=>this.world.prologueProgress(progress,reduced),onDone:()=>this.finishPrologue(),
      onError:()=>this.showMessage('prologue-error','도입 영상을 불러오지 못했어요','기차 앞에서 체험을 계속할 수 있습니다.','기차 앞에서 계속',()=>this.prologue.finish())});
    this.audio=new JourneyAudio(byId('prologue-video'));
    this.visual=new VisualInspector(this.world);
    this.demo=new VisualDemo(this.world);
    byId('visual-start').addEventListener('click',()=>this.startVisual({restart:true}));
    byId('demo-switch').addEventListener('click',()=>this.startVisual());
    byId('demo-restart').addEventListener('click',()=>this.startVisual({restart:true}));
    byId('demo-pause').addEventListener('click',()=>this.toggleDemo());
    byId('mobile-controls-toggle').addEventListener('click',()=>{
      const open=document.body.dataset.controlsOpen!=='true';
      document.body.dataset.controlsOpen=String(open);
      byId('mobile-controls-toggle').setAttribute('aria-expanded',String(open));
      byId('mobile-controls-toggle').textContent=open?'조작 닫기':'조작';
    });
    byId('demo-prev').addEventListener('click',()=>this.moveDemoCar(-1));
    byId('demo-next').addEventListener('click',()=>this.moveDemoCar(1));
    const fullscreenButton=byId('demo-fullscreen'),fullscreenStatus=byId('fullscreen-status');
    const syncFullscreen=()=>{
      const active=Boolean(document.fullscreenElement);
      fullscreenButton.textContent=active?'전체화면 해제':'전체화면';
      fullscreenButton.setAttribute('aria-pressed',String(active));
      fullscreenStatus.hidden=true;
    };
    fullscreenButton.hidden=!document.fullscreenEnabled;
    document.addEventListener('fullscreenchange',syncFullscreen);
    fullscreenButton.addEventListener('click',async()=>{
      fullscreenButton.disabled=true;fullscreenStatus.hidden=true;
      try{
        if(document.fullscreenElement)await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
        syncFullscreen();
      }catch{
        fullscreenStatus.textContent='전체화면을 전환하지 못했습니다. 다시 시도해 주세요.';
        fullscreenStatus.hidden=false;
      }finally{fullscreenButton.disabled=false;}
    });
    syncFullscreen();
    byId('start').addEventListener('click',()=>this.start());
    byId('restart').addEventListener('click',()=>this.start());
    byId('finale-restart').addEventListener('click',()=>this.mode==='demo'?this.startVisual({restart:true}):this.start());
    byId('finale-home').addEventListener('click',()=>this.home());
    byId('recalibrate').addEventListener('click',()=>this.start());
    byId('motion-toggle').addEventListener('click',()=>{this.world.handheldEnabled=!this.world.handheldEnabled;this.updateMotionControl();});
    byId('gaze-toggle').addEventListener('click',()=>{this.gazeParticles.setEnabled(!this.gazeParticles.enabled);this.updateGazeControl();});
    this.world.motionPreference.addEventListener('change',()=>this.updateMotionControl());
    for (const id of ['leave','message-home','end-home']) byId(id).addEventListener('click',()=>this.home());
    byId('message-action').addEventListener('click',()=>this.action?.());
    document.addEventListener('visibilitychange',()=>this.visibilityChanged());
    window.addEventListener('resize',()=>this.resized());
    window.addEventListener('pagehide',()=>this.release());
    byId('world').addEventListener('webglcontextlost',event=>{event.preventDefault();this.release();this.showMessage('error','공간이 잠시 끊겼어요','다른 그래픽 앱을 닫고 새로고침해 주세요.','새로고침',()=>location.reload());});
    let previous=performance.now();
    const frame=()=>{
      // RAF's timestamp can precede an input callback from the same frame.
      // Compare freshness using the same live clock that timestamps camera samples.
      const now=performance.now();
      const dt=Math.min((now-previous)/1000,.08);previous=now;
      if (!document.hidden) {
        const frozen=this.mode==='demo'&&(this.demo.paused||this.demo.preparing);
        if(!frozen)this.update(now,dt);
        // The opaque eye-setup screen needs no 3D redraws; reserve GPU time for inference.
        if(!['loading','calibrating','validating'].includes(this.phase))this.world.render(!frozen&&(this.phase==='visual'?!this.visual.paused:['walking','boarding','aligning','objects','car-transition','finale'].includes(this.phase))?dt:0);
        this.gazeParticles.render(performance.now(),this.latest,{active:!frozen&&gazePhases.has(this.phase),reducedMotion:this.world.motionPreference.matches});
      }
      const footstepPaused=document.hidden||(this.mode==='demo'&&(this.demo.paused||this.demo.preparing))||!['walking','visual'].includes(this.phase);
      this.audio.update({phase:this.phase,carId:this.navigation.carId,journeyStage:this.navigation.stage,travelDistance:this.navigation.walker.z,playgroundStartedCount:this.world.objects.targets.filter(t=>t.car==='03'&&(t.gone||t.progress!==null)).length,dt,moving:this.phase==='visual'?this.visual.moving:this.phase==='walking'&&this.navigation.walker.moving,footstepsPaused:footstepPaused,paused:document.hidden||(this.mode==='demo'&&(this.demo.paused||this.demo.preparing))||!['prologue','walking','boarding','aligning','objects','car-transition','finale'].includes(this.phase)});
      this.raf=requestAnimationFrame(frame);
    };
    this.raf=requestAnimationFrame(frame);
    const query=new URLSearchParams(location.search);
    if(query.get('mode')==='visual')this.startVisual({restart:true});
    if(query.get('mode')==='inspect')this.startInspector(query.get('car'));
  }
  setPhase(phase) {
    this.phase=phase;document.body.dataset.phase=phase;document.body.dataset.mode=this.mode;
    byId('mobile-controls-toggle').hidden=this.mode!=='demo'||['idle','error'].includes(phase);
    if(phase==='idle'||this.demo?.preparing){document.body.dataset.controlsOpen='false';byId('mobile-controls-toggle').setAttribute('aria-expanded','false');byId('mobile-controls-toggle').textContent='조작';}
    byId('car-loading').hidden=phase!=='car-loading';
    byId('intro').hidden=phase!=='idle';
    byId('setup').hidden=!['loading','calibrating','validating'].includes(phase);
    byId('target').hidden=!['calibrating','validating'].includes(phase);
    byId('prologue-layer').hidden=phase!=='prologue';
    byId('ending').hidden=phase!=='ended';
    byId('finale-controls').hidden=true;
    byId('finale-restart').textContent=this.mode==='demo'?'다시 시연':'다시 탑승하기';
    byId('demo-switch').hidden=this.mode!=='eye'||!this.world||['idle','ended','finale'].includes(phase);
    byId('demo-controls').hidden=this.mode!=='demo'||['idle','error'].includes(phase);
    byId('message').hidden=!['error','calibration-failed','playback-blocked','video-error','resize-required','prologue-error'].includes(phase);
    byId('leave').hidden=['idle','ended'].includes(phase);
    byId('leave').innerHTML=this.mode==='demo'?'시연 종료 <span aria-hidden="true">×</span>':phase==='visual'?'테스트 종료 <span aria-hidden="true">×</span>':'체험 종료 <span aria-hidden="true">×</span>';
    byId('pause-notice').hidden=true;
    byId('journey-status').hidden=!gazePhases.has(phase);
    byId('boarding-veil').hidden=!['boarding','car-transition'].includes(phase);
    this.updateMotionControl();
    this.updateGazeControl();
    this.updateDemoNavigation();
    if(!gazePhases.has(phase))this.gazeParticles.clear();
  }
  updateMotionControl() {
    const button=byId('motion-toggle');
    button.hidden=this.mode==='demo'||this.phase!=='walking'||!this.world||this.world.motionPreference.matches;
    button.textContent=this.world?.handheldEnabled?'흔들림 끄기':'흔들림 켜기';
    button.setAttribute('aria-pressed',String(Boolean(this.world?.handheldEnabled)));
  }
  updateGazeControl() {
    const button=byId('gaze-toggle');
    button.hidden=this.mode==='demo'||!gazePhases.has(this.phase)||!this.model.ready;
    button.textContent=this.gazeParticles.enabled?'시선 표시 끄기':'시선 표시 켜기';
    button.setAttribute('aria-pressed',String(this.gazeParticles.enabled));
  }
  updateJourneyStatus(state) {
    this.updateDemoNavigation();
    document.body.dataset.journeyStage=state.stage;document.body.dataset.carriage=state.carId||'';
    const label=state.stage==='platform'?'PLATFORM':state.stage==='boarding'?'DEPARTURE':state.carId||'00';
    const title=state.stage==='platform'?'탑승 전':state.stage==='boarding'?'첫 번째 칸으로':CARRIAGES.find(car=>car.id===state.carId)?.title||'';
    if(byId('journey-number').textContent!==label)byId('journey-number').textContent=label;
    if(byId('journey-title').textContent!==title)byId('journey-title').textContent=title;
  }
  showMessage(phase,title,copy,label,action) {
    if(gazePhases.has(this.phase)||this.phase==='prologue')this.resumePhase=this.phase;
    this.setPhase(phase);this.action=action;
    byId('message-title').textContent=title;byId('message-copy').textContent=copy;byId('message-action').textContent=label;
    byId('message-title').focus({preventScroll:true});
  }
  release() {
    this.prologue?.pause();
    this.world?.finale?.pause();
    this.audio?.stop();
    this.visual?.stop();
    this.demo?.stop();byId('demo-blink').style.opacity=0;
    delete document.body.dataset.demoTarget;delete document.body.dataset.demoStage;delete document.body.dataset.demoPaused;
    this.serial++;this.playAttempt++;this.tracker.stop();this.navigation.invalidate();this.latest=null;
    this.gazeParticles.clear();this.blink.reset();
    this.training=[];this.validation=[];this.currentPoint=null;this.anchor=null;
    this.validationOrder=[];this.validationAttempt=0;
  }
  home() {
    this.release();this.model.clear();this.world.reset();this.navigation.reset();this.work=null;
    this.prologue.reset();this.prologueSeen=false;
    this.mode='eye';this.resumePhase=null;
    this.setPhase('idle');byId('start').focus({preventScroll:true});
    this.updateJourneyStatus(this.navigation.snapshot());
    delete document.body.dataset.destination;delete document.body.dataset.validation;delete document.body.dataset.validationAttempt;
  }
  async startInspector(car='platform') {
    this.release();const serial=this.serial;
    this.prologue.reset();this.prologueSeen=false;
    this.mode='inspect';this.resumePhase=null;
    this.model.clear();this.navigation.reset();this.latest=null;
    delete document.body.dataset.validation;delete document.body.dataset.destination;
    this.setPhase('visual');this.visual.start();
    try{await this.world.ready;if(serial===this.serial&&this.visual.active)await this.visual.selectRoom(CARRIAGES.some(item=>item.id===car&&item.implemented)?car:'platform');}
    catch{
      if(serial!==this.serial)return;
      this.release();this.showMessage('error','공간을 준비하지 못했어요','이미지 파일을 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.','다시 열기',()=>this.startInspector(car));
    }
  }
  async startVisual({restart=false}={}) {
    const previous=gazePhases.has(this.phase)||this.phase==='prologue'?this.phase:this.resumePhase;
    this.release();const serial=this.serial;this.mode='demo';this.model.clear();
    if(restart){this.navigation.reset();this.world.reset();this.exitOpen=false;this.resumePhase=null;this.prologue.reset();this.prologueSeen=false;}
    const fresh=restart||(!previous&&!this.prologueSeen&&this.navigation.stage==='platform'&&this.navigation.walker.z===0);
    const phase=fresh?'prologue':previous||'walking';
    this.demo.start();this.demo.preparing=true;
    byId('demo-label').textContent='자동 시연 · 준비 중';byId('demo-pause').disabled=true;byId('demo-pause').textContent='일시정지';byId('demo-pause').setAttribute('aria-pressed','false');
    document.body.dataset.demoPaused='false';delete document.body.dataset.validation;delete document.body.dataset.validationAttempt;
    this.setPhase(phase);this.walkStarted=performance.now();
    if(phase==='walking'&&!previous)this.world.walk(this.navigation.snapshot());
    this.updateJourneyStatus(this.navigation.snapshot());
    try{
      await this.world.ready;if(serial!==this.serial)return;
      this.demo.preparing=false;byId('demo-label').textContent='자동 시연';byId('demo-pause').disabled=false;
      if(phase==='prologue'){
        if(this.prologue.failed)this.prologue.finish();
        else this.beginPrologue({resume:!fresh&&this.prologue.active});
      }
    }catch{
      if(serial!==this.serial)return;
      this.release();this.showMessage('error','공간을 준비하지 못했어요','이미지 파일을 불러오지 못했어요. 연결을 확인한 뒤 다시 열어 주세요.','다시 열기',()=>this.startVisual());
    }
  }
  async waitForCar(id){
    if(this.world.isCarReady(id))return true;
    const serial=this.serial,phase=this.phase;
    if(this.mode==='demo')this.demo.preparing=true;
    this.navigation.invalidate();this.latest=null;this.blink.reset();this.setPhase('car-loading');
    try{
      await this.world.ensureCar(id);
      if(serial!==this.serial)return false;
      if(this.mode==='demo')this.demo.preparing=false;
      this.setPhase(phase);return true;
    }catch{
      if(serial!==this.serial)return false;
      this.release();this.showMessage('error','숲을 불러오지 못했어요','연결을 확인한 뒤 다시 열어 주세요.','새로고침',()=>location.reload());return false;
    }
  }
  updateDemoNavigation(){
    const index=JOURNEY_ORDER.indexOf(this.navigation.carId);
    const ready=this.mode==='demo'&&this.demo?.active&&!this.demo.preparing&&index>=0;
    byId('demo-prev').disabled=!ready||index===0;
    byId('demo-next').disabled=!ready||index===JOURNEY_ORDER.length-1;
  }
  async moveDemoCar(direction){
    if(this.mode!=='demo'||![-1,1].includes(direction))return;
    const previous=this.navigation.carId,index=JOURNEY_ORDER.indexOf(previous);
    if(index<0)return;
    const next=JOURNEY_ORDER[index+direction];
    if(!next||this.demo.preparing)return;
    if(!await this.waitForCar(next))return;
    if(!this.demo.seekCar(this.navigation,next))return;
    this.audio.stop();this.world.resetFinale();
    this.world.boarded=true;byId('world').dataset.trainMoving='true';
    this.world.objects.reset(previous);this.world.objects.reset(next);
    this.world.transition=null;this.world.alignment=null;this.world.handheld.reset();
    this.latest=null;this.blink.reset();this.gazeParticles.clear();
    this.exitOpen=next==='00';this.changeElapsed=0;this.changedCar=false;this.resumePhase=null;
    this.navigation.invalidate();this.walkStarted=performance.now();
    byId('boarding-veil').style.opacity=0;byId('demo-blink').style.opacity=0;
    delete document.body.dataset.demoTarget;delete document.body.dataset.demoStage;
    delete document.body.dataset.blinkActivated;delete document.body.dataset.destination;
    this.world.setCar(next);this.world.walk(this.navigation.snapshot());
    this.setPhase('walking');this.updateJourneyStatus(this.navigation.snapshot());
    const canvas=byId('world');canvas.dataset.x='0';canvas.dataset.z='0';canvas.dataset.yaw='0';
  }
  toggleDemo(){
    if(this.mode!=='demo'||this.demo.preparing)return;
    this.demo.paused=!this.demo.paused;this.demo.resetFocus();this.blink.reset();this.navigation.invalidate();this.latest=null;this.gazeParticles.clear();byId('demo-blink').style.opacity=0;
    byId('demo-pause').textContent=this.demo.paused?'계속 시연':'일시정지';byId('demo-pause').setAttribute('aria-pressed',String(this.demo.paused));
    byId('demo-label').textContent=this.demo.paused?'자동 시연 · 일시정지':'자동 시연';document.body.dataset.demoPaused=String(this.demo.paused);
    if(this.phase==='prologue'){if(this.demo.paused)this.prologue.pause();else this.prologue.resume();}
  }
  beginPrologue({resume=false}={}){
    this.latest=null;this.blink.reset();this.navigation.invalidate();this.tracker.setPaused(true);this.setPhase('prologue');
    this.updateJourneyStatus(this.navigation.snapshot());
    const canvas=byId('world');canvas.dataset.z=String(this.navigation.walker.z);canvas.dataset.x=String(this.navigation.walker.x);
    if(resume)this.prologue.resume();else this.prologue.start(this.world.motionPreference.matches);
  }
  finishPrologue(){
    if(!['prologue','prologue-error'].includes(this.phase))return;
    this.prologueSeen=true;this.resumePhase=null;this.latest=null;this.blink.reset();this.navigation.invalidate();
    this.tracker.setPaused(document.hidden);this.walkStarted=performance.now();
    this.world.walk(this.navigation.snapshot());this.updateJourneyStatus(this.navigation.snapshot());this.setPhase('walking');
  }
  async start() {
    this.release();const serial=this.serial;
    this.prologue.reset();this.prologueSeen=false;
    this.mode='eye';this.resumePhase=null;
    this.model.clear();this.navigation.reset();this.world.reset();this.work=null;this.anchor=null;this.exitOpen=false;
    this.updateJourneyStatus(this.navigation.snapshot());
    this.viewport=[innerWidth,innerHeight];document.body.dataset.validation='pending';
    delete document.body.dataset.destination;delete document.body.dataset.validationAttempt;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this.showMessage('error','카메라를 사용할 수 없어요','HTTPS 주소 또는 localhost에서 데스크톱 Chrome으로 열어 주세요.','다시 확인',()=>this.start());return;
    }
    if (innerWidth<700 || innerHeight<480 || /Android|iPhone|iPad/i.test(navigator.userAgent)) {
      this.showMessage('error','노트북에서 만나 주세요','화면을 넓게 열어 주세요. 이 첫 전시는 웹캠이 있는 노트북의 Chrome에 맞춰져 있습니다.','다시 확인',()=>this.start());return;
    }
    this.setPhase('loading');byId('step-label').textContent='PREPARATION';byId('setup-title').textContent='공간과 눈을 연결하고 있어요';
    byId('setup-copy').textContent='카메라 사용을 허용하고, 편하게 정면을 바라봐 주세요.';byId('step-count').textContent='';byId('tracking-status').textContent='처음에는 눈 추적 모델을 준비하는 데 잠시 시간이 필요해요.';
    try {
      await Promise.all([this.tracker.start(),this.world.ready]);
      if(serial!==this.serial)return;
      this.training=[];this.validation=[];this.pointIndex=0;this.beginCalibrationPhase('calibrating');
    } catch(error) {
      if(serial!==this.serial||error.name==='AbortError')return;
      this.tracker.stop();
      const copy=error.name==='NotAllowedError'?'주소창의 카메라 권한을 허용한 뒤 다시 시작해 주세요.':error.name==='NotFoundError'?'연결된 카메라를 찾지 못했어요. 웹캠 연결을 확인해 주세요.':error.name==='NotReadableError'?'다른 앱이 카메라를 사용 중일 수 있어요. 해당 앱을 닫고 다시 시작해 주세요.':'모델 또는 카메라 준비가 끝나지 않았어요. 연결을 확인하고 다시 시도해 주세요.';
      this.showMessage('error','눈을 연결하지 못했어요',copy,'다시 시작',()=>this.start());
    }
  }
  beginCalibrationPhase(phase) {
    this.setPhase(phase);this.pointIndex=0;
    if(phase==='validating'){
      this.validationOrder=CALIBRATION.validation.map((_,index)=>index);this.validationAttempt=0;
      document.body.dataset.validationAttempt='1';
    }
    byId('step-label').textContent=phase==='calibrating'?'01 / EYE CALIBRATION':'02 / GAZE CHECK';
    byId('setup-title').textContent=phase==='calibrating'?'빛나는 점을 바라봐 주세요':'잘 맞는지 한 번 더';
    byId('setup-copy').textContent='고개는 편하게 고정하고, 눈으로 점을 따라가 주세요. 클릭하지 않아도 됩니다.';
    this.nextTarget();
  }
  nextTarget() {
    const training=this.phase==='calibrating';
    const points=training?CALIBRATION.training:this.validationOrder.map(index=>CALIBRATION.validation[index]);
    const settleMs=training&&this.pointIndex===0?CALIBRATION.firstSettleMs:!training&&this.validationAttempt>0?CALIBRATION.retrySettleMs:CALIBRATION.settleMs;
    this.currentPoint={target:points[this.pointIndex],validationIndex:training?null:this.validationOrder[this.pointIndex],samples:[],predictions:[],started:performance.now(),settleMs};
    const [x,y]=this.currentPoint.target,target=byId('target');
    target.style.left=`${x*100}%`;target.style.top=`${y*100}%`;target.style.setProperty('--progress',0);
    target.dataset.x=x;target.dataset.y=y;target.dataset.index=training?this.pointIndex:this.validationOrder[this.pointIndex];
    byId('step-count').textContent=`${!training&&this.validationAttempt>0?'재확인 ':''}${String(this.pointIndex+1).padStart(2,'0')} / ${String(points.length).padStart(2,'0')}`;
    byId('tracking-status').textContent='점이 채워질 때까지 시선을 머물러 주세요.';
  }
  receive(sample) {
    if(this.mode!=='eye')return;
    const now=performance.now();
    if ((!['calibrating','validating'].includes(this.phase)&&!gazePhases.has(this.phase)&&!(this.phase==='prologue'&&sample.reason==='camera-ended'))||document.hidden)return;
    if (sample.reason==='camera-ended') {
      this.release();this.showMessage('error','카메라 연결이 끊겼어요','다시 연결한 뒤 눈을 맞춰 주세요.','다시 시작',()=>this.start());return;
    }
    let valid=sample.valid,reason=sample.reason;
    if(valid&&now-sample.time>WORLD.inputFreshMs){valid=false;reason='stale';}
    if(valid&&this.phase==='calibrating'&&this.anchor&&!poseMatches(sample.pose,this.anchor)){valid=false;reason='pose';}
    if(valid&&this.phase!=='calibrating'&&!this.model.poseMatches(sample.pose)){valid=false;reason='pose';}
    const prediction=valid&&this.model.ready?this.model.predict(sample.features):null;
    if(valid&&this.phase!=='calibrating'&&!prediction){valid=false;reason='pose';}
    this.latest={...prediction,valid,time:sample.time,reason};
    if(gazePhases.has(this.phase)){
      if(['walking','objects'].includes(this.phase)&&this.navigation.carId){
        this.interact({...sample,valid});
      }else this.blink.reset();
      return;
    }
    byId('target').dataset.waiting=String(!valid);
    const copy=valid?'점이 채워질 때까지 시선을 머물러 주세요.':messages[reason]||messages.face;
    if(byId('tracking-status').textContent!==copy)byId('tracking-status').textContent=copy;
    // A delayed inference result must have been CAPTURED after the target settled.
    if(!valid||sample.time-this.currentPoint.started<this.currentPoint.settleMs)return;
    if(this.phase==='calibrating')this.currentPoint.samples.push({features:sample.features,pose:sample.pose});
    else this.currentPoint.predictions.push(prediction);
  }
  interact(sample){
    const target=this.world.objects.pick(this.latest,this.world.camera);document.body.dataset.gazeTarget=target||'';
    const hit=this.blink.observe(sample,target);document.body.dataset.blinkArmed=this.blink.armed||'';
    if(hit){document.body.dataset.blinkActivated=hit;this.world.objects.dissolve(hit);}
  }
  finishPoint() {
    const training=this.phase==='calibrating';
    if(training)this.training.push(this.currentPoint);
    else this.validation[this.currentPoint.validationIndex]=this.currentPoint;
    if(training&&!this.anchor)this.anchor=Array.from({length:5},(_,i)=>median(this.currentPoint.samples.map(s=>s.pose[i])));
    this.pointIndex++;
    const pointCount=training?CALIBRATION.training.length:this.validationOrder.length;
    if(this.pointIndex<pointCount){this.nextTarget();return;}
    if(training){
      try{this.model.fit(this.training);this.beginCalibrationPhase('validating');}
      catch(error){this.calibrationFailed(error.message);}
    }else{
      const report=validateGaze(this.validation);
      // Aggregate diagnostics only: no images, raw eye features or gaze history.
      console.info('[gaze-check]',{attempt:this.validationAttempt+1,delegate:this.tracker.delegate||'unreported',model:this.model.modelType,trainingCvError:this.model.trainingCvError,passed:report.passed,
        reason:report.code,medianError:report.medianError,maxPointError:report.maxPointError,
        directionAccuracy:report.regionAccuracy,jitter:report.jitter,recheckPoints:report.retryIndices.map(index=>index+1)});
      if(!report.passed){
        if(this.validationAttempt<CALIBRATION.maxValidationRetries&&report.retryIndices.length){
          this.validationAttempt++;this.validationOrder=report.retryIndices;this.pointIndex=0;this.latest=null;
          document.body.dataset.validation='retrying';document.body.dataset.validationAttempt=String(this.validationAttempt+1);
          byId('step-label').textContent='02 / GAZE RECHECK';
          byId('setup-title').textContent=report.retryIndices.length===1?'이 점만 다시 확인할게요':'두 점만 다시 확인할게요';
          byId('setup-copy').textContent='앞서 맞춘 내용은 유지됩니다. 표시된 점만 다시 바라봐 주세요.';
          this.nextTarget();return;
        }
        this.calibrationFailed(report.reason);return;
      }
      this.training=[];this.validation=[];this.currentPoint=null;this.anchor=null;
      document.body.dataset.validation='passed';this.navigation.reset();this.latest=null;this.walkStarted=performance.now();
      this.beginPrologue();
    }
  }
  calibrationFailed(reason) {
    this.release();this.model.clear();this.training=[];this.validation=[];this.currentPoint=null;this.anchor=null;
    document.body.dataset.validation='failed';
    this.showMessage('calibration-failed','눈을 다시 맞춰볼까요',reason,'다시 맞추기',()=>this.start());
  }
  update(now,dt) {
    if(this.phase==='prologue'){this.prologue.update(dt);return;}
    if(this.phase==='visual'){this.visual.update(dt);return;}
    if(this.mode==='demo'&&gazePhases.has(this.phase)){
      const sample=this.demo.sample(this.phase,dt,this.navigation);
      this.latest={...sample,time:now};
      if(this.phase==='objects')this.interact(sample);else this.blink.reset();
      byId('demo-blink').style.opacity=this.world.motionPreference.matches?0:this.demo.blinkAmount*.9;
      document.body.dataset.demoTarget=this.demo.target?.id||'';document.body.dataset.demoStage=this.demo.stage;
    }
    if(this.phase==='finale'){byId('finale-controls').hidden=!this.world.finale.complete;return;}
    if(['walking','aligning','objects'].includes(this.phase)&&this.navigation.carId==='07'&&this.world.objects.complete()){
      this.tracker.stop();this.navigation.invalidate();this.latest=null;this.blink.reset();this.gazeParticles.clear();this.model.clear();byId('demo-blink').style.opacity=0;
      this.setPhase('finale');this.world.startFinale();return;
    }
    if(this.phase==='objects'&&this.world.objects.complete()){
      this.exitOpen=true;this.navigation.openExit();this.latest=null;this.blink.reset();this.walkStarted=now;this.setPhase('walking');
    }
    if(this.phase==='car-transition'){
      this.changeElapsed+=dt;const progress=Math.min(1,this.changeElapsed/1.5);
      byId('boarding-veil').style.opacity=this.world.motionPreference.matches?0:Math.sin(progress*Math.PI);
      if(progress>=.5&&!this.changedCar){this.navigation.nextCar();this.world.setCar(this.navigation.carId);this.world.walk(this.navigation.snapshot());this.updateJourneyStatus(this.navigation.snapshot());this.changedCar=true;}
      if(progress>=1){this.exitOpen=false;this.latest=null;this.blink.reset();this.walkStarted=now;this.setPhase('walking');}
      return;
    }

    if(['calibrating','validating'].includes(this.phase)){
      const elapsed=now-this.currentPoint.started;
      const samples=this.phase==='calibrating'?this.currentPoint.samples:this.currentPoint.predictions;
      const progress=Math.min(clamp((elapsed-this.currentPoint.settleMs)/CALIBRATION.captureMs,0,1),samples.length/CALIBRATION.minSamples);
      byId('target').style.setProperty('--progress',progress);
      if(elapsed>=this.currentPoint.settleMs+CALIBRATION.captureMs&&samples.length>=CALIBRATION.minSamples)this.finishPoint();
      else if(elapsed>CALIBRATION.timeoutMs)this.calibrationFailed('눈을 안정적으로 읽지 못했어요. 얼굴을 밝게 비추고 화면을 정면으로 바라봐 주세요.');
    }else if(this.phase==='walking'){
      if(this.navigation.stage==='platform'&&this.audio.awaitingHornLead){
        this.navigation.invalidate();this.world.walk(this.navigation.snapshot());
        this.walkStarted=now;byId('pause-notice').hidden=true;return;
      }
      const state=this.navigation.step(dt,now,this.latest);
      this.world.walk(state,dt);
      this.updateJourneyStatus(state);
      const canvas=byId('world');canvas.dataset.x=state.x.toFixed(3);canvas.dataset.z=state.z.toFixed(3);canvas.dataset.yaw=state.yaw.toFixed(3);
      const paused=!state.moving&&now-this.walkStarted>700;
      byId('pause-notice').hidden=!paused;
      if(paused)byId('pause-copy').textContent=messages[this.latest?.reason]||'눈을 다시 확인하면 이어서 걸어요.';
      if(state.arrived==='boarding')this.boardTrain();
      else if(state.arrived)this.arrive(state.arrived);
    }else if(this.phase==='boarding'){
      this.boardElapsed+=dt;const progress=clamp(this.boardElapsed/this.boardDuration,0,1);
      this.world.boardingProgress(progress);
      byId('boarding-veil').style.opacity=this.world.motionPreference.matches?0:Math.sin(progress*Math.PI)*.92;
      if(progress>=1){
        this.navigation.enterCar('00');this.exitOpen=true;this.latest=null;this.walkStarted=now;
        this.setPhase('walking');this.world.walk(this.navigation.snapshot());this.updateJourneyStatus(this.navigation.snapshot());
      }
    }else if(this.phase==='aligning'){
      this.alignElapsed+=dt;const progress=clamp(this.alignElapsed/this.alignDuration,0,1);this.world.alignProgress(progress);
      if(progress>=1)this.setPhase('objects');
    }
  }
  boardTrain() {
    if(!this.navigation.beginBoarding())return;
    this.setPhase('boarding');this.world.startBoarding();this.updateJourneyStatus(this.navigation.snapshot());
    this.boardElapsed=0;this.boardDuration=this.world.motionPreference.matches ? .01 : TRAIN.boardingSeconds;
  }
  async arrive(id) {
    this.navigation.invalidate();this.blink.reset();
    if(this.exitOpen){
      if(this.navigation.nextCarId){
        if(!await this.waitForCar(this.navigation.nextCarId))return;
        this.setPhase('car-transition');this.audio.play('door');this.changeElapsed=0;this.changedCar=false;
      }else this.finish();
      return;
    }
    this.setPhase('aligning');document.body.dataset.destination=id;
    this.world.align(id,this.mode==='demo');this.alignElapsed=0;this.alignDuration=this.world.motionPreference.matches?.01:WORLD.alignmentSeconds;
  }
  finish() {
    this.release();this.model.clear();this.setPhase('ended');
    byId('work-label').textContent='04 · 향이 놓인 자리';byId('work-title').textContent='향이 사라진 뒤에도 남아 있는 것';
    byId('restart').focus({preventScroll:true});
  }
  visibilityChanged() {
    if(document.hidden)this.audio.update({phase:this.phase,paused:true});
    this.navigation.invalidate();this.latest=null;this.tracker.setPaused(document.hidden||this.phase==='prologue');
    if(this.phase==='prologue'){
      if(document.hidden)this.prologue.pause();else if(!(this.mode==='demo'&&this.demo.paused))this.prologue.resume();
    }
    this.gazeParticles.clear();this.blink.reset();
    if(this.mode==='demo'){this.demo.resetFocus();byId('demo-blink').style.opacity=0;}
    if(!document.hidden&&['calibrating','validating'].includes(this.phase))this.nextTarget();
  }
  resized() {
    this.world.resize();
    this.gazeParticles.resize();this.gazeParticles.clear();
    if(innerWidth===this.viewport[0]&&innerHeight===this.viewport[1])return;
    this.viewport=[innerWidth,innerHeight];
    if(this.mode==='inspect'){this.visual.resizeView();return;}
    if(this.mode==='demo'){
      if(['objects','aligning'].includes(this.phase)){this.world.align(this.navigation.carId,true);this.world.alignProgress(1);}
      this.demo.resetFocus();this.blink.reset();this.latest=null;this.navigation.invalidate();byId('demo-blink').style.opacity=0;return;
    }
    if(['calibrating','validating','walking','boarding','objects','aligning','car-transition','prologue'].includes(this.phase)){
      this.release();this.model.clear();this.showMessage('resize-required','화면 크기가 달라졌어요','새로운 화면에 맞춰 눈을 한 번 더 맞춰 주세요.','다시 맞추기',()=>this.start());
    }else if(gazePhases.has(this.phase)){
      // The film may continue, but a calibration for another viewport must not draw a false point.
      this.tracker.stop();this.latest=null;this.model.clear();
      this.updateGazeControl();
    }
  }
}

new Experience();
