export const WORLD = Object.freeze({
  halfWidth: 4, length: 18, speed: 2.7, eyeHeight: 1.62,
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

export const CARRIAGES = Object.freeze([
  ['00','자궁 · 탄생'],['01','병원'],['02','유년의 집'],['03','놀이터'],['04','카페'],
  ['05','숲'],['06','병원 · 임종'],['07','향이 놓인 자리'],
  ['08','연인의 거리'],['09','함께 살던 집'],['10','숲'],
  ['11','미술관'],['12','전망 마당'],['13','병원 · 임종'],['14','향이 놓인 자리'],
].map(([id,title])=>Object.freeze({id,title,implemented:Number(id)<=7})));

export const JOURNEY_ORDER = Object.freeze(CARRIAGES.filter(car=>car.implemented).map(car=>car.id));

export const TRAIN = Object.freeze({
  approachLength:12.2, approachHalfWidth:2.4, doorHalfWidth:.54,
  exteriorStartZ:6, nearSideZ:-6, centerZ:-7.9, floorY:1.05,
  stairStart:9.8, boardingSeconds:1.65,
  interiorStartX:-.65, interiorLength:4.8, exitLength:10.8, interiorHalfWidth:.78,
  scenerySpeed:1.6,
});

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
