import { CALIBRATION, WORLD, WORKS, clamp } from './config.js';
import { GazeModel, median, validateGaze } from './gaze-model.js';
import { Navigation } from './navigation.js';
import { EyeTracker } from './tracker.js';
import { GalleryWorld } from './world.js';

const byId=id=>document.getElementById(id);
const messages={face:'얼굴을 화면 정면에 두어 주세요.',blink:'눈을 뜨고 점을 바라봐 주세요.',distance:'화면에서 팔 길이 정도 떨어져 앉아 주세요.',pose:'보정할 때의 자세로 돌아와 주세요.',inference:'눈을 다시 읽고 있어요. 다른 카메라 앱과 무거운 탭을 닫아 주세요.',stale:'눈 추적이 느려 잠시 멈췄어요. 다른 탭을 닫아 주세요.'};
const poseMatches=(pose,anchor)=>Math.abs(pose[0]-anchor[0])<.055&&Math.abs(pose[1]-anchor[1])<.065&&Math.abs(pose[2]/anchor[2]-1)<.2&&Math.abs(pose[3]-anchor[3])<.16&&Math.abs(pose[4]-anchor[4])<.16;

class Experience {
  constructor() {
    this.phase='idle';this.serial=0;this.playAttempt=0;this.viewport=[innerWidth,innerHeight];
    this.film=byId('film');this.model=new GazeModel();this.navigation=new Navigation();
    this.tracker=new EyeTracker(sample=>this.receive(sample));
    try {this.world=new GalleryWorld(byId('world'));}
    catch {
      this.showMessage('error','공간을 열지 못했어요','Chrome의 그래픽 가속을 켠 뒤 새로고침해 주세요.','새로고침',()=>location.reload());
      byId('message-action').addEventListener('click',()=>location.reload());
      byId('message-home').addEventListener('click',()=>location.reload());byId('leave').hidden=true;return;
    }
    byId('start').addEventListener('click',()=>this.start());
    byId('restart').addEventListener('click',()=>this.start());
    byId('recalibrate').addEventListener('click',()=>this.start());
    byId('motion-toggle').addEventListener('click',()=>{this.world.handheldEnabled=!this.world.handheldEnabled;this.updateMotionControl();});
    this.world.motionPreference.addEventListener('change',()=>this.updateMotionControl());
    for (const id of ['leave','message-home','end-home']) byId(id).addEventListener('click',()=>this.home());
    byId('message-action').addEventListener('click',()=>this.action?.());
    this.film.addEventListener('ended',()=>{if(this.phase==='playing')this.finish();});
    this.film.addEventListener('error',()=>{
      if (['aligning','playing','playback-blocked','video-error'].includes(this.phase)) this.showMessage('video-error','영상을 불러오지 못했어요','연결을 확인하고 다시 재생해 주세요. 도착한 위치는 그대로 유지됩니다.','다시 재생',()=>{this.film.load();this.playWork();});
    });
    document.addEventListener('visibilitychange',()=>this.visibilityChanged());
    window.addEventListener('resize',()=>this.resized());
    window.addEventListener('pagehide',()=>this.release());
    byId('world').addEventListener('webglcontextlost',event=>{event.preventDefault();this.release();this.showMessage('error','공간이 잠시 끊겼어요','다른 그래픽 앱을 닫고 새로고침해 주세요.','새로고침',()=>location.reload());});
    let previous=performance.now();
    const frame=now=>{
      const dt=Math.min((now-previous)/1000,.08);previous=now;
      if (!document.hidden) {
        this.update(now,dt);this.world.render();
      }
      this.raf=requestAnimationFrame(frame);
    };
    this.raf=requestAnimationFrame(frame);
  }
  setPhase(phase) {
    this.phase=phase;document.body.dataset.phase=phase;
    byId('intro').hidden=phase!=='idle';
    byId('setup').hidden=!['loading','calibrating','validating'].includes(phase);
    byId('target').hidden=!['calibrating','validating'].includes(phase);
    byId('ending').hidden=phase!=='ended';
    byId('message').hidden=!['error','calibration-failed','playback-blocked','video-error','resize-required'].includes(phase);
    byId('leave').hidden=['idle','ended'].includes(phase);
    byId('pause-notice').hidden=true;
    this.updateMotionControl();
  }
  updateMotionControl() {
    const button=byId('motion-toggle');
    button.hidden=this.phase!=='walking'||!this.world||this.world.motionPreference.matches;
    button.textContent=this.world?.handheldEnabled?'흔들림 끄기':'흔들림 켜기';
    button.setAttribute('aria-pressed',String(Boolean(this.world?.handheldEnabled)));
  }
  showMessage(phase,title,copy,label,action) {
    this.setPhase(phase);this.action=action;
    byId('message-title').textContent=title;byId('message-copy').textContent=copy;byId('message-action').textContent=label;
    byId('message-title').focus({preventScroll:true});
  }
  release() {
    this.serial++;this.playAttempt++;this.tracker.stop();this.film.pause();this.navigation.invalidate();this.latest=null;
    this.training=[];this.validation=[];this.currentPoint=null;this.anchor=null;
  }
  home() {
    this.release();this.model.clear();this.world.reset();this.navigation.reset();this.work=null;
    this.film.removeAttribute('src');this.film.load();this.setPhase('idle');byId('start').focus({preventScroll:true});
    delete document.body.dataset.destination;delete document.body.dataset.validation;
  }
  async start() {
    this.release();const serial=this.serial;
    this.model.clear();this.navigation.reset();this.world.reset();this.work=null;this.anchor=null;
    this.viewport=[innerWidth,innerHeight];document.body.dataset.validation='pending';
    delete document.body.dataset.destination;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this.showMessage('error','카메라를 사용할 수 없어요','HTTPS 주소 또는 localhost에서 데스크톱 Chrome으로 열어 주세요.','다시 확인',()=>this.start());return;
    }
    if (innerWidth<700 || innerHeight<480 || /Android|iPhone|iPad/i.test(navigator.userAgent)) {
      this.showMessage('error','노트북에서 만나 주세요','화면을 넓게 열어 주세요. 이 첫 전시는 웹캠이 있는 노트북의 Chrome에 맞춰져 있습니다.','다시 확인',()=>this.start());return;
    }
    this.setPhase('loading');byId('step-label').textContent='PREPARATION';byId('setup-title').textContent='공간과 눈을 연결하고 있어요';
    byId('setup-copy').textContent='카메라 사용을 허용하고, 편하게 정면을 바라봐 주세요.';byId('step-count').textContent='';byId('tracking-status').textContent='처음에는 눈 추적 모델을 준비하는 데 잠시 시간이 필요해요.';
    // This play() runs directly in the user's click handler, on the SAME video element used later.
    // Browser policy can still reject delayed playback; arrival always has a visible recovery action.
    this.film.src=new URL('../assets/films/ready.mp4',import.meta.url).href;this.film.muted=false;this.film.volume=.65;
    const prime=this.film.play().then(()=>{if(serial===this.serial&&this.phase==='loading')this.film.pause();}).catch(()=>{});
    try {
      await Promise.all([this.tracker.start(),prime]);
      if(serial!==this.serial)return;
      this.training=[];this.validation=[];this.pointIndex=0;this.beginCalibrationPhase('calibrating');
    } catch(error) {
      if(serial!==this.serial||error.name==='AbortError')return;
      this.tracker.stop();this.film.pause();
      const copy=error.name==='NotAllowedError'?'주소창의 카메라 권한을 허용한 뒤 다시 시작해 주세요.':error.name==='NotFoundError'?'연결된 카메라를 찾지 못했어요. 웹캠 연결을 확인해 주세요.':error.name==='NotReadableError'?'다른 앱이 카메라를 사용 중일 수 있어요. 해당 앱을 닫고 다시 시작해 주세요.':'모델 또는 카메라 준비가 끝나지 않았어요. 연결을 확인하고 다시 시도해 주세요.';
      this.showMessage('error','눈을 연결하지 못했어요',copy,'다시 시작',()=>this.start());
    }
  }
  beginCalibrationPhase(phase) {
    this.setPhase(phase);this.pointIndex=0;
    byId('step-label').textContent=phase==='calibrating'?'01 / EYE CALIBRATION':'02 / GAZE CHECK';
    byId('setup-title').textContent=phase==='calibrating'?'빛나는 점을 바라봐 주세요':'잘 맞는지 한 번 더';
    byId('setup-copy').textContent='고개는 편하게 고정하고, 눈으로 점을 따라가 주세요. 클릭하지 않아도 됩니다.';
    this.nextTarget();
  }
  nextTarget() {
    const points=this.phase==='calibrating'?CALIBRATION.training:CALIBRATION.validation;
    this.currentPoint={target:points[this.pointIndex],samples:[],predictions:[],started:performance.now()};
    const [x,y]=this.currentPoint.target,target=byId('target');
    target.style.left=`${x*100}%`;target.style.top=`${y*100}%`;target.style.setProperty('--progress',0);
    target.dataset.x=x;target.dataset.y=y;
    byId('step-count').textContent=`${String(this.pointIndex+1).padStart(2,'0')} / ${String(points.length).padStart(2,'0')}`;
    byId('tracking-status').textContent='점이 채워질 때까지 시선을 머물러 주세요.';
  }
  receive(sample) {
    const now=performance.now();
    if (!['calibrating','validating','walking'].includes(this.phase)||document.hidden)return;
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
    if(this.phase==='walking')return;
    byId('target').dataset.waiting=String(!valid);
    const copy=valid?'점이 채워질 때까지 시선을 머물러 주세요.':messages[reason]||messages.face;
    if(byId('tracking-status').textContent!==copy)byId('tracking-status').textContent=copy;
    if(!valid||now-this.currentPoint.started<CALIBRATION.settleMs)return;
    if(this.phase==='calibrating')this.currentPoint.samples.push({features:sample.features,pose:sample.pose});
    else this.currentPoint.predictions.push(prediction);
  }
  finishPoint() {
    const training=this.phase==='calibrating',groups=training?this.training:this.validation;
    groups.push(this.currentPoint);
    if(training&&!this.anchor)this.anchor=Array.from({length:5},(_,i)=>median(this.currentPoint.samples.map(s=>s.pose[i])));
    this.pointIndex++;
    const points=training?CALIBRATION.training:CALIBRATION.validation;
    if(this.pointIndex<points.length){this.nextTarget();return;}
    if(training){
      try{this.model.fit(groups);this.beginCalibrationPhase('validating');}
      catch(error){this.calibrationFailed(error.message);}
    }else{
      const report=validateGaze(groups);
      if(!report.passed){this.calibrationFailed(report.reason);return;}
      this.training=[];this.validation=[];this.currentPoint=null;this.anchor=null;
      document.body.dataset.validation='passed';this.navigation.reset();this.latest=null;this.walkStarted=performance.now();
      this.setPhase('walking');this.world.walk(this.navigation.snapshot());
    }
  }
  calibrationFailed(reason) {
    this.release();this.model.clear();this.training=[];this.validation=[];this.currentPoint=null;this.anchor=null;
    document.body.dataset.validation='failed';
    this.showMessage('calibration-failed','눈을 다시 맞춰볼까요',reason,'다시 맞추기',()=>this.start());
  }
  update(now,dt) {
    if(['calibrating','validating'].includes(this.phase)){
      const elapsed=now-this.currentPoint.started;
      const samples=this.phase==='calibrating'?this.currentPoint.samples:this.currentPoint.predictions;
      const progress=Math.min(clamp((elapsed-CALIBRATION.settleMs)/CALIBRATION.captureMs,0,1),samples.length/CALIBRATION.minSamples);
      byId('target').style.setProperty('--progress',progress);
      if(elapsed>=CALIBRATION.settleMs+CALIBRATION.captureMs&&samples.length>=CALIBRATION.minSamples)this.finishPoint();
      else if(elapsed>CALIBRATION.timeoutMs)this.calibrationFailed('눈을 안정적으로 읽지 못했어요. 얼굴을 밝게 비추고 화면을 정면으로 바라봐 주세요.');
    }else if(this.phase==='walking'){
      const state=this.navigation.step(dt,now,this.latest);
      this.world.walk(state,dt);
      const canvas=byId('world');canvas.dataset.x=state.x.toFixed(3);canvas.dataset.z=state.z.toFixed(3);canvas.dataset.yaw=state.yaw.toFixed(3);
      const paused=!state.moving&&now-this.walkStarted>700;
      byId('pause-notice').hidden=!paused;
      if(paused)byId('pause-copy').textContent=messages[this.latest?.reason]||'눈을 다시 확인하면 이어서 걸어요.';
      if(state.arrived)this.arrive(state.arrived);
    }else if(this.phase==='aligning'){
      this.alignElapsed+=dt;const progress=clamp(this.alignElapsed/this.alignDuration,0,1);this.world.alignProgress(progress);
      if(progress>=1)this.playWork();
    }
  }
  arrive(id) {
    this.work=WORKS.find(work=>work.id===id);this.tracker.stop();this.navigation.invalidate();this.latest=null;
    this.setPhase('aligning');document.body.dataset.destination=id;
    this.world.align(id);this.alignElapsed=0;this.alignDuration=matchMedia('(prefers-reduced-motion: reduce)').matches?0.01:WORLD.alignmentSeconds;
    this.film.src=this.work.src;this.film.load();this.film.muted=false;this.film.volume=.65;
  }
  async playWork() {
    if(!this.work||document.hidden)return;
    const serial=this.serial,attempt=++this.playAttempt;
    this.world.alignProgress(1);this.world.showFilm(this.work.id,this.film);this.setPhase('playing');
    try {
      await this.film.play();
      if(serial!==this.serial||attempt!==this.playAttempt||document.hidden)this.film.pause();
    }catch(error){
      if(serial!==this.serial||attempt!==this.playAttempt)return;
      this.film.pause();
      if(error.name==='NotAllowedError')this.showMessage('playback-blocked','소리와 함께 만나 주세요','브라우저가 자동재생을 잠시 막았어요. 한 번 누르면 이 자리에서 영상이 시작됩니다.','영상 재생',()=>this.playWork());
      else this.showMessage('video-error','영상을 불러오지 못했어요','연결을 확인하고 다시 재생해 주세요.','다시 재생',()=>{this.film.load();this.playWork();});
    }
  }
  finish() {
    this.release();this.model.clear();this.setPhase('ended');
    byId('work-label').textContent=this.work.subtitle;byId('work-title').textContent=this.work.title;
    byId('restart').focus({preventScroll:true});
  }
  visibilityChanged() {
    this.navigation.invalidate();this.latest=null;this.tracker.setPaused(document.hidden);
    if(document.hidden){
      if(this.phase==='playing'){
        this.playAttempt++;this.film.pause();
        this.showMessage('playback-blocked','잠시 멈춰두었어요','돌아오면 소리와 함께 이어서 볼 수 있어요.','이어서 보기',()=>this.playWork());
      }
    }else if(['calibrating','validating'].includes(this.phase))this.nextTarget();
  }
  resized() {
    this.world.resize();
    if(innerWidth===this.viewport[0]&&innerHeight===this.viewport[1])return;
    this.viewport=[innerWidth,innerHeight];
    if(['calibrating','validating','walking'].includes(this.phase)){
      this.release();this.model.clear();this.showMessage('resize-required','화면 크기가 달라졌어요','새로운 화면에 맞춰 눈을 한 번 더 맞춰 주세요.','다시 맞추기',()=>this.start());
    }
  }
}

new Experience();
