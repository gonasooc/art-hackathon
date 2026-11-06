export class EyeTracker {
  constructor(onSample) { this.onSample=onSample; this.generation=0; }
  async start() {
    this.stop();
    const generation=this.generation;
    const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:640},height:{ideal:480},frameRate:{ideal:30,max:30}}});
    if (generation!==this.generation) { stream.getTracks().forEach(t=>t.stop()); throw new DOMException('Canceled','AbortError'); }
    this.stream=stream;
    this.video=document.createElement('video');
    this.video.muted=true; this.video.playsInline=true; this.video.srcObject=stream;
    await this.video.play();
    if (generation!==this.generation) throw new DOMException('Canceled','AbortError');
    const worker=new Worker(new URL('./vision-worker.js',import.meta.url));
    this.worker=worker; this.busy=false; this.paused=false; this.lastResult=performance.now();
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('눈 추적 모델을 불러오지 못했어요. 새로고침 후 다시 시작해 주세요.')),45000);
      this.rejectReady=()=>{clearTimeout(timeout);reject(new DOMException('Canceled','AbortError'));};
      worker.onmessage=({data})=>{
        if (generation!==this.generation) return;
        if (data.type==='ready') {clearTimeout(timeout);this.rejectReady=null;this.delegate=data.delegate;resolve();}
        else if (data.type==='error') {clearTimeout(timeout);this.rejectReady=null;reject(new Error(data.message));}
        else if (data.type==='sample') {
          this.busy=false; this.lastResult=performance.now();
          if (!this.paused) this.onSample(data);
        }
      };
      worker.onerror=event=>{clearTimeout(timeout);reject(new Error(event.message||'눈 추적을 시작하지 못했어요.'));};
      worker.postMessage({type:'init'});
    });
    if (generation!==this.generation) throw new DOMException('Canceled','AbortError');
    stream.getVideoTracks()[0].onended=()=>this.onSample({valid:false,reason:'camera-ended',time:performance.now()});
    let lastCapture=-Infinity,lastVideoTime=-1;
    const tick=async now=>{
      if (generation!==this.generation) return;
      this.raf=requestAnimationFrame(tick);
      if (this.paused || document.hidden) return;
      if (now-this.lastResult>1000) this.onSample({valid:false,reason:'inference',time:now});
      if (this.busy || now-lastCapture<50 || this.video.currentTime===lastVideoTime || this.video.readyState<2) return;
      this.busy=true; lastCapture=now; lastVideoTime=this.video.currentTime;
      try {
        const bitmap=await createImageBitmap(this.video);
        if (generation!==this.generation || this.paused) {bitmap.close();this.busy=false;return;}
        worker.postMessage({type:'frame',bitmap,time:now},[bitmap]);
      } catch {this.busy=false;this.onSample({valid:false,reason:'camera',time:now});}
    };
    this.raf=requestAnimationFrame(tick);
  }
  setPaused(paused) { this.paused=paused; this.lastResult=performance.now(); }
  stop() {
    this.generation++;
    cancelAnimationFrame(this.raf);
    this.rejectReady?.(); this.rejectReady=null;
    this.worker?.terminate(); this.worker=null;
    this.stream?.getTracks().forEach(t=>t.stop()); this.stream=null;
    if (this.video) {this.video.pause();this.video.srcObject=null;this.video=null;}
    this.busy=false;
  }
}
