/* Classic worker: the pinned MediaPipe IIFE loads its WASM with importScripts. */
importScripts('../vendor/vision/vision_bundle.js');
let landmarker, extractEyeFeatures;

self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      ({ extractEyeFeatures } = await import('./eye-features.js'));
      const files = await Vision.FilesetResolver.forVisionTasks(new URL('../vendor/vision/wasm/', self.location.href).href, false);
      const options = {
        baseOptions: { modelAssetPath: new URL('../assets/models/face_landmarker.task', self.location.href).href, delegate: 'GPU' },
        runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true, minFaceDetectionConfidence: .6,
        minFacePresenceConfidence: .6, minTrackingConfidence: .6,
        canvas: new OffscreenCanvas(640, 480),
      };
      let delegate='GPU';
      try { landmarker=await Vision.FaceLandmarker.createFromOptions(files, options); }
      catch {
        delegate='CPU'; options.baseOptions.delegate='CPU';
        landmarker=await Vision.FaceLandmarker.createFromOptions(files, options);
      }
      self.postMessage({ type:'ready', delegate });
    } catch (error) { self.postMessage({ type:'error', message:error.message }); }
  } else if (data.type === 'frame') {
    const { bitmap, time }=data;
    try {
      if (!landmarker) throw new Error('Vision model is not ready');
      const result=landmarker.detectForVideo(bitmap,time);
      self.postMessage({type:'sample',time,...extractEyeFeatures(result,bitmap.width,bitmap.height)});
    } catch (error) { self.postMessage({type:'sample',time,valid:false,reason:'inference',message:error.message}); }
    finally { bitmap.close(); }
  }
};
