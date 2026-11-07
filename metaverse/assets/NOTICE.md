# 정적 자산 출처

- `models/face_landmarker.task`: Google MediaPipe Face Landmarker, float16, 모델 버전 1.
  원본: https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
- `films/resonance.mp4`, `films/afterimage.mp4`: 이 저장소의 `scripts/create-media.py`가 생성하는 과거 시제품용 임시 작품. 현재 관객 흐름에서는 재생하지 않는다. 960×540, 24fps, 12초, H.264 + AAC. 외부 영상이나 음악을 재사용하지 않는다.
- `films/ready.mp4`: 과거 스크린용 비디오 요소의 재생 권한을 준비하던 0.25초 무음 파일. 현재 도입에는 사용하지 않는다.
- `../vendor/three/`: npm `three@0.187.0`의 미변경 배포 파일. MIT 라이선스 파일을 포함한다.
- `../vendor/vision/`: npm `@mediapipe/tasks-vision@1.2.2`의 미변경 IIFE와 WASM 런타임. Google MediaPipe Apache-2.0 라이선스 파일을 포함한다.

`scripts/build.mjs`가 명시한 vendor·모델·영상·기차 텍스처의 파일 크기와 SHA-256은 `manifest.json`에 기록한다. 아래 오디오 파일은 현재 이 매니페스트에 포함되지 않는다. 테스트에서만 사용하는 공개 얼굴 이미지는 `.cache/fixtures/`에 다운로드하며 관람용 배포 자산에는 포함하지 않는다.

- `films/planet-womb.mp4`: 사용자가 제공하고 이번 도입부 재생에 사용을 허용한 `행성-자궁.mp4` 원본. `films/planet-womb.jpg`는 해당 영상의 첫 프레임.


## 현재 오디오

`src/journey-audio.js`가 `audio/`의 11개 로컬 파일을 사용한다. 도입 영상 자체는 무음이며 도입 소리를 별도 동기화한다.

- `prologue.mp3`: 도입 영상 동기화.
- `train-horn.mp3`, `carriage-door.wav`: 탑승과 칸 전환 효과음.
- `hospital.wav`, `home.wav`, `playground.wav`, `cafe.wav`, `forest.wav`, `incense.wav`: 해당 객차의 반복 소리.
- `ash.wav`: 마지막 연기 글씨 구간.
- `death-hospital.mp3`: 06 임종 칸 전용 반복음. 사용자가 교체용으로 제공한 `SFX27_B_병원_mix_2.mp3`를 변환 없이 복사했다. 01 병원의 `hospital.wav`는 유지한다.

이 목록은 코드의 사용처를 설명한다. 저장소에 원저작자·라이선스·외부 원본 URL의 개별 메타데이터는 기록되어 있지 않으므로 이를 추정해 기재하지 않는다. 배포 시 `audio/`도 포함해야 하며 `npm run media`는 이 파일들을 생성하지 않는다.
