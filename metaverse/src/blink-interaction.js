// A blink only activates the object that was deliberately held by a fresh gaze.
export class BlinkInteraction {
  constructor(){this.reset();}
  reset(){this.target=null;this.since=0;this.lastOpen=-Infinity;this.closedAt=null;this.armed=null;}
  observe(sample,target){
    const now=sample.time;
    if(!Number.isFinite(now)){this.reset();return null;}
    if(sample.valid){
      let activated=null;
      if(this.closedAt!==null){
        const duration=now-this.closedAt;
        if(duration>=45&&duration<=600&&this.armed&&(target===this.armed||target===null))activated=this.armed;
        this.reset();
      }
      if(target!==this.target){this.target=target;this.since=now;}
      this.lastOpen=now;
      return activated;
    }
    if(sample.reason==='blink'){
      // Eyelids need not cross the detection threshold on the same video frame.
      // A wink cannot activate, but must not erase the preceding gaze before both close.
      if(sample.blinkClosed===false)return null;
      if(this.closedAt===null){
        this.closedAt=now;
        this.armed=now-this.lastOpen<=180&&now-this.since>=180?this.target:null;
      }
      if(now-this.closedAt>600)this.armed=null;
    }else this.reset();
    return null;
  }
}
