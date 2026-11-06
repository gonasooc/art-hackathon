const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);

export function extractEyeFeatures(result, width=640, height=480) {
  const landmarks=result.faceLandmarks?.[0];
  if (!landmarks || landmarks.length<478) return { valid:false, reason:'face' };
  const point=i=>({x:landmarks[i].x*width,y:landmarks[i].y*height});
  const scores=Object.fromEntries((result.faceBlendshapes?.[0]?.categories || []).map(c=>[c.categoryName,c.score]));
  const eyes=[[33,133,468,159,145],[362,263,473,386,374]].map(([a,b,iris,upper,lower])=>{
    const start=point(a),end=point(b),pupil=point(iris), span=distance(start,end);
    const ux=(end.x-start.x)/span,uy=(end.y-start.y)/span;
    const dx=pupil.x-(start.x+end.x)/2,dy=pupil.y-(start.y+end.y)/2;
    return { x:(dx*ux+dy*uy)/span, y:(-dx*uy+dy*ux)/span, openness:distance(point(upper),point(lower))/span, span };
  });
  if (eyes.some(e=>!Number.isFinite(e.x)||!Number.isFinite(e.y)||e.span<14)) return {valid:false,reason:'distance'};
  if ((scores.eyeBlinkLeft ?? 0)>.48 || (scores.eyeBlinkRight ?? 0)>.48 || eyes.some(e=>e.openness<.12)) return {valid:false,reason:'blink',blinkClosed:((scores.eyeBlinkLeft??0)>.48&&(scores.eyeBlinkRight??0)>.48)||eyes.every(e=>e.openness<.12)};
  const nose=landmarks[1],faceWidth=Math.abs(landmarks[454].x-landmarks[234].x);
  const matrix=result.facialTransformationMatrixes?.[0]?.data;
  const pose=[nose.x,nose.y,faceWidth,matrix?.[2] ?? 0,matrix?.[6] ?? 0];
  if (pose.some(v=>!Number.isFinite(v)) || faceWidth<.15 || faceWidth>.65) return {valid:false,reason:'distance'};
  return { valid:true, features:[(eyes[0].x+eyes[1].x)/2,(eyes[0].y+eyes[1].y)/2], pose };
}
