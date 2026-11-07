import {CARRIAGES, TRAIN, WORLD, clamp} from './config.js';

const byId=id=>document.getElementById(id);
const names={'02-mural':'벽화','02-ceiling-light':'천장등','02-shelf':'선반','03-slide':'미끄럼틀','03-swing':'그네','04-teacups':'찻잔','04-chairs':'의자','04-table':'테이블','01-leopard':'검은 표범','01-chair':'의자','05-moss':'이끼','05-snow':'잔설','05-tree':'나무','06-leopard':'검은 표범','06-shroud':'수의로 덮인 몸','06-halo':'앤젤링','07-incense':'향과 향로'};
const movement=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyQ','KeyE','ShiftLeft','ShiftRight']);
const editing=target=>target?.closest('input,select,textarea,button,[contenteditable="true"]');

// A separate input controller: never supplies fake samples to the eye tracker.
export class VisualInspector {
  constructor(world){
    this.world=world;this.canvas=world.canvas;this.moving=false;this.active=false;this.keys=new Set();
    this.canvas.tabIndex=0;
    for(const car of CARRIAGES.filter(car=>car.implemented))byId('visual-room').add(new Option(`${car.id} · ${car.title}`,car.id));
    byId('visual-room').addEventListener('change',event=>this.selectRoom(event.target.value));
    byId('visual-object').addEventListener('change',()=>this.updateSelection());
    for(const button of document.querySelectorAll('[data-visual-view]'))button.addEventListener('click',()=>this.view(button.dataset.visualView));
    byId('visual-dissolve').addEventListener('click',()=>this.dissolve());
    byId('visual-restore').addEventListener('click',()=>this.restore());
    byId('visual-exposure').addEventListener('input',()=>this.exposure(Number(byId('visual-exposure').value)));
    byId('visual-light-reset').addEventListener('click',()=>this.exposure(1));
    byId('visual-animation').addEventListener('click',()=>{
      this.paused=!this.paused;byId('visual-animation').setAttribute('aria-pressed',String(this.paused));
      byId('visual-animation').textContent=this.paused?'애니메이션 재생':'애니메이션 정지';
    });
    byId('visual-tools-toggle').addEventListener('click',()=>this.toggleTools());
    window.addEventListener('keydown',event=>{
      if(!this.active||event.metaKey||event.ctrlKey||event.altKey)return;
      if(event.code==='KeyH'&&!event.repeat&&!event.target?.closest('input,select,textarea,[contenteditable="true"]')){event.preventDefault();this.toggleTools();return;}
      if(editing(event.target))return;
      if(movement.has(event.code)){event.preventDefault();this.keys.add(event.code);}
      if(event.code==='Space'&&!event.repeat){event.preventDefault();this.dissolve();}
    });
    window.addEventListener('keyup',event=>this.keys.delete(event.code));
    window.addEventListener('blur',()=>this.clearInput());
    document.addEventListener('visibilitychange',()=>this.clearInput());
    this.canvas.addEventListener('pointerdown',event=>{
      if(!this.active||event.button!==0)return;
      this.takeCamera();
      this.canvas.focus({preventScroll:true});this.drag={id:event.pointerId,x:event.clientX,y:event.clientY};
      this.canvas.setPointerCapture(event.pointerId);
    });
    this.canvas.addEventListener('pointermove',event=>{
      if(!this.active||this.drag?.id!==event.pointerId)return;
      this.yaw-=(event.clientX-this.drag.x)*.003;this.pitch=clamp(this.pitch-(event.clientY-this.drag.y)*.003,-1.45,1.45);
      this.drag.x=event.clientX;this.drag.y=event.clientY;this.orient();
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture'])this.canvas.addEventListener(type,()=>this.endDrag());
  }
  start(){
    this.savedExposure=this.world.renderer.toneMappingExposure;this.active=true;this.paused=false;
    byId('visual-animation').setAttribute('aria-pressed','false');byId('visual-animation').textContent='애니메이션 정지';
    byId('visual-badge').hidden=false;byId('visual-tools-toggle').hidden=false;this.setTools(true);this.exposure(1);this.selectRoom('platform');
  }
  stop(){
    if(!this.active)return;
    this.active=false;this.selectionSerial=(this.selectionSerial||0)+1;this.clearInput();this.world.renderer.toneMappingExposure=this.savedExposure;
    this.world.objects.focusedId=null;this.world.needsRender=true;
    for(const id of ['visual-badge','visual-panel','visual-tools-toggle'])byId(id).hidden=true;
    delete this.canvas.dataset.visualPose;delete this.canvas.dataset.visualExposure;
  }
  clearInput(){
    this.keys.clear();this.moving=false;this.endDrag();
  }
  endDrag(){
    const id=this.drag?.id;this.drag=null;
    if(id!==undefined&&this.canvas.hasPointerCapture(id))this.canvas.releasePointerCapture(id);
  }
  setTools(visible){byId('visual-panel').hidden=!visible;byId('visual-tools-toggle').setAttribute('aria-expanded',String(visible));byId('visual-tools-toggle').textContent=visible?'도구 숨기기 · H':'도구 보이기 · H';}
  toggleTools(){if(this.active)this.setTools(byId('visual-panel').hidden);}
  exposure(value){
    if(!this.active)return;
    this.world.renderer.toneMappingExposure=this.savedExposure*value;this.world.needsRender=true;
    byId('visual-exposure').value=value;byId('visual-exposure-value').textContent=`${value.toFixed(1)}×`;this.canvas.dataset.visualExposure=String(value);
  }
  async selectRoom(id){
    if(!this.active)return;
    const selection=this.selectionSerial=(this.selectionSerial||0)+1;
    if(!this.world.isCarReady(id)){
      byId('visual-status').textContent='숲 모델을 불러오는 중…';
      try{await this.world.ensureCar(id);}catch{if(this.active&&selection===this.selectionSerial)byId('visual-status').textContent='숲 모델을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.';return;}
      if(!this.active||selection!==this.selectionSerial)return;
    }
    this.clearInput();this.room=id;this.world.reset();
    if(id!=='platform'){
      this.world.setCar(id);this.world.boarded=true;
      this.canvas.dataset.trainMoving='true';this.canvas.dataset.journeyStage='carriage';
    }
    document.body.dataset.carriage=id==='platform'?'':id;byId('visual-room').value=id;
    byId('visual-room-title').textContent=id==='platform'?'기차 앞':`${id} · ${CARRIAGES.find(car=>car.id===id).title}`;
    const objects=byId('visual-object');objects.replaceChildren();
    const targets=this.targets();objects.add(new Option(targets.length?'모든 오브젝트':'오브젝트 없음','all'));
    for(const target of targets)objects.add(new Option(names[target.id]||target.id,target.id));
    objects.disabled=!targets.length;byId('visual-dissolve').disabled=!targets.length;byId('visual-restore').disabled=!targets.length;
    byId('visual-status').textContent=id==='00'?'자궁칸은 오브젝트 없이 공간만 확인합니다.':id==='platform'?'기차 외관을 살펴보거나 다른 공간으로 바로 이동하세요.':id==='07'?'향이 사라진 뒤 연기 글씨가 피어납니다. 복원하면 처음부터 다시 볼 수 있습니다.':'공간과 오브젝트를 둘러보고 소멸 장면을 확인하세요.';
    this.view('inspection');
  }
  targets(){return this.world.objects.targets.filter(target=>target.car===this.room);}
  updateSelection(){this.world.objects.focusedId=byId('visual-object').value==='all'?null:byId('visual-object').value;this.world.needsRender=true;}
  restore(){
    if(!this.active)return;
    this.world.resetFinale();
    this.world.objects.reset();this.world.objects.setCar(this.room==='platform'?'00':this.room);this.updateSelection();
    if(this.room==='07'){this.world.boarded=true;this.canvas.dataset.trainMoving='true';this.view('inspection');}
    byId('visual-status').textContent='오브젝트를 원래 상태로 되돌렸습니다.';
  }
  dissolve(){
    if(!this.active)return;
    const selected=byId('visual-object').value;
    const targets=this.targets().filter(target=>selected==='all'||selected===target.id);
    const count=targets.filter(target=>this.world.objects.dissolve(target.id)).length;
    if(count)byId('visual-status').textContent=this.paused?'소멸을 준비했습니다. 애니메이션 재생을 누르면 이어집니다.':`${count}개 오브젝트의 소멸을 확인합니다. 복원해 반복할 수 있습니다.`;
  }
  view(preset){
    if(!this.active)return;
    this.preset=preset;this.world.finalCamera=null;
    this.clearInput();const camera=this.world.camera;camera.rotation.set(0,0,0,'YXZ');
    if(this.room==='platform'){
      const poses={entrance:[[0,WORLD.eyeHeight,6],[0,2,-6]],inspection:[[5.5,2.6,16],[-1,2,-7.1]],exit:[[4,3,-3],[0,2,-7.9]]};
      const [position,target]=poses[preset];camera.position.set(...position);camera.lookAt(camera.position.clone().set(...target));
    }else{
      const x=preset==='entrance'?TRAIN.interiorStartX:preset==='exit'?TRAIN.interiorStartX-TRAIN.exitLength:TRAIN.interiorStartX-TRAIN.interiorLength;
      camera.position.set(x,WORLD.eyeHeight+TRAIN.floorY,TRAIN.centerZ);
      camera.lookAt(camera.position.clone().set(preset==='exit'?x+5:-9,2,TRAIN.centerZ));
    }
    camera.fov=48;camera.updateProjectionMatrix();
    if(preset==='inspection'&&this.room!=='platform')this.world.fitVisualObservation(this.room);
    this.yaw=camera.rotation.y;this.pitch=camera.rotation.x;this.orient();this.canvas.focus({preventScroll:true});
  }
  orient(){this.world.camera.rotation.set(this.pitch,this.yaw,0,'YXZ');this.world.needsRender=true;this.recordPose();}
  resizeView(){if(this.active&&this.preset&&!this.world.finale.active)this.view(this.preset);}
  takeCamera(){this.preset=null;this.world.finalCamera=null;this.yaw=this.world.camera.rotation.y;this.pitch=this.world.camera.rotation.x;}
  recordPose(){this.canvas.dataset.visualPose=JSON.stringify([...this.world.camera.position.toArray(),this.pitch,this.yaw].map(n=>Number(n.toFixed(4))));}
  update(dt){
    this.moving=false;
    if(!this.active)return;
    // The finale briefly reframes the scene; manual input can always take over.
    if(this.world.finale.active){this.yaw=this.world.camera.rotation.y;this.pitch=this.world.camera.rotation.x;this.recordPose();}
    const keys=this.keys,forward=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'));
    const side=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
    const up=Number(keys.has('KeyE'))-Number(keys.has('KeyQ'));
    if(!forward&&!side&&!up)return;
    this.takeCamera();
    const step=Math.min(dt,.08)*(keys.has('ShiftLeft')||keys.has('ShiftRight')?5.5:2.2)/Math.max(1,Math.hypot(forward,side,up));
    const p=this.world.camera.position,beforeX=p.x,beforeZ=p.z;
    p.x=clamp(p.x+(-Math.sin(this.yaw)*forward+Math.cos(this.yaw)*side)*step,-35,35);
    p.z=clamp(p.z+(-Math.cos(this.yaw)*forward-Math.sin(this.yaw)*side)*step,-40,30);
    p.y=clamp(p.y+up*step,.2,15);this.moving=Math.hypot(p.x-beforeX,p.z-beforeZ)>1e-6;this.world.needsRender=true;this.recordPose();
  }
}
