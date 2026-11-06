// Gentle camera presence, independent of locomotion and gaze. No random per-frame jitter,
// roll, FOV pumping, vertical footsteps or acceleration of the viewer's actual path.
export class HandheldMotion {
  constructor() { this.reset(); }
  reset() { this.amount=0;this.time=0; }
  sample(dt,moving,enabled=true) {
    dt=Math.max(0,Math.min(dt,.08));
    if(!enabled){this.reset();return {x:0,y:0,yaw:0,pitch:0,roll:0};}
    this.time+=dt;
    const target=moving?1:0;
    this.amount+=(target-this.amount)*(1-Math.exp(-dt/(moving?.6:.18)));
    if(this.amount<.0001)this.amount=0;
    const t=this.time,a=this.amount,tau=Math.PI*2;
    return {
      x:a*.0025*Math.sin(tau*.33*t),
      y:a*.0035*(.7*Math.sin(tau*.44*t)+.3*Math.sin(tau*.71*t)),
      yaw:a*.0011*(.7*Math.sin(tau*.31*t)+.3*Math.sin(tau*.67*t)),
      pitch:a*.0015*(.7*Math.sin(tau*.43*t)+.3*Math.sin(tau*.79*t)),
      roll:0,
    };
  }
}
