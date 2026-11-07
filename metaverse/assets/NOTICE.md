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

`src/journey-audio.js`가 `audio/`의 12개 로컬 파일을 사용한다. 도입 영상 자체는 무음이며 도입 소리를 별도 동기화한다.

- `prologue.mp3`: 도입 영상 동기화.
- `train-horn.mp3`, `carriage-door.wav`: 탑승과 칸 전환 효과음.
- `hospital.mp3`, `home.wav`, `playground.wav`, `cafe.wav`, `forest.wav`, `incense.wav`: 해당 객차의 반복 소리.
- `ash.wav`: 이전 피날레 효과음으로 보존하며 현재는 재생하지 않는다.
- `death-hospital.mp3`: 06 임종 칸 전용 반복음. 사용자가 교체용으로 제공한 `SFX27_B_병원_mix_2.mp3`를 변환 없이 복사했다. 01 병원과 별도의 클립으로 재생한다.

이 목록은 코드의 사용처를 설명한다. 저장소에 원저작자·라이선스·외부 원본 URL의 개별 메타데이터는 기록되어 있지 않으므로 이를 추정해 기재하지 않는다. 배포 시 `audio/`도 포함해야 하며 `npm run media`는 이 파일들을 생성하지 않는다.

- `hospital.mp3`: 01 병원 칸 전용 반복음. 사용자가 제공한 `~/Downloads/SFX27_B_병원_mix.mp3`를 변환 없이 복사했다. 기존 `hospital.wav`는 보존하지만 현재 재생하지 않는다.


## 향 피날레 영상

- `films/incense-ending.mp4`: 사용자가 07 마지막 전환·색·구도의 기준으로 제공하고 재생을 요청한 `향2.mp4` 원본. 약 5.03초, 1280×720, 24fps, 오디오 포함. 변환 없이 복사했다.
- `films/incense-ending-first.png`: 첫 프레임. 포스터와 3D 비교 기준.
- `films/incense-ending-last.png`: 4.8초 프레임. 동작 줄이기의 정지 장면.
- 세 자산은 `manifest.json`에 포함한다. 영상은 항상 음소거하며 `incense.wav`를 별도로 유지한다. `incense.wav`는 사용자가 지정한 `SFX30_B_향.wav`와 바이트가 동일하다. 영상 전환·동작 줄이기·실패 복구에서 음원을 교체하거나 재시작하지 않는다.


- `audio/footsteps.wav`: 사용자가 제공한 `~/Downloads/footstep_2.wav`를 변환 없이 복사했다. 48kHz·24bit·스테레오, 약 13.67초. 이동 시 반복 재생하며 초기 볼륨은 18%다. 원본 파일의 볼륨·속도는 가공하지 않았다.

- `audio/playground-second.mp3`: 사용자 제공 `SFX11_B_놀이터_아이웃음2.mp3` 원본을 변환 없이 복사했다. MP3·48kHz·스테레오, 약 8.09초. 놀이터 두 번째 대상 소멸 시작 시 기존 놀이터 소리를 대체해 반복 재생한다.


## Blender 숲 모델

`models/forest.glb`는 사용자가 제공한 `숲.glb`의 웹용 사본이다. Blender 객차·주요 대상 메시·씬 구조를 보존하며 반복된 먼 소나무만 원본 메시 기반 저해상도 인덱스로 줄였다. 내장 텍스처를 4096→2048px로 축소하고 잘못된 texCoord=-1을 기본 UV 세트로 정리했다. 단순화 후 사용하지 않는 정점과 버퍼를 추가로 제거하며, 렌더되는 삼각형은 그대로 유지한다. 원본 해시·준비 명령·런타임 배치 및 재질 차이는 [숲 문서](../docs/forest-reference.md)에 기록한다.

`vendor/three/addons/`의 GLTFLoader·BufferGeometryUtils·SkeletonUtils는 Three.js 0.187.0 배포 파일이며 MIT 라이선스를 따른다. 정적 서비스 호환을 위해 `from 'three'`만 상대경로로 변경했다.
