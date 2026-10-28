// Classic worker: MediaPipe's WASM loader uses importScripts().
let detector;
self.onmessage = async ({data}) => {
  try {
    if (data.type === 'init') {
      const {FilesetResolver, HandLandmarker} = await import('../vendor/mediapipe/vision_bundle.mjs');
      const root = new URL('../vendor/mediapipe/', self.location.href);
      const files = await FilesetResolver.forVisionTasks(new URL('wasm', root).href);
      detector = await HandLandmarker.createFromOptions(files, {
        baseOptions:{modelAssetPath:new URL('hand_landmarker.task', root).href, delegate:'CPU'},
        runningMode:'VIDEO', numHands:2,
        minHandDetectionConfidence:.5, minHandPresenceConfidence:.5, minTrackingConfidence:.5
      });
      self.postMessage({type:'ready'});
    } else if (data.type === 'frame') {
      try {
        const result = detector.detectForVideo(data.bitmap, data.time);
        self.postMessage({type:'result', time:data.time, landmarks:result.landmarks,
          world:result.worldLandmarks, handedness:result.handedness});
      } finally { data.bitmap.close(); }
    }
  } catch (error) {
    self.postMessage({type:'error', message:String(error.message || error)});
  }
};
