# 정적 자산 출처

- `models/face_landmarker.task`: Google MediaPipe Face Landmarker, float16, 모델 버전 1.
  원본: https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
- `films/resonance.mp4`, `films/afterimage.mp4`: 이 저장소의 `scripts/create-media.py`가 생성하는 원본 임시 작품. 960×540, 24fps, 12초, H.264 + AAC. 외부 영상이나 음악을 재사용하지 않는다.
- `films/ready.mp4`: 같은 스크린용 비디오 요소의 재생 권한을 준비하는 0.25초 무음 파일.
- `../vendor/three/`: npm `three@0.187.0`의 미변경 배포 파일. MIT 라이선스 파일을 포함한다.
- `../vendor/vision/`: npm `@mediapipe/tasks-vision@1.2.2`의 미변경 IIFE와 WASM 런타임. Google MediaPipe Apache-2.0 라이선스 파일을 포함한다.

파일 크기와 SHA-256은 `manifest.json`에 기록한다. 테스트에서만 사용하는 공개 얼굴 이미지는 `.cache/fixtures/`에 다운로드하며 관람용 배포 자산에는 포함하지 않는다.

- `films/planet-womb.mp4`: 사용자가 제공하고 이번 도입부 재생에 사용을 허용한 `행성-자궁.mp4` 원본. `films/planet-womb.jpg`는 해당 영상의 첫 프레임.
