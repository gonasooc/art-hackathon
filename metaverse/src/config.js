export const WORLD = Object.freeze({
  halfWidth: 4, length: 18, speed: 0.9, eyeHeight: 1.62,
  yawLimit: Math.PI / 3, pitchLimit: Math.PI / 9,
  yawSpeed: 0.42, pitchSpeed: 0.25, deadZone: 0.16,
  inputGraceMs: 250, inputFreshMs: 180, smoothingSeconds: 0.14,
  alignmentSeconds: 1.5,
});

export const CALIBRATION = Object.freeze({
  settleMs: 900, captureMs: 1000, minSamples: 12, timeoutMs: 10000,
  firstSettleMs: 1800,
  training: [[.5,.5],[.15,.2],[.85,.8],[.85,.2],[.15,.8],[.5,.2],[.15,.5],[.85,.5],[.5,.8]],
  validation: [[.22,.34],[.78,.66],[.5,.34],[.22,.66],[.78,.34],[.5,.66]],
  maxMedianError: 0.16, maxPointError: 0.24, minRegionAccuracy: 5 / 6,
  maxJitter: 0.12, maxRetryPoints: 2, maxValidationRetries: 1, retrySettleMs: 1000,
});

export const WORKS = Object.freeze([
  { id: '00', title: '첫 숨이 되기 전', subtitle: 'CAR 00 · ORIGIN', src: new URL('../assets/films/resonance.mp4', import.meta.url).href },
]);

export const CARRIAGES = Object.freeze([
  ['00','병원 · 탄생'],['01','유년의 집'],['02','놀이터'],['03','학교'],
  ['04','카페'],['05','연인의 거리'],['06','함께 살던 집'],['07','숲'],
  ['08','미술관'],['09','전망 마당'],['10','병원 · 임종'],['11','향이 놓인 자리'],
].map(([id,title])=>Object.freeze({id,title,implemented:id==='00'})));

export const TRAIN = Object.freeze({
  approachLength:12.2, approachHalfWidth:2.4, doorHalfWidth:.54,
  exteriorStartZ:6, nearSideZ:-6, centerZ:-7.9, floorY:1.05,
  stairStart:9.8, boardingSeconds:1.65,
  interiorStartX:-.65, interiorLength:10.8, interiorHalfWidth:.78,
  memoryX:-14, memoryY:2.45,
  scenerySpeed:1.6,
});

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
