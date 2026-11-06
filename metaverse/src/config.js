export const WORLD = Object.freeze({
  halfWidth: 4, length: 18, speed: 0.9, eyeHeight: 1.62,
  yawLimit: Math.PI / 3, pitchLimit: Math.PI / 9,
  yawSpeed: 0.42, pitchSpeed: 0.25, deadZone: 0.16,
  inputGraceMs: 250, inputFreshMs: 180, smoothingSeconds: 0.14,
  alignmentSeconds: 1.5,
});

export const CALIBRATION = Object.freeze({
  settleMs: 650, captureMs: 1000, minSamples: 12, timeoutMs: 10000,
  training: [[.5,.5],[.15,.2],[.85,.8],[.85,.2],[.15,.8],[.5,.2],[.15,.5],[.85,.5],[.5,.8]],
  validation: [[.22,.34],[.78,.66],[.5,.34],[.22,.66],[.78,.34],[.5,.66]],
  maxMedianError: 0.16, maxPointError: 0.24, minRegionAccuracy: 5 / 6,
});

export const WORKS = Object.freeze([
  { id: 'left', title: '빛이 머무는 자리', subtitle: 'STUDY 01 · RESONANCE', src: new URL('../assets/films/resonance.mp4', import.meta.url).href },
  { id: 'right', title: '느리게 번지는 물결', subtitle: 'STUDY 02 · AFTERIMAGE', src: new URL('../assets/films/afterimage.mp4', import.meta.url).href },
]);

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
