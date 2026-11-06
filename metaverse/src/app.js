import { CALIBRATION, WORLD, TRAIN, clamp } from './config.js';
import { GazeModel, median, validateGaze } from './gaze-model.js';
import { BlinkInteraction } from './blink-interaction.js';
import { TrainJourney } from './train-journey.js';
import { EyeTracker } from './tracker.js';
import { GalleryWorld } from './world.js';
import { GazeParticles } from './gaze-particles.js';

const byId=id=>document.getElementById(id);
const gazePhases=new Set(['walking','boarding','aligning','objects','car-transition']);
const messages={face:'얼굴을 화면 정면에 두어 주세요.',blink:'눈을 뜨고 점을 바라봐 주세요.',distance:'화면에서 팔 길이 정도 떨어져 앉아 주세요.',pose:'보정할 때의 자세로 돌아와 주세요.',inference:'눈을 다시 읽고 있어요. 다른 카메라 앱과 무거운 탭을 닫아 주세요.',stale:'눈 추적이 느려 잠시 멈췄어요. 다른 탭을 닫아 주세요.'};
const poseMatches=(pose,anchor)=>Math.abs(pose[0]-anchor[0])<.055&&Math.abs(pose[1]-anchor[1])<.065&&Math.abs(pose[2]/anchor[2]-1)<.2&&Math.abs(pose[3]-anchor[3])<.16&&Math.abs(pose[4]-anchor[4])<.16;

class Experience {
  constructor() {
    this.phase='idle';this.serial=0;this.playAttempt=0;this.viewport=[innerWidth,innerHeight];
    this.blink=new BlinkInteraction();this.exitOpen=false;this.model=new GazeModel();this.navigation=new TrainJourney();
    this.gazeParticles=new GazeParticles(byId('gaze-particles'));
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
        this.update(now,dt);
        // The opaque eye-setup screen needs no 3D redraws; reserve GPU time for inference.
        if(!['loading','calibrating','validating'].includes(this.phase))this.world.render(['walking','boarding','aligning','objects','car-transition'].includes(this.phase)?dt:0);
        this.gazeParticles.render(performance.now(),this.latest,{active:gazePhases.has(this.phase),reducedMotion:this.world.motionPreference.matches});
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
    byId('journey-status').hidden=!gazePhases.has(phase);
    byId('boarding-veil').hidden=!['boarding','car-transition'].includes(phase);
    this.updateMotionControl();
    this.updateGazeControl();
    if(!gazePhases.has(phase))this.gazeParticles.clear();
  }
  updateMotionControl() {
    const button=byId('motion-toggle');
    button.hidden=this.phase!=='walking'||!this.world||this.world.motionPreference.matches;
    button.textContent=this.world?.handheldEnabled?'흔들림 끄기':'흔들림 켜기';
    button.setAttribute('aria-pressed',String(Boolean(this.world?.handheldEnabled)));
  }
  updateGazeControl() {
    const button=byId('gaze-toggle');
    button.hidden=!gazePhases.has(this.phase)||!this.model.ready;
    button.textContent=this.gazeParticles.enabled?'시선 표시 끄기':'시선 표시 켜기';
    button.setAttribute('aria-pressed',String(this.gazeParticles.enabled));
  }
  updateJourneyStatus(state) {
    document.body.dataset.journeyStage=state.stage;document.body.dataset.carriage=state.carId||'';
    const label=state.stage==='platform'?'PLATFORM':state.stage==='boarding'?'DEPARTURE':state.carId||'00';
    const title=state.stage==='platform'?'탑승 전':state.stage==='boarding'?'첫 번째 칸으로':state.carId==='01'?'병원 · 남겨진 자리':'첫 숨이 되기 전';
    if(byId('journey-number').textContent!==label)byId('journey-number').textContent=label;
    if(byId('journey-title').textContent!==title)byId('journey-title').textContent=title;
  }
  showMessage(phase,title,copy,label,action) {
    this.setPhase(phase);this.action=action;
    byId('message-title').textContent=title;byId('message-copy').textContent=copy;byId('message-action').textContent=label;
    byId('message-title').focus({preventScroll:true});
  }
  release() {
    this.serial++;this.playAttempt++;this.tracker.stop();this.navigation.invalidate();this.latest=null;
    this.gazeParticles.clear();this.blink.reset();
    this.training=[];this.validation=[];this.currentPoint=null;this.anchor=null;
    this.validationOrder=[];this.validationAttempt=0;
  }
  home() {
    this.release();this.model.clear();this.world.reset();this.navigation.reset();this.work=null;
    this.setPhase('idle');byId('start').focus({preventScroll:true});
    this.updateJourneyStatus(this.navigation.snapshot());
    delete document.body.dataset.destination;delete document.body.dataset.validation;delete document.body.dataset.validationAttempt;
  }
  async start() {
    this.release();const serial=this.serial;
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
    const now=performance.now();
    if ((!['calibrating','validating'].includes(this.phase)&&!gazePhases.has(this.phase))||document.hidden)return;
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
        const target=this.world.objects.pick(this.latest,this.world.camera);
        document.body.dataset.gazeTarget=target||'';
        const hit=this.blink.observe({...sample,valid},target);
        document.body.dataset.blinkArmed=this.blink.armed||'';
        if(hit){document.body.dataset.blinkActivated=hit;this.world.objects.dissolve(hit);}
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
      this.setPhase('walking');this.world.walk(this.navigation.snapshot());this.updateJourneyStatus(this.navigation.snapshot());
    }
  }
  calibrationFailed(reason) {
    this.release();this.model.clear();this.training=[];this.validation=[];this.currentPoint=null;this.anchor=null;
    document.body.dataset.validation='failed';
    this.showMessage('calibration-failed','눈을 다시 맞춰볼까요',reason,'다시 맞추기',()=>this.start());
  }
  update(now,dt) {
    if(this.phase==='objects'&&this.world.objects.complete()){
      this.exitOpen=true;this.navigation.openExit();this.latest=null;this.blink.reset();this.walkStarted=now;this.setPhase('walking');
    }
    if(this.phase==='car-transition'){
      this.changeElapsed+=dt;const progress=Math.min(1,this.changeElapsed/1.5);
      byId('boarding-veil').style.opacity=this.world.motionPreference.matches?0:Math.sin(progress*Math.PI);
      if(progress>=.5&&!this.changedCar){this.navigation.nextCar();this.world.setCar('01');this.world.walk(this.navigation.snapshot());this.updateJourneyStatus(this.navigation.snapshot());this.changedCar=true;}
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
  arrive(id) {
    this.navigation.invalidate();this.blink.reset();
    if(this.exitOpen){
      if(id==='00'){
        this.setPhase('car-transition');this.changeElapsed=0;this.changedCar=false;
      }else this.finish();
      return;
    }
    this.setPhase('aligning');document.body.dataset.destination=id;
    this.world.align(id);this.alignElapsed=0;this.alignDuration=this.world.motionPreference.matches?.01:WORLD.alignmentSeconds;
  }
  finish() {
    this.release();this.model.clear();this.setPhase('ended');
    byId('work-label').textContent='01 · 병원';byId('work-title').textContent='의자와 표범이 머물던 자리';
    byId('restart').focus({preventScroll:true});
  }
  visibilityChanged() {
    this.navigation.invalidate();this.latest=null;this.tracker.setPaused(document.hidden);
    this.gazeParticles.clear();this.blink.reset();
    if(!document.hidden&&['calibrating','validating'].includes(this.phase))this.nextTarget();
  }
  resized() {
    this.world.resize();
    this.gazeParticles.resize();this.gazeParticles.clear();
    if(innerWidth===this.viewport[0]&&innerHeight===this.viewport[1])return;
    this.viewport=[innerWidth,innerHeight];
    if(['calibrating','validating','walking','boarding','objects','aligning','car-transition'].includes(this.phase)){
      this.release();this.model.clear();this.showMessage('resize-required','화면 크기가 달라졌어요','새로운 화면에 맞춰 눈을 한 번 더 맞춰 주세요.','다시 맞추기',()=>this.start());
    }else if(gazePhases.has(this.phase)){
      // The film may continue, but a calibration for another viewport must not draw a false point.
      this.tracker.stop();this.latest=null;this.model.clear();
      this.updateGazeControl();
    }
  }
}

new Experience();
