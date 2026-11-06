import { WORLD, clamp } from './config.js';

const steer = (position, deadZone) => {
  const centered = clamp(position, 0, 1) * 2 - 1;
  const magnitude = Math.max(0, Math.abs(centered) - deadZone) / (1 - deadZone);
  return Math.sign(centered) * magnitude;
};

export class Navigation {
  constructor(options = {}) { this.rules = { ...WORLD, ...options }; this.reset(); }
  reset() {
    this.x = 0; this.z = 0; this.yaw = 0; this.pitch = 0;
    this.filtered = { x: .5, y: .5 }; this.lastValidAt = -Infinity;
    this.trackedSeconds = 0; this.arrived = null; this.moving = false;
  }
  invalidate() { this.lastValidAt = -Infinity; this.moving = false; }
  step(dt, now, sample, enabled = true) {
    const r = this.rules;
    dt = clamp(dt, 0, .08); // Never catch up after a suspended tab.
    if (!enabled || this.arrived) { this.moving = false; return this.snapshot(); }
    const fresh = sample?.valid && Number.isFinite(sample.x) && Number.isFinite(sample.y)
      && now - sample.time >= 0 && now - sample.time <= r.inputFreshMs;
    if (fresh) {
      this.lastValidAt = sample.time;
      const alpha = 1 - Math.exp(-dt / r.smoothingSeconds);
      this.filtered.x += (clamp(sample.x, 0, 1) - this.filtered.x) * alpha;
      this.filtered.y += (clamp(sample.y, 0, 1) - this.filtered.y) * alpha;
      this.yaw = clamp(this.yaw + steer(this.filtered.x, r.deadZone) * r.yawSpeed * dt, -r.yawLimit, r.yawLimit);
      this.pitch = clamp(this.pitch - steer(this.filtered.y, r.deadZone) * r.pitchSpeed * dt, -r.pitchLimit, r.pitchLimit);
    }
    // Invalid input can only continue an already-valid direction for a brief blink.
    this.moving = now - this.lastValidAt <= r.inputGraceMs;
    if (!this.moving) return this.snapshot();
    this.x = clamp(this.x + Math.sin(this.yaw) * r.speed * dt, -r.halfWidth, r.halfWidth);
    this.z = Math.min(r.length, this.z + Math.cos(this.yaw) * r.speed * dt);
    this.trackedSeconds += dt;
    if (this.z >= r.length) { this.arrived = this.x <= 0 ? 'left' : 'right'; this.moving = false; }
    return this.snapshot();
  }
  snapshot() {
    return { x: this.x, z: this.z, yaw: this.yaw, pitch: this.pitch, arrived: this.arrived, moving: this.moving, trackedSeconds: this.trackedSeconds };
  }
}
