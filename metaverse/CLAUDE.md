# 시선이 데려가는 곳 (metaverse)

웹캠 시선으로 기차에 올라 00 자궁부터 07 향이 놓인 자리까지 기억의 칸을 지나는 1인칭 전시. 정적 사이트(GitHub Pages)이며 백엔드는 없다. 자세한 내용은 `README.md`와 `docs/`.

## 명령 (이 폴더에서)

- `npm start` → `http://127.0.0.1:5173/art-hackathon/metaverse/`
  - 카메라 없이 칸 보기(수동 점검): `?mode=inspect&car=05`
  - 처음부터 자동 시연: `?mode=visual`
- `npm test`: 단위 검사, 빠름
- `npm run test:e2e`: Playwright 브라우저 검사. 전체는 느리다(`objects.spec`은 여정 전체를 걷는다). 바꾼 부분의 spec부터: `npx playwright test tests/browser/<파일>`
- `npm run build`: vendor 복사와 `assets/manifest.json` 갱신. 자산을 추가·교체하면 실행

## 체험 원칙 (바꾸려면 먼저 사용자에게 확인)

- 이동·회전은 보정·검증된 시선으로만. 키보드·마우스·머리로 조향하지 않는다. 카메라 없이 보는 수동 점검(`?mode=inspect`)과 자동 시연(`?mode=visual`)은 예외다.
- 제품 코드에 시선 입력 주입이나 보정·검증 우회 경로를 만들지 않는다. 테스트는 `tests/browser/support.mjs`처럼 라우팅으로 모듈을 바꿔 끼운다.
- 상호작용 방법을 문장으로 안내하지 않는다. 오브젝트의 은은한 윤곽빛으로만 유도한다.
- 병원칸에는 사람을 넣지 않는다. 00 자궁칸에는 메인 오브젝트가 없다.
- 기차의 주행감은 창밖·선로·조명으로만 만든다. 관객 좌표를 자동으로 전진시키지 않는다.
- 핸드헬드는 낮은 진폭으로, 롤 회전 없이. 동작 줄이기(reduced motion)에서는 장식 움직임을 멈춘다.
- 카메라 원본·눈 이미지·시선 이력을 업로드하거나 저장하지 않는다. 화면의 개인정보 문구와 실제 동작이 일치해야 한다.
- 시선 추론은 워커에서만 한다. 렌더 루프에 추론을 더하지 않는다.

## 객차 작업

- 모듈: `src/carriages/<이름>.js`의 `build…Carriage()`가 `{group, targets, lighting, update(dt, reducedMotion)}`를 반환한다. `group`·`targets`가 기본이며 나머지는 칸에 따라 선택적으로 반환한다. 숲은 `forest-gltf.js`가 지연 `load()`를 제공하며 `world.ensureCar('05')` 완료 뒤 실제 메시를 등록한다. 05 선택·전환은 준비 완료를 기다리고 초기 world.ready에 숲 다운로드를 포함하지 않는다.
- 등록 지점: `src/config.js`의 `CARRIAGES` 구현 목록과 `JOURNEY_ORDER`, `src/train-world.js`의 빌더 목록, `src/visual-inspector.js`의 `names`, `tests/browser/objects.spec.mjs`의 `rooms`(응시점), `docs/<이름>-reference.md`
- 제약:
  - 소멸 대상 메시는 `MeshStandardMaterial`(소멸 셰이더 호환)
  - 중앙 통로 `z = TRAIN.centerZ ± .78`은 비운다.
  - 응시점은 6m 이내이고, 관찰 카메라에서 raycast했을 때 첫 충돌이어야 한다.
  - 칸에 자체 외피가 있으면 기차 외장과 자궁 배경을 숨긴다.
  - 외부 다운로드 없이, 절차적 텍스처나 build 목록의 정적 자산만 쓴다.
- 레퍼런스 재현을 확인하거나 외형을 바꿨으면 `/look-compare`로 같은 구도에서 나란히 비교한다. 전체 칸 점검은 `/look-compare 전체`. 문서의 "렌더 확인"만으로 재현됐다고 쓰지 않는다.

## three.js

- 0.187.0. `vendor/three/three.module.js`를 상대 경로로 import한다. 숲 GLB는 `vendor/three/addons/loaders/GLTFLoader.js`로 직접 로드한다. 빌드에서 동일 버전 애드온과 유틸리티를 복사하고 bare import만 상대경로로 바꾼다.
- API는 기억에 의존하지 말고 `vendor/three/three.core.js`에서 grep으로 확인한다.

## 레퍼런스와 자산

- Figma 보드(AKL Team 1, `FszUcDRVifUMnx9x15K1Z6`)는 읽기만 한다. Figma MCP는 호출 제한이 있으니 이미지는 한 번 받아 `.cache/<이름>-references/`에 둔다.
- `.cache/`(레퍼런스 프레임, 검증 렌더)는 커밋하지 않는다. 외부 CDN이나 런타임 다운로드는 없다.
- 객차 레퍼런스 영상은 시각 참고용이며 페이지에서 재생하거나 배포하지 않는다. 사용자가 재생을 요청한 행성 도입 `assets/films/planet-womb.mp4`와 향 피날레 `assets/films/incense-ending.mp4`는 예외이며 정지 프레임과 함께 배포한다. 향 영상은 항상 음소거하고 기존 향 음원 `incense.wav`를 별도로 유지한다.
- `assets/audio/`는 런타임에서 사용하지만 현재 `scripts/build.mjs`의 해시 매니페스트 대상에는 포함되지 않는다. 소리 자산 배포 여부는 별도로 확인한다.

## 문서

- 문서는 한국어로 쓴다. 변경하면 README와 관련 `docs/`를 함께 고친다.
- `docs/verification.md`에는 실제로 확인한 것과 확인하지 않은 것을 구분해 적는다.
- 현재 흐름의 기준은 `docs/hospital-object-plan.md`(응시·깜빡임 소멸)와 `docs/train-00-plan.md`(기차·00칸)이다. 칸별 레퍼런스는 `docs/*-reference.md`에 있다.
- `.impeccable.md`는 현재 UI 디자인 맥락이다. `docs/mvp-plan.md`와 기술 조사 문서는 초기 기록이며 현행 구현 범위로 해석하지 않는다.
- 현재 값: 보행 2.7m/s, 소멸 일반 1.3초·동작 줄이기 0.35초. 도입 건너뛰기는 없고 시연 조작은 마우스 호버·키보드 포커스에서 표시한다.
