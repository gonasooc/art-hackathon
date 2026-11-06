import { scenes, DURATION } from './timeline.js';
import { typingPlanFor } from './typing.js';
import { synthesizeKeyboard } from './keyboard.js';

// Original synthetic sound design for the prototype, not recordings of artists.
// The four-note motif returns, uninterrupted, with the music result.
export const AUDIO_DURATION = DURATION;
export const musicMotif = Object.freeze([146.832, 220, 174.614, 195.998]);

const events = [];
const add = (at, type, duration, velocity, frequency = 0, pan = 0, detail = {}) => {
  events.push({ at, type, duration, velocity, frequency, pan, seed: events.length + 71, ...detail });
};
const inScene = (scene, offset, type, duration, velocity, frequency = 0, pan = 0, detail = {}) => {
  const at = Number((scene.start + offset).toFixed(6));
  // Include the entire release, not just the note's onset. The short margin
  // also accounts for the audio scheduler's initial 16 ms offset.
  const boundedDuration = Math.min(duration, scene.end - 0.03 - at);
  if (at < scene.start || boundedDuration < 0.01) return;
  add(at, type, boundedDuration, velocity, frequency, pan, { sceneId: scene.id, ...detail });
};
const phrase = (scene, offset, count, interval = 0.54, velocity = 0.23) => {
  for (let i = 0; i < count; i++) {
    inScene(scene, offset + i * interval, 'pluck', 1.15, velocity, musicMotif[i % musicMotif.length], 0.12);
  }
};

add(0, 'click', 0.095, 0.38, 0, 0, { sceneId: 'waiting' });
for (const scene of scenes) {
  if (scene.type === 'process') {
    if (scene.material === 'code') {
      typingPlanFor(scene).forEach((cue, index) => {
        inScene(scene, cue.at - scene.start, 'type', 0.07, 0.17 + (index % 3) * 0.012, 0, -0.08,
          { typingProgress: cue.progress });
      });
    } else if (scene.material === 'stage') {
      const begin = scene.pass ? 0.12 : 0.6;
      const count = scene.pass ? 9 : 8;
      for (let i = 0; i < count; i++) inScene(scene, begin + i * 0.18, 'type', 0.065, 0.12 + (i % 2) * 0.02, 0, -0.18);
      inScene(scene, scene.pass ? 1.8 : 2.5, 'scratch', 0.5, 0.055, 0, -0.16);
    } else if (scene.material === 'paint') {
      inScene(scene, 0.15, 'brush', 1.05, 0.09, 0, 0.15);
      inScene(scene, scene.pass ? 1.35 : 1.75, 'brush', 0.85, 0.065, 0, -0.12);
    } else if (scene.material === 'fashion') {
      inScene(scene, 0.16, 'scratch', 0.55, 0.07, 0, 0.12);
      inScene(scene, scene.pass ? 0.88 : 1.45, 'scratch', 0.65, 0.055, 0, -0.12);
    } else if (scene.material === 'music') {
      phrase(scene, scene.pass ? 0.08 : 0.15, 3, scene.pass ? 0.39 : 0.54);
    }
  } else if (scene.type === 'echoes') {
    inScene(scene, 0.06, 'brush', 0.8, 0.05, 0, -0.15);
    [0.8, 0.94, 1.1, 1.23].forEach(offset => inScene(scene, offset, 'type', 0.065, 0.1));
    inScene(scene, 1.55, 'scratch', 0.6, 0.045);
  } else if (scene.type === 'result') {
    if (scene.material === 'stage') {
      inScene(scene, 0.2, 'room', 2.3, 0.03, 0, -0.15);
      inScene(scene, 3.3, 'room', 1.7, 0.026, 0, 0.15);
    } else if (scene.material === 'music') {
      phrase(scene, 0.15, 4, 0.64, 0.29);
      phrase(scene, 3, 4, 0.64, 0.27);
      inScene(scene, 5.9, 'pluck', 1.3, 0.24, musicMotif[1], -0.08);
      inScene(scene, 6.55, 'pluck', 1.25, 0.25, musicMotif[2], 0.08);
      inScene(scene, 7.2, 'pluck', 1.3, 0.25, musicMotif[0]);
    } else if (scene.material === 'paint') {
      inScene(scene, 0.8, 'brush', 0.9, 0.06, 0, -0.2);
      inScene(scene, 3.2, 'brush', 1.05, 0.05, 0, 0.2);
    } else if (scene.material === 'fashion') {
      inScene(scene, 0.4, 'scratch', 0.65, 0.04, 0, -0.12);
      inScene(scene, 2.4, 'room', 1.6, 0.022);
    }
    // The portfolio result is a still image: no off-screen keyboard typing.
  }
}

export const audioEvents = Object.freeze(
  events.sort((a, b) => a.at - b.at).map((event) => Object.freeze(event)),
);

const clampTime = (value) => Math.min(AUDIO_DURATION, Math.max(0, Number.isFinite(value) ? value : 0));
const MASTER_LEVEL = 0.72;
const LOOKAHEAD = 0.115;

export class Soundtrack {
  constructor() {
    this._Context = globalThis.AudioContext || globalThis.webkitAudioContext || null;
    this._context = null;
    this._master = null;
    this._unlockPromise = null;
    this._running = false;
    this._muted = false;
    this._offset = 0;
    this._origin = 0;
    this._firstStart = 0;
    this._cursor = 0;
    this._timer = null;
    this._generation = 0;
    this._voices = new Set();
    this._buffers = new Map();
  }

  // Call from a click/key event. No other method creates or resumes a context.
  async unlock() {
    if (!this._Context) return false;
    if (this._unlockPromise) return this._unlockPromise;
    this._unlockPromise = this._unlock();
    try {
      return await this._unlockPromise;
    } finally {
      this._unlockPromise = null;
    }
  }

  async _unlock() {
    try {
      if (!this._context || this._context.state === 'closed') {
        this._context = new this._Context({ latencyHint: 'interactive' });
        this._buffers.clear();
        this._master = this._context.createGain();
        this._master.gain.value = this._muted ? 0 : MASTER_LEVEL;
        this._master.connect(this._context.destination);
      }
      if (this._context.state !== 'running') {
        let timeout;
        try {
          // Some browsers leave resume pending when audio is disallowed.
          // The visual experience must still be able to start silently.
          await Promise.race([
            this._context.resume(),
            new Promise((resolve) => { timeout = setTimeout(resolve, 900); }),
          ]);
        } finally {
          clearTimeout(timeout);
        }
      }
      return this._context.state === 'running';
    } catch {
      return false;
    }
  }

  start(offsetSeconds = 0) {
    this._halt();
    this._offset = clampTime(offsetSeconds);
    if (!this._context || this._context.state !== 'running' || this._offset >= AUDIO_DURATION) return false;
    this._running = true;
    this._firstStart = this._context.currentTime + 0.016;
    this._origin = this._firstStart - this._offset;
    this._cursor = audioEvents.findIndex((event) => event.at + event.duration > this._offset);
    if (this._cursor === -1) this._cursor = audioEvents.length;
    const generation = this._generation;
    this._schedule(generation);
    if (!this._running || generation !== this._generation) return false;
    this._timer = setInterval(() => this._schedule(generation), 25);
    return true;
  }

  pause() {
    if (this._running) this._offset = this._position();
    this._halt();
    return this._offset;
  }

  resume(offsetSeconds = this._offset) {
    return this.start(offsetSeconds);
  }

  // Seeking while paused changes the cursor without starting sound.
  seek(offsetSeconds) {
    const wasRunning = this._running;
    this._halt();
    this._offset = clampTime(offsetSeconds);
    return wasRunning ? this.start(this._offset) : false;
  }

  setMuted(muted) {
    this._muted = Boolean(muted);
    if (!this._master || !this._context) return;
    const gain = this._master.gain;
    const now = this._context.currentTime;
    if (typeof gain.cancelAndHoldAtTime === 'function') gain.cancelAndHoldAtTime(now);
    else {
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(gain.value, now);
    }
    gain.linearRampToValueAtTime(this._muted ? 0 : MASTER_LEVEL, now + 0.035);
  }

  stop() {
    this._halt();
    this._offset = 0;
  }

  get state() {
    return {
      supported: Boolean(this._Context),
      unlocked: this._context?.state === 'running',
      running: this._running,
      muted: this._muted,
      position: this._running ? this._position() : this._offset,
      duration: AUDIO_DURATION,
      activeVoices: this._voices.size,
    };
  }

  _position() {
    return clampTime(Math.max(this._offset, this._context.currentTime - this._origin));
  }

  _halt() {
    this._generation += 1;
    this._running = false;
    if (this._timer !== null) clearInterval(this._timer);
    this._timer = null;
    // Includes sources already queued by the lookahead scheduler.
    for (const voice of [...this._voices]) {
      try { voice.source.stop(); } catch { /* An ended source is already silent. */ }
      voice.cleanup();
    }
  }

  _schedule(generation) {
    if (!this._running || generation !== this._generation) return;
    const now = this._context.currentTime;
    const position = this._position();
    if (position >= AUDIO_DURATION) {
      this._halt();
      this._offset = AUDIO_DURATION;
      return;
    }
    while (this._cursor < audioEvents.length) {
      const event = audioEvents[this._cursor];
      if (event.at > position + LOOKAHEAD) break;
      this._cursor += 1;
      const when = Math.max(this._firstStart, now + 0.003, this._origin + event.at);
      const elapsed = Math.max(0, when - this._origin - event.at);
      // A delayed timer must not replay a backlog of expired gestures.
      if (elapsed >= event.duration - 0.005) continue;
      try {
        this._voice(event, when, elapsed);
      } catch {
        // Audio failure must not interrupt the visual artwork.
        this._halt();
        this._offset = position;
        return;
      }
    }
  }

  _voice(event, when, elapsed) {
    const context = this._context;
    const source = context.createBufferSource();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    const panner = typeof context.createStereoPanner === 'function' ? context.createStereoPanner() : null;
    const nodes = [source, gain, filter, panner].filter(Boolean);
    let cleaned = false;
    const voice = {
      source,
      cleanup: () => {
        if (cleaned) return;
        cleaned = true;
        source.onended = null;
        for (const node of nodes) node.disconnect();
        this._voices.delete(voice);
      },
    };
    this._voices.add(voice);
    try {
      source.buffer = this._buffer(event);
      filter.type = ['pluck', 'room', 'type'].includes(event.type) ? 'lowpass' : 'bandpass';
      filter.frequency.value = event.type === 'pluck' ? event.frequency * 8
        : event.type === 'room' ? 300
          : event.type === 'type' ? 6500
            : event.type === 'brush' ? 820
            : event.type === 'scratch' ? 1250 : 2100;
      filter.Q.value = 0.7;
      source.connect(filter);
      filter.connect(gain);
      if (panner) {
        panner.pan.value = event.pan;
        gain.connect(panner);
        panner.connect(this._master);
      } else gain.connect(this._master);

      // Buffers already contain their envelope. This tiny edge ramp prevents
      // a click when a seek enters the middle of a sound.
      const remaining = event.duration - elapsed;
      const attack = Math.min(event.type === 'type' && elapsed < 0.002 ? 0.0005 : 0.006, remaining / 3);
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(event.velocity, when + attack);
      gain.gain.setValueAtTime(event.velocity, when + Math.max(attack, remaining - 0.012));
      gain.gain.linearRampToValueAtTime(0, when + remaining);
      source.onended = voice.cleanup;
      source.start(when, elapsed, remaining);
    } catch (error) {
      voice.cleanup();
      throw error;
    }
  }

  _buffer(event) {
    const context = this._context;
    const key = `${event.type}:${event.frequency}:${event.duration}:${event.seed}`;
    if (this._buffers.has(key)) return this._buffers.get(key);
    const sampleRate = context.sampleRate;
    const length = Math.ceil(sampleRate * event.duration);
    const buffer = context.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    if (event.type === 'type') {
      data.set(synthesizeKeyboard({ sampleRate, length, seed: event.seed }));
      this._buffers.set(key, buffer);
      return buffer;
    }
    let seed = event.seed;
    const noise = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return (seed / 4294967296) * 2 - 1;
    };
    if (event.type === 'pluck') {
      // Karplus–Strong string: short excitation, then a damped delay line.
      const period = Math.max(2, Math.round(sampleRate / event.frequency));
      const ring = new Float32Array(period);
      for (let i = 0; i < period; i += 1) ring[i] = noise() * 0.8;
      let index = 0;
      for (let i = 0; i < length; i += 1) {
        const next = (index + 1) % period;
        const edge = Math.min(1, i / (sampleRate * 0.002), (length - i) / (sampleRate * 0.04));
        data[i] = ring[index] * edge;
        ring[index] = 0.498 * (ring[index] + ring[next]);
        index = next;
      }
    } else {
      let smoothed = 0;
      for (let i = 0; i < length; i += 1) {
        const time = i / sampleRate;
        const progress = i / length;
        const random = noise();
        const edge = Math.min(1, progress * 18, (1 - progress) * 10);
        if (event.type === 'click') {
          const thump = Math.sin(time * Math.PI * 2 * 360);
          data[i] = (random * 0.65 + thump * 0.35) * Math.exp(-time * 65) * Math.min(1, progress * 40);
        } else if (event.type === 'room') {
          smoothed = smoothed * 0.965 + random * 0.15;
          data[i] = smoothed * Math.sin(Math.PI * progress) * 0.8;
        } else {
          const grain = 0.35 + 0.65 * Math.pow(Math.sin(time * (event.type === 'brush' ? 13 : 43)), 2);
          data[i] = random * grain * edge;
        }
      }
    }
    this._buffers.set(key, buffer);
    return buffer;
  }
}
