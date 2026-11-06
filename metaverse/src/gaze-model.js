import { CALIBRATION, clamp } from './config.js';
import { steeringAxis } from './navigation.js';

export const median = values => {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a,b) => a-b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle-1] + sorted[middle]) / 2;
};
const average = values => values.reduce((sum, v) => sum + v, 0) / values.length;
const region = x => {
  const axis = steeringAxis(x);
  return Math.abs(axis) < 1e-6 ? 0 : Math.sign(axis);
};

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

const terms=(features,mean,scale,kind)=>{
  const x=(features[0]-mean[0])/scale[0],y=(features[1]-mean[1])/scale[1];
  return kind==='affine'?[1,x,y]:[1,x,y,x*y,x*x,y*y];
};

function fitRegression(points,kind,penalty) {
  const mean=[0,1].map(i=>average(points.map(point=>point.features[i])));
  const scale=[0,1].map(i=>Math.max(1e-6,Math.sqrt(average(points.map(point=>(point.features[i]-mean[i])**2)))));
  const design=points.map(point=>terms(point.features,mean,scale,kind));
  const size=design[0].length;
  const normal=Array.from({length:size},(_,i)=>Array.from({length:size},(_,j)=>design.reduce((sum,row)=>sum+row[i]*row[j],0)+(i===j?(i===0?.00001:penalty):0)));
  const coefficients=[0,1].map(axis=>solve(normal,Array.from({length:size},(_,i)=>design.reduce((sum,row,k)=>sum+row[i]*points[k].target[axis],0))));
  return {mean,scale,coefficients,predict:features=>{
    const row=terms(features,mean,scale,kind);
    return coefficients.map(axis=>axis.reduce((sum,value,i)=>sum+value*row[i],0));
  }};
}

// Model selection uses only the nine TRAINING targets. The independent six-point
// validation (and its recheck) is never used to fit or choose a model.
function chooseRegression(points) {
  const candidates=[{kind:'affine',penalty:.025},{kind:'quadratic',penalty:.025},{kind:'quadratic',penalty:.25}];
  let best=null;
  for(const candidate of candidates){
    const errors=points.map((point,index)=>{
      const model=fitRegression(points.filter((_,i)=>i!==index),candidate.kind,candidate.penalty);
      const prediction=model.predict(point.features);
      return Math.hypot(prediction[0]-point.target[0],prediction[1]-point.target[1]);
    });
    const score=median(errors)+.35*Math.max(...errors);
    // Prefer the simpler map when the more complex one has no meaningful advantage.
    if(Number.isFinite(score)&&(!best||score+.005<best.score))best={...candidate,score};
  }
  if(!best)throw new Error('눈과 화면의 관계를 안정적으로 맞추지 못했어요. 다시 점을 바라봐 주세요.');
  return {...best,...fitRegression(points,best.kind,best.penalty)};
}

export class GazeModel {
  constructor() { this.ready = false; }
  basis(features) {
    return terms(features,this.mean,this.scale,this.modelType);
  }
  fit(groups) {
    this.ready = false;
    if (groups.length < 9 || groups.some(g => g.samples.length < CALIBRATION.minSamples)) throw new Error('보정에 필요한 눈 데이터가 부족해요.');
    const points=groups.map(g => ({ target:g.target, features:[0,1].map(i=>median(g.samples.map(s=>s.features[i]))) }));
    this.mean=[0,1].map(i=>average(points.map(p=>p.features[i])));
    this.scale=[0,1].map(i=>Math.sqrt(average(points.map(p=>(p.features[i]-this.mean[i])**2))));
    if (this.scale[0] < .009 || this.scale[1] < .004 || this.scale.some(v=>!Number.isFinite(v))) throw new Error('시선 변화가 너무 작게 잡혔어요. 고개를 고정하고 점을 바라봐 주세요.');
    const selected=chooseRegression(points);
    this.mean=selected.mean;this.scale=selected.scale;this.coefficients=selected.coefficients;
    this.modelType=selected.kind;this.trainingCvError=selected.score;
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
  clear() { this.ready=false; this.coefficients=null; this.pose=null;this.modelType=null;this.trainingCvError=null; }
}

export function validateGaze(groups) {
  if (groups.length!==CALIBRATION.validation.length || groups.some(g=>!g||g.predictions.length<CALIBRATION.minSamples)) {
    return { passed:false, code:'samples', retryIndices:[], reason:'검증 중 눈을 안정적으로 읽지 못했어요.' };
  }
  const points=groups.map((group,index)=>{
    const x=median(group.predictions.map(p=>p.x)),y=median(group.predictions.map(p=>p.y));
    return {
      index,
      error:Math.hypot(x-group.target[0],y-group.target[1]),
      directionMatches:region(x)===region(group.target[0]),
      jitter:median(group.predictions.map(p=>Math.hypot(p.x-x,p.y-y))),
    };
  });
  const medianError=median(points.map(p=>p.error)),maxPointError=Math.max(...points.map(p=>p.error));
  const accuracy=points.filter(p=>p.directionMatches).length/points.length;
  const jitter=median(points.map(p=>p.jitter));
  const finite=points.every(p=>Number.isFinite(p.error)&&Number.isFinite(p.jitter));
  const passed=finite && medianError<=CALIBRATION.maxMedianError && maxPointError<=CALIBRATION.maxPointError
    && accuracy>=CALIBRATION.minRegionAccuracy && jitter<CALIBRATION.maxJitter;
  // Preserve the same error/jitter limits. Re-measure isolated bad points once instead
  // of discarding a good calibration; validation targets never become training data.
  const questionable=points.filter(p=>!p.directionMatches||p.error>CALIBRATION.maxPointError
    ||(medianError>CALIBRATION.maxMedianError&&p.error>CALIBRATION.maxMedianError)
    ||(jitter>=CALIBRATION.maxJitter&&p.jitter>=CALIBRATION.maxJitter));
  const retryIndices=!passed&&finite&&questionable.length>0&&questionable.length<=CALIBRATION.maxRetryPoints
    ? questionable.map(p=>p.index) : [];
  const code=passed?'passed':!finite?'invalid':accuracy<CALIBRATION.minRegionAccuracy?'direction'
    :jitter>=CALIBRATION.maxJitter?'unstable':'position';
  const reasons={
    invalid:'시선 값을 정상적으로 읽지 못했어요. 다시 맞춰 주세요.',
    direction:'왼쪽·중앙·오른쪽 시선을 안정적으로 구분하지 못했어요. 고개를 편하게 고정하고 다시 맞춰 주세요.',
    unstable:'같은 점을 바라볼 때 시선 값이 많이 흔들렸어요. 얼굴을 밝게 비추고 다시 맞춰 주세요.',
    position:'추정한 시선 위치가 표시된 점과 많이 달랐어요. 화면과 자세를 고정한 뒤 다시 맞춰 주세요.',
  };
  return { passed, code, medianError, maxPointError, regionAccuracy:accuracy, jitter, retryIndices, reason:passed?'':reasons[code] };
}
