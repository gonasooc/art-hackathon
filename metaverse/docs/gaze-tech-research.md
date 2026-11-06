# 웹캠 시선 추적 기술 조사 — MediaPipe 대안 검토

2026-11-06 · 현재 MediaPipe Face Landmarker 기반 시선 추적보다 최근 더 많이 쓰이거나 더 정확한 기술이 있는지 조사한 기록. [최종 기획](mvp-plan.md)과 현재 코드(`src/eye-features.js`, `src/gaze-model.js`, `src/vision-worker.js`)를 기준으로 했다.

## 결론

**MediaPipe를 유지하고 그 위의 단계를 개선한다.** 2025–2026년 기준으로 브라우저 웹캠 시선 추적에서 MediaPipe Face Landmarker를 대체할 만큼 더 널리 쓰이는 기술은 확인되지 않았다. 최신 연구와 오픈소스도 대부분 MediaPipe 랜드마크를 전처리로 쓰고, 그 위에 작은 CNN이나 회귀 단계를 얹는 하이브리드 방식이다.

## 조사 범위와 방법

- 조사 항목: 웹 시선 추적 라이브러리, 최신 딥러닝 시선 추정 모델과 브라우저 실행 가능성, MediaPipe의 위상, 랜드마크+회귀 방식과 end-to-end 방식의 정확도 비교, 하드웨어 등 기타 대안.
- 방법: 5개 항목을 병렬로 검색했다. 출처 19개에서 주장 92개를 뽑았고, 그중 25개를 3명이 독립적으로 반박을 시도하는 방식(3표 중 2표가 반박하면 기각)으로 검증했다. 23개가 확인되고 2개가 기각됐다.
- 신뢰도: **높음**은 1차 출처 여러 개가 일치하는 경우, **중간**은 단일 1차 출처, **낮음**은 표본이 작거나 출처 품질이 제한적인 경우다.

## 현재 구현 요약

- `@mediapipe/tasks-vision` 1.2.2 FaceLandmarker를 Web Worker에서 GPU delegate로 실행하고, 실패하면 CPU로 실행한다. 모델과 WASM은 로컬 정적 파일이다.
- 홍채 중심(468/473)의 위치를 눈꼬리(33/133, 362/263) 기준으로 정규화해 2D 특징을 만든다.
- 9점 보정과 2차 다항 릿지 회귀로 특징을 화면 좌표로 바꾼다. 보정에 쓰지 않은 6점으로 독립 검증한다. 기준은 중앙값 오차 ≤0.16(화면 비율)과 좌/중/우 3구역 정확도 ≥5/6이다.
- 깜빡임은 `eyeBlink` blendshape와 눈 뜸 정도로 감지한다. 머리 자세가 크게 바뀌면 일시정지한다.
- 필요한 것은 좌/중/우 구분, 지터 억제, 깜빡임 감지, 기기 내 처리다. 정밀한 픽셀 단위 응시점은 필요하지 않다.

## 주요 발견

### 1. MediaPipe는 여전히 표준 전처리 단계다 — 신뢰도 높음

최신 브라우저 시선 연구는 MediaPipe를 교체하지 않고 그 위에 시선 모델을 올린다.

- **WebEyeTrack(2025):** MediaPipe 랜드마크와 canonical face mesh로 눈 이미지를 잘라낸다. 눈 감음은 EAR로 판단하고, 머리 자세는 MediaPipe 변환 행렬에 홍채로 추정한 깊이를 더해 구한다. 이 값들을 BlazeGaze CNN에 넣는다.
- **KPI 하이브리드(2025):** MediaPipe FaceMesh로 머리 자세를 구하고 눈 이미지를 정규화한다. 시선은 ResNet-18+Transformer로 추정하고, 9점 보정과 선형 회귀로 화면 좌표에 매핑한다.
- **WebGazer.js v3.3/3.4:** 눈 이미지를 TF.js face-landmarks-detection(MediaPipe facemesh)으로 잘라낸다.

### 2. 보정 없이 쓰는 최신 딥러닝 모델도 오차가 수 도(°) — 신뢰도 높음

| 모델 | 보고된 각도 오차 | 비고 |
| --- | --- | --- |
| UniGaze (WACV 2026) | MPIIFaceGaze 4.51°, GazeCapture 5.47°, EYEDIAP 5.88°, XGaze 11.29°, Gaze360 12.37° | MAE 사전학습 ViT-B/L/H. 학습에 쓰지 않은 데이터셋으로 평가한 값 |
| L2CS-Net (2022) | MPIIGaze 3.92°, Gaze360 10.41° | 정면 20° 이내에서는 9.02° |
| ETH-XGaze 2021 우승 | 앙상블 3.11°, 단일 모델 최고 3.22° | 모델 6개 앙상블. 앙상블로 얻은 개선은 0.11° |

모두 서버급 연산이나 대형 모델을 전제로 하고, 머리 기준 yaw/pitch 각도를 출력한다. 화면 좌표를 얻으려면 결국 보정이 필요하다. 수치는 정규화된 얼굴 이미지 데이터셋 기준이라 노트북 웹캠에서의 실시간 정확도로 읽으면 안 된다. 이 프로젝트에 가까운 조건은 정면 웹캠 데이터셋인 MPIIFaceGaze와 GazeCapture(약 4–5.5°)다.

### 3. WebEyeTrack — 가장 잘 맞는 보강 후보 — 신뢰도 중간

- Vanderbilt 대학 프로젝트(arXiv 2508.19544, 2025-08). MIT 라이선스이고 TF.js로 동작하며 npm 패키지 `webeyetrack`으로 배포된다.
- 시선 모델 BlazeGaze는 670KB, 파라미터 0.16M, 0.15 GFLOPs인 CNN이다.
- 보정 샘플 9개로 기기 안에서 개인화 학습(few-shot)을 하며, 사용자 데이터가 기기 밖으로 나가지 않는다.
- 보고된 화면 응시점 오차는 GazeCapture 2.32cm, MPIIFaceGaze 4.56cm, EyeDiap 7.53cm다. GazeCapture 기준으로는 대형 모델인 EFE(2.48cm), AFF-Net(2.30cm)과 비슷하다.
- 추론 시간은 iPhone 14에서 2.4ms, i7-11700F CPU에서 0.88ms다. 이는 시선 모델만의 시간이고 MediaPipe 전처리는 빠져 있다.
- 한계는 다음과 같다.
  - 동료 심사를 거치지 않은 단일 연구팀의 프리프린트다. 저장소도 작다(약 66 stars).
  - 오차가 cm로만 보고됐고, 데스크톱 브라우저 속도 측정은 본문에 없다.
  - MPIIFaceGaze에서는 EFE, AFF-Net보다 나쁘다. 2.32cm가 9점 개인화 후 값인지도 명시되지 않았다.
  - 데스크톱 웹캠에서 WebGazer와 비교한 값은 7.24cm 대 8.72cm로 여전히 거친 수준이다.
  - WebGPU 실행 경로는 확인되지 않았다.

### 4. 하이브리드는 정확도와 지터가 개선됐지만 FPS가 떨어졌다 — 신뢰도 낮음

Oliinyk & Korol(2025, KPI 지역 대학 저널)의 실험 조건은 Chrome 136, i5 2.3GHz 노트북, 720p 웹캠, 9점 보정, 12개 테스트 점, 참가자 9명(27세션)이다.

| 방식 | 평균 오차(표준편차) | FPS |
| --- | --- | --- |
| 하이브리드(MediaPipe + CNN-Transformer, ONNX Runtime Web) | 68px (25) | 약 17 |
| CNN appearance 기반 | 79px (38) | 23 |
| MediaPipe FaceMesh 특징 기반 | 97px (32) | 26–28 |

- 하이브리드의 표준편차가 가장 낮아 지터를 중시하는 이 프로젝트에 참고할 만하다.
- 한계는 다음과 같다.
  - 기준 모델을 어떻게 구현했는지 밝히지 않았다.
  - 화면 크기가 없어 px를 각도로 바꿀 수 없다.
  - MediaPipe FPS가 표(26)와 본문(28)에서 서로 다르다.
  - 코드와 모델이 공개되지 않았다.
- 같은 결과를 ‘정확도는 개선, FPS는 약 1/3 하락’으로 요약한 주장은 검증에서 기각됐다(1–2). 따라서 이 결과는 ‘이 논문이 이렇게 보고했다’는 수준으로만 다룬다.

### 5. MediaPipe 없이 동작하는 모델도 있지만 근거가 약하다 — 신뢰도 중간

- **Harvard EZ-MMLA ‘MobileGaze JS’:** face-api.js로 얼굴을 검출하고, MobileOne-S0 ONNX 모델(약 5MB)을 onnxruntime-web WASM 단일 스레드로 실행해 yaw/pitch를 출력한다. 서버 호출 없이 기기에서 추론한다.
- **yakhyo/gaze-estimation(MobileGaze):** L2CS-Net 기반이다. ResNet-18/34/50, MobileNetV2, MobileOne-S0 가중치를 제공하며 모두 Gaze360 데이터로만 학습됐다.
- **PINTO0309/screen-eye-tracking(v1.0.0, 2026-06, MIT):** ‘MediaPipe 의존성 없음’을 내세운다. RetinaFace나 YOLO로 눈을 검출하고 160×160 ONNX 시선 모델을 돌린다. onnxruntime-web이나 LiteRT.js로 실행하며 WebGPU를 우선 쓴다. 다만 Electron에서만 시연됐고 정확도 벤치마크가 없다.
- 세 가지 모두 깜빡임·눈 감음 신호를 제공하지 않는다. 지금의 blendshape 기반 일시정지를 대체하려면 별도 장치가 필요하다.
- MobileGaze의 Gaze360 오차(MobileOne-S0 12.58° 등)로 ‘좌/중/우 구분에 충분하다’고 한 주장은 검증에서 기각됐다(0–3).

### 6. 상용 SeeSo/Eyedid 웹 SDK는 조건과 맞지 않는다 — 신뢰도 중간

- VisualCamp가 만든 SDK로 2024-04에 Eyedid로 리브랜딩했다. 일반 RGB 웹캠을 쓰는 WASM 기반 SDK다.
- 실행할 때 콘솔에서 발급한 라이선스 키로 인증해야 하고, 패키지는 독점 라이선스다. 샘플의 보정 흐름도 외부 페이지(`calibration.seeso.io`)로 이동한다. ‘외부 요청 없음, 로컬 정적 자산 고정’ 조건에 어긋난다.
- npm `seeso` 최신 버전은 0.2.4(2025-03-12)다. 그 뒤로 업데이트가 없고, 독립적인 정확도 수치도 찾지 못했다.

### 7. MediaPipe + 커널 회귀가 WebGazer보다 뒤처지지 않는다 — 신뢰도 낮음

- 참가자 1명의 브라우저 벤치마크(arXiv 2608.11566, 2026-09)다. MediaPipe FaceMesh와 RBF 커널 릿지 회귀를 쓴 방식의 평균 오차는 sweep 과제 8.05°, drift 과제 6.50°였다. WebGazer는 두 과제 모두 약 11.1°였다.
- 저자들은 이 차이가 실행 간 변동 폭(약 4.6°) 안에 있다고 보고 순위를 매기지 않았다. 그래도 지금처럼 ‘MediaPipe 랜드마크 + 회귀’로 가는 방향을 뒷받침하는 근거는 된다.

## 권고

다음 네 가지 이유로 교체보다 개선이 맞다.

1. 최신 브라우저 시선 연구와 라이브러리가 모두 MediaPipe 랜드마크를 전처리로 쓴다.
2. end-to-end 모델은 보정 없이 4–12° 오차가 나고 깜빡임 신호를 주지 않는다.
3. 상용 SDK는 오프라인·로컬 자산 조건을 깨뜨린다.
4. 이 작품에 필요한 좌/중/우 구분은 지금의 홍채 오프셋과 9점 보정으로도 충족되는 수준이다.

개선 후보는 우선순위 순으로 다음과 같다.

| 순위 | 후보 | 변경 범위 | 기대 효과 | 주의 |
| --- | --- | --- | --- | --- |
| 1 | 2차 다항 릿지를 RBF 커널 릿지로 바꾸는 A/B 실험 | `src/gaze-model.js`의 회귀 단계만 변경 | 비선형 매핑 개선, 비용이 가장 낮음 | 근거는 참가자 1명 벤치마크 |
| 2 | WebEyeTrack(BlazeGaze + 9점 개인화)을 기존 방식과 병행 비교 | Worker의 MediaPipe 출력(랜드마크와 변환 행렬) 뒤에 연결 | 정확도·지터 개선 가능 | TF.js 추론·학습 부하와 Worker 안 GPU 실행 확인 필요 |
| 3 | MobileGaze MobileOne-S0 ONNX를 보조 신호로 융합 | onnxruntime-web 추가(약 5MB) | 관객이 바뀌어도 안정적인지 확인 | Gaze360으로만 학습됨, FPS 하락 가능 |

후보를 비교할 때는 기존 6점 독립 검증 기준을 그대로 쓴다. 중앙값 오차 ≤0.16, 3구역 정확도 ≥5/6, 지터를 함께 기록한다. 이 권고는 확인된 주장을 바탕으로 한 추론이므로, 실제 노트북·웹캠에서 측정한 결과로 확정해야 한다.

## 한계와 미확인 사항

- **확인된 근거가 없어 다루지 못한 항목:** WebGazer.js 유지보수 상태, GazeCloudAPI/GazeRecorder, RealEye 같은 SaaS, Tobii Eye Tracker 5 같은 하드웨어, visionOS/WebXR 시선 API, 브라우저 표준 API, Human.js(vladmandic/human), face-api, GazeTR/Gaze-LLE, MediaPipe Face Landmarker와 iris 모델의 최근 업데이트(tasks-vision 1.2.2 이후 변경 사항 포함).
- **근거의 질:** 핵심 후보인 WebEyeTrack은 단일 연구팀 프리프린트에 근거한다. 하이브리드 비교는 참가자 9명에 코드가 공개되지 않았고, FaceMesh+커널 회귀 대 WebGazer 비교는 참가자 1명이다.
- **단위가 섞여 있다:** 각도(°), 화면 cm, px, 화면 비율이 섞여 있어 수치끼리 직접 비교할 수 없다. 대부분 실험실 데이터셋이나 보정 없는 조건이라 이 프로젝트의 실제 성능과 다르다.
- **최근 자료:** PINTO0309 프로젝트(2026-06)와 arXiv 2608.11566(2026-09)은 아직 커뮤니티에서 검증되지 않았다.

### 남은 질문

- WebEyeTrack을 붙이면 데스크톱 Chrome과 노트북 웹캠에서 6점 검증 지표(중앙값 오차, 3구역 정확도, 지터)가 기존 방식보다 실제로 나아지는가? Worker 안에서 TF.js 추론과 학습이 프레임레이트를 얼마나 떨어뜨리는가?
- MediaPipe Face Landmarker와 iris 모델은 1.2.2 이후 업데이트됐는가, 혹은 지원 중단 신호가 있는가?
- 전시 현장 조건(조명 변화, 안경, 다양한 관객, 자세 변화)에서 랜드마크+회귀 방식과 end-to-end CNN 중 어느 쪽이 좌/중/우 판정에서 더 안정적인가?
- 1인 전시라는 운영 조건에서 Tobii 같은 하드웨어 트래커가 비용 대비 안정성을 의미 있게 높이는가?

## 출처

- [WebEyeTrack (arXiv 2508.19544)](https://arxiv.org/abs/2508.19544) · [PDF](https://arxiv.org/pdf/2508.19544) · [GitHub](https://github.com/RedForestAI/WebEyeTrack)
- [UniGaze (arXiv 2502.02307)](https://arxiv.org/abs/2502.02307v2)
- [L2CS-Net (arXiv 2203.03339)](https://arxiv.org/pdf/2203.03339)
- [ETH-XGaze 2021 대회 (arXiv 2107.01980)](https://arxiv.org/pdf/2107.01980)
- [Oliinyk & Korol, 하이브리드 웹캠 시선 추적 (KPI)](https://asac.kpi.ua/article/download/340154/328203/789586) · [저장소 페이지](https://ela.kpi.ua/items/005845e3-9b1d-47a7-ad3d-16dda79e6c89/full)
- [브라우저 시선 추적 벤치마크 (arXiv 2608.11566)](https://arxiv.org/pdf/2608.11566)
- [Harvard EZ-MMLA Gaze Estimation JS](https://mmla.gse.harvard.edu/tools/gaze-estimation-js)
- [yakhyo/gaze-estimation (MobileGaze)](https://yakhyo.github.io/gaze-estimation)
- [PINTO0309/screen-eye-tracking](https://github.com/PINTO0309/screen-eye-tracking)
- [SeeSo 웹 샘플 (VisualCamp)](https://github.com/visualcamp/seeso-sample-web)
- [MediaPipe Face Landmarker 웹 가이드](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js)
