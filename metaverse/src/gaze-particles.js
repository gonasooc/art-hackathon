import { WORLD, clamp } from './config.js';

const SIZE = 128;
const CENTER = SIZE / 2;
const FADE_MS = 120;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// A screen-space indicator, deliberately independent of the navigation's smoothed input.
// The small central star is the exact latest estimate; the surrounding dust is decorative.
export class GazeParticles {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.enabled = true;
    this.lostAt = null;
    this.hasPoint = false;
    this.particles = Array.from({ length: 42 }, (_, index) => ({
      angle: index * GOLDEN_ANGLE,
      radius: 8 + Math.sqrt((index + .5) / 42) * 29,
      size: .55 + ((index * 7) % 11) / 11,
      opacity: .22 + ((index * 13) % 17) / 28,
      phase: index * 1.71,
    }));
    this.resize();
    this.clear();
  }

  resize() {
    const scale = Math.min(globalThis.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(SIZE * scale);
    this.canvas.height = Math.round(SIZE * scale);
    this.context.setTransform(scale, 0, 0, scale, 0, 0);
    this.halo = this.context.createRadialGradient(CENTER, CENTER, 1, CENTER, CENTER, 29);
    this.halo.addColorStop(0, 'rgba(226, 204, 151, .16)');
    this.halo.addColorStop(.35, 'rgba(210, 175, 116, .07)');
    this.halo.addColorStop(1, 'rgba(210, 175, 116, 0)');
  }

  clear() {
    this.canvas.hidden = true;
    this.canvas.dataset.tracking = 'off';
    delete this.canvas.dataset.x;
    delete this.canvas.dataset.y;
    this.context.clearRect(0, 0, SIZE, SIZE);
    this.hasPoint = false;
    this.lostAt = null;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) this.clear();
  }

  render(now, sample, { active, reducedMotion = false }) {
    if (!active || !this.enabled) {
      if (this.hasPoint || !this.canvas.hidden) this.clear();
      return;
    }
    const fresh = sample?.valid && Number.isFinite(sample.x) && Number.isFinite(sample.y)
      && Number.isFinite(sample.time) && now >= sample.time && now - sample.time <= WORLD.inputFreshMs;
    let alpha = 1;
    if (fresh) {
      const x = clamp(sample.x, 0, 1), y = clamp(sample.y, 0, 1);
      // Do not ease or add orbital offsets to this coordinate: this is a tracking test.
      this.canvas.style.transform = `translate3d(${x * innerWidth - CENTER}px, ${y * innerHeight - CENTER}px, 0)`;
      this.canvas.dataset.x = String(x);
      this.canvas.dataset.y = String(y);
      this.canvas.dataset.tracking = 'live';
      this.canvas.hidden = false;
      this.hasPoint = true;
      this.lostAt = null;
      this.decorationTime = reducedMotion ? 0 : now / 1000;
    } else {
      delete this.canvas.dataset.x;
      delete this.canvas.dataset.y;
      if (!this.hasPoint || reducedMotion) { this.clear(); return; }
      this.canvas.dataset.tracking = 'lost';
      this.lostAt ??= now;
      alpha = 1 - (now - this.lostAt) / FADE_MS;
      if (alpha <= 0) { this.clear(); return; }
    }
    // On loss, remove the precise center immediately. Only stationary dust fades out.
    this.draw(this.decorationTime || 0, alpha, fresh);
  }

  draw(time, alpha, showCenter) {
    const ctx = this.context;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.globalAlpha = alpha;
    if (showCenter) {
      ctx.fillStyle = this.halo;
      ctx.fillRect(CENTER - 30, CENTER - 30, 60, 60);
    }
    for (const particle of this.particles) {
      const angle = particle.angle + time * .13;
      const radius = particle.radius + Math.sin(time * .85 + particle.phase) * 1.8;
      const x = CENTER + Math.cos(angle) * radius * .8;
      const y = CENTER + Math.sin(angle) * radius;
      const shimmer = .88 + .12 * Math.sin(time * .7 + particle.phase);
      ctx.globalAlpha = alpha * particle.opacity * shimmer;
      ctx.fillStyle = particle.size > 1 ? '#eadbb9' : '#c6a871';
      ctx.beginPath();
      ctx.arc(x, y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    if (showCenter) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#f5ebd3';
      ctx.strokeStyle = 'rgba(22, 31, 24, .85)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(CENTER, CENTER - 4);
      ctx.lineTo(CENTER + 1.25, CENTER - 1.25);
      ctx.lineTo(CENTER + 4, CENTER);
      ctx.lineTo(CENTER + 1.25, CENTER + 1.25);
      ctx.lineTo(CENTER, CENTER + 4);
      ctx.lineTo(CENTER - 1.25, CENTER + 1.25);
      ctx.lineTo(CENTER - 4, CENTER);
      ctx.lineTo(CENTER - 1.25, CENTER - 1.25);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
