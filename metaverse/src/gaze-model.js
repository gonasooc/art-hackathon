import { CALIBRATION, clamp } from './config.js';

export const median = values => {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a,b) => a-b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle-1] + sorted[middle]) / 2;
};
const average = values => values.reduce((sum, v) => sum + v, 0) / values.length;
const region = x => x < .36 ? 0 : x > .64 ? 2 : 1;

function solve(matrix, vector) {
  const a = matrix.map((row,i) => [...row, vector[i]]), n = vector.length;
  for (let c=0; c<n; c++) {
    let pivot = c;
    for (let r=c+1; r<n; r++) if (Math.abs(a[r][c]) > Math.abs(a[pivot][c])) pivot=r;
    [a[c], a[pivot]] = [a[pivot], a[c]];
    if (Math.abs(a[c][c]) < 1e-10) throw new Error('눈의 움직임을 충분히 구분하지 못했어요.');
    const divisor = a[c][c];
    for (let j=c; j<=n; j++) a[c][j] /= divisor;
    for (let r=0; r<n; r++) {
      if (r === c) continue;
      const factor=a[r][c];
      for (let j=c; j<=n; j++) a[r][j] -= factor*a[c][j];
    }
  }
  return a.map(row => row[n]);
}

export class GazeModel {
  constructor() { this.ready = false; }
  basis(features) {
    const x=(features[0]-this.mean[0])/this.scale[0], y=(features[1]-this.mean[1])/this.scale[1];
    return [1,x,y,x*y,x*x,y*y];
  }
  fit(groups) {
    this.ready = false;
    if (groups.length < 9 || groups.some(g => g.samples.length < CALIBRATION.minSamples)) throw new Error('보정에 필요한 눈 데이터가 부족해요.');
    const points=groups.map(g => ({ target:g.target, features:[0,1].map(i=>median(g.samples.map(s=>s.features[i]))) }));
    this.mean=[0,1].map(i=>average(points.map(p=>p.features[i])));
    this.scale=[0,1].map(i=>Math.sqrt(average(points.map(p=>(p.features[i]-this.mean[i])**2))));
    if (this.scale[0] < .009 || this.scale[1] < .004 || this.scale.some(v=>!Number.isFinite(v))) throw new Error('시선 변화가 너무 작게 잡혔어요. 고개를 고정하고 점을 바라봐 주세요.');
    const design=points.map(p=>this.basis(p.features));
    const normal=Array.from({length:6},(_,i)=>Array.from({length:6},(_,j)=>design.reduce((sum,row)=>sum+row[i]*row[j],0)+(i===j ? (i===0 ? .00001 : .025) : 0)));
    this.coefficients=[0,1].map(axis=>solve(normal, Array.from({length:6},(_,i)=>design.reduce((sum,row,k)=>sum+row[i]*points[k].target[axis],0))));
    const all=groups.flatMap(g=>g.samples);
    this.pose=Array.from({length:5},(_,i)=>median(all.map(s=>s.pose[i])));
    this.ready=true;
    return this;
  }
  predict(features) {
    if (!this.ready || features?.length!==2 || features.some(v=>!Number.isFinite(v))) return null;
    const basis=this.basis(features);
    const [x,y]=this.coefficients.map(coeff=>coeff.reduce((sum,v,i)=>sum+v*basis[i],0));
    if (![x,y].every(Number.isFinite) || x<-.3 || x>1.3 || y<-.3 || y>1.3) return null;
    return { x:clamp(x,0,1), y:clamp(y,0,1) };
  }
  poseMatches(pose) {
    if (!this.ready || !pose || pose.some(v=>!Number.isFinite(v))) return false;
    return Math.abs(pose[0]-this.pose[0])<.055 && Math.abs(pose[1]-this.pose[1])<.065
      && Math.abs(pose[2]/this.pose[2]-1)<.2 && Math.abs(pose[3]-this.pose[3])<.16 && Math.abs(pose[4]-this.pose[4])<.16;
  }
  clear() { this.ready=false; this.coefficients=null; this.pose=null; }
}

export function validateGaze(groups) {
  if (groups.length!==CALIBRATION.validation.length || groups.some(g=>g.predictions.length<CALIBRATION.minSamples)) return { passed:false, reason:'검증 중 눈을 안정적으로 읽지 못했어요.' };
  const points=groups.map(g=>({ target:g.target, x:median(g.predictions.map(p=>p.x)), y:median(g.predictions.map(p=>p.y)) }));
  const errors=points.map(p=>Math.hypot(p.x-p.target[0],p.y-p.target[1]));
  const accuracy=points.filter(p=>region(p.x)===region(p.target[0])).length/points.length;
  const jitter=median(groups.map(g=>median(g.predictions.map(p=>Math.hypot(p.x-median(g.predictions.map(v=>v.x)),p.y-median(g.predictions.map(v=>v.y)))))));
  const passed=errors.every(Number.isFinite) && median(errors)<=CALIBRATION.maxMedianError
    && Math.max(...errors)<=CALIBRATION.maxPointError && accuracy>=CALIBRATION.minRegionAccuracy && jitter<.12;
  return { passed, medianError:median(errors), regionAccuracy:accuracy, jitter, reason:passed ? '' : '시선 위치를 충분히 구분하지 못했어요. 밝은 곳에서 화면과 자세를 고정한 뒤 다시 맞춰 주세요.' };
}
