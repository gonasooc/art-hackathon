---
name: look-compare
description: 객차 렌더를 레퍼런스 이미지와 같은 조건으로 찍어 나란히 붙이고 명암·색 수치로 비교한다. 전체 칸(기차 앞, 00–07)을 한 번에 점검하거나 한 칸만 비교하며, 요청하면 차이를 고친다. 각 칸이 레퍼런스대로 구현됐는지 확인하거나 객차의 형태·조명·재질·색을 바꿨을 때 사용.
argument-hint: "[전체 | 칸 번호 | 항목 이름] [Figma 링크·이미지 경로] [고쳐줘]"
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/snap.mjs *) Bash(python3 ${CLAUDE_SKILL_DIR}/scripts/compare.py *)
---

# 레퍼런스 비교

목표는 "비슷해 보인다"가 아니라, 같은 조건에서 차이를 찾아 영향이 큰 것부터 밝히는 것이다.

## 1. 요청 읽기

- "전체", "각 칸", "모든 칸"이라고 했거나 칸을 정하지 않았으면 전체 점검(4장)을 한다.
- 칸 번호나 이름("05", "숲칸")이 있으면 그 칸만 한다(`--cars 05`).
- Figma 링크가 있으면 `node-id=48-365`를 노드 `48:365`로 읽는다. `poses.json`에 그 노드 항목이 있으면 그대로 쓴다. 없으면 사용자 말, 2장 표, `docs/*-reference.md`로 칸을 정해 `<칸>-<노드>` 이름의 항목을 추가한다. `ref`는 같은 칸의 기존 레퍼런스 폴더에 `<노드>.png`로 둔다(예: `.cache/cafe-references/90-724.png`).
- 기본은 **보고만** 한다. 제품 코드와 문서는 고치지 않는다. `poses.json` 항목 추가와 `.cache/` 저장은 괜찮다. "고쳐 줘", "맞춰 줘"처럼 수정을 요청받았을 때만 7장을 따른다.

## 2. 비교 목록

`${CLAUDE_SKILL_DIR}/poses.json`이 칸별 비교 목록이다. 항목마다 다음 값을 둔다. 한 칸에 항목이 여러 개여도 된다.

- `car`
- `ref`: 로컬 레퍼런스 이미지
- 출처: `source`(영상과 초) 또는 `figma`(노드)
- 구도: `preset` 또는 `pose`
- `ignoreBottom`: 수치에서 뺄 아래쪽 자막 비율
- `note`: 의도적 차이

| 칸 | 기본 레퍼런스 | 문서 |
|---|---|---|
| 기차 앞 | `.cache/train-references/selected-train.png` | `docs/train-00-plan.md` |
| 00 자궁 · 탄생 | Figma 48:365 | `docs/train-00-plan.md` |
| 01 병원 | `출산병원.mp4` 1초 | `docs/hospital-object-plan.md` |
| 02 유년의 집 | `옛날집.mp4` 1초 | `docs/childhood-playground-cafe-reference.md` |
| 03 놀이터 | `놀이터.mp4` 1초 | `docs/childhood-playground-cafe-reference.md` |
| 04 카페 | Figma 91:785 | `docs/childhood-playground-cafe-reference.md` |
| 05 숲 | `숲.mp4` 1초 | `docs/forest-reference.md` |
| 06 병원 · 임종 | `임종병원.mp4` 1초 | `docs/death-hospital-reference.md` |
| 07 향이 놓인 자리 | Figma 85:627 | `docs/incense-reference.md` |

- 영상은 `~/Desktop/예술해커톤_영상/`에 있다. 다른 곳에 있으면 항목의 `source.video`를 고친다.
- 영상 프레임은 스크립트가 뽑는다. 영상이 프레임보다 새로우면 다시 뽑는다.
- 같은 칸의 다른 Figma 노드(방향별 이미지 등)는 각 문서에 있다.

## 3. Figma 레퍼런스 받기

`--check`에서 "없음"으로 나온 Figma 항목을 먼저 받는다.

1. 이미 받은 파일은 다시 받지 않는다. 보드(`FszUcDRVifUMnx9x15K1Z6`)는 읽기만 한다.
2. 세션 생성 도구(`create_session`)가 있으면 작업마다 한 번 만들고 그 ID를 이어 쓴다.
3. 노드마다 에셋 다운로드 도구(`download_assets`)를 부르고 응답을 저장한다.
   - `rawImages`에 원본 이미지가 하나면 그 URL을, 아니면 노드 전체를 렌더한 `export`의 URL을 쓴다.
   - 저장 명령: `mkdir -p "$(dirname <ref 경로>)" && curl -sSL -o <ref 경로> "<URL>"` (폴더가 아직 없을 수 있다)
   - 다운로드 도구가 없으면 스크린샷 도구로 이미지를 보기만 하고, 그 칸은 수치 없이 눈으로 비교한다.
4. 한 번에 한 노드씩 부른다. 호출 제한에 걸리면 더 부르지 않는다. 받은 것으로 진행하고, 남은 노드를 보고서에 적는다.
5. 임시 다운로드 URL은 문서나 코드에 남기지 않는다.
6. Figma MCP가 연결돼 있지 않으면 그 항목은 "레퍼런스 없음"으로 보고한다. 사용자에게 `/mcp`에서 Figma를 연결하거나, 이미지를 PNG로 내보내 `ref` 경로에 두라고 안내한다.

## 4. 전체 점검

```sh
node ${CLAUDE_SKILL_DIR}/scripts/snap.mjs --check        # 레퍼런스 상태만 확인
node ${CLAUDE_SKILL_DIR}/scripts/snap.mjs --all          # 모든 항목을 찍고 비교 (9항목 약 1분)
node ${CLAUDE_SKILL_DIR}/scripts/snap.mjs --cars 01,05   # 일부 칸만
```

- 항목마다 카메라 없는 수동 점검 모드(`?mode=inspect&car=NN`)를 새로 연다. 장식 애니메이션을 멈추고 UI를 숨긴 뒤, 레퍼런스 비율로 찍는다.
- 레퍼런스가 있으면 나란히 붙인 이미지(`…-vs-ref.png`)와 수치를 만든다. 결과는 `.cache/look-compare/`에, 전체 요약은 `summary.json`에 남는다.
- 한 항목이 실패해도 나머지는 계속한다.

**비교 이미지를 모두 Read로 직접 본 뒤** 보고한다. 렌더만 있는 항목도 렌더를 본다.

1. 요약 표: `칸 | 레퍼런스 | 구도 | 판정 | 가장 큰 차이 | 남은 * 항목`
   - 판정은 재현됨 / 부분 / 차이 큼 / 레퍼런스 없음 중 하나다.
   - 구도에는 맞춘 포즈인지, 대략적인 프리셋인지 적는다.
2. 칸별로 5장 순서의 차이를 2–4개 적고, 고칠 곳(`파일:줄`)을 제안한다. 고치지는 않는다.
3. `note`의 의도적 차이(병원칸의 사람 제외, 자막 등)는 결함으로 세지 않고 따로 적는다.
4. 프리셋 구도는 레퍼런스 시점과 다를 수 있다. 구도 차이로 생긴 수치 차이(격자, 밝기 분포)와 실제 재현 차이를 구분한다.

## 5. 차이 목록 (영향이 큰 순서)

1. 명암 구조: 어두운 영역과 밝은 영역의 비율과 위치(평균 밝기, shadows, 3×3 격자)
2. 덩어리·비례: 큰 형태의 크기, 위치, 실루엣. 레퍼런스의 주인공 덩어리가 있는지
3. 색: 대표 색, 채도, 따뜻함
4. 재질: 거칠기, 반사, 면 처리(각진 로우폴리인지 매끈한지), 텍스처 크기
5. 디테일

수치에 `*`가 남아 있으면 "비슷하다"고 결론 내리지 않는다. 기준값은 대략적인 값이라, 수치가 통과해도 이미지를 직접 본다.

## 6. 한 장 비교와 구도 맞추기

```sh
node ${CLAUDE_SKILL_DIR}/scripts/snap.mjs --name 05-frame-1
node ${CLAUDE_SKILL_DIR}/scripts/snap.mjs --car 06 --pose "-5.45,2.67,-7.9,-0.19,1.5708" --ref <이미지> --ignore-bottom 0.12
```

- 포즈는 `[x, y, z, pitch, yaw]`이다.
  - 바닥 y = 1.05, 체험 눈높이 y = 2.67, 통로 중심 z = -7.9, 통로 반폭 .78
  - 칸 안쪽은 -x 방향이다. yaw = 1.5708이면 안쪽 정면을 본다.
  - yaw가 커지면 왼쪽(+z)으로, pitch가 음수면 아래로 향한다. 화면 오른쪽은 -z다.
  - 카메라 FOV는 세로 48°다.
- 프리셋은 세 가지다. 기차 앞에서는 같은 이름이 외관 시점이다.
  - `entrance`: x = -0.65에서 안쪽을 본다.
  - `inspection`: x = -5.45에서 오브젝트 쪽을 본다.
  - `exit`: x = -11.45에서 뒤돌아본다.
- 사람이 직접 구도를 맞출 때:
  1. `npm start` 후 `http://127.0.0.1:5173/art-hackathon/metaverse/?mode=inspect&car=05`를 연다.
  2. 드래그·WASD·Q/E로 맞춘다.
  3. DevTools 콘솔에서 `copy(document.querySelector('#world').dataset.visualPose)`를 실행한다.
  4. 복사한 값을 항목의 `pose`에 넣고 `preset`은 지운다.
- 레퍼런스 화각이 넓어 보이면 `--fov`로 맞춰 비교한다. 실제 체험은 48°라는 점을 함께 적는다.
- 그 밖의 옵션:
  - `--size 1280x720`
  - `--exposure 1.2`: 밝기 배율
  - `--tone aces|neutral|agx|none`: 비교 실험용이며 제품 설정은 바뀌지 않는다.
  - `--animate <ms>`
  - `--chrome`: UI 포함
  - `--out`
  - `--base`: 켜 둔 서버 사용
  - `--headed`: 실제 GPU, 창이 열림
- 비교 이미지만 다시 만들 때: `python3 ${CLAUDE_SKILL_DIR}/scripts/compare.py <레퍼런스> <렌더> [--ignore-bottom 0.12]`

## 7. 고치기 (요청받았을 때만)

- 한 번에 한 축씩 고친다: 명암 → 덩어리 → 색 → 재질. 한 칸에 2–3회로 제한하고, 남은 차이는 기록한다.
- 색을 맞추기 전에 노출과 톤매핑 조건을 고정한다. 현재 제품은 ACES와 노출 1.1이다. 렌더러 설정 변경은 사용자 결정이다.
- 객차 계약을 지킨다.
  - 대상 메시는 `MeshStandardMaterial`
  - 중앙 통로는 비운다.
  - 응시점은 6m 이내 raycast 첫 충돌
  - 동작 줄이기에서는 장식 움직임을 멈춘다.
- 바꾼 뒤 `npm test`와 관련 브라우저 검사를 돌린다.
- 고친 칸의 `docs/<이름>-reference.md`에 비교한 레퍼런스, 포즈, 남은 차이, 의도적 차이를 적는다.

## 8. 한계

- 헤드리스 렌더는 SwiftShader 소프트웨어 렌더다. 구도·명암 비교에는 충분하지만, 최종 색과 성능은 노트북 Chrome(또는 `--headed`)에서 확인한다.
- 구현 맥락 없이 판정받으려면, 새 에이전트에게 비교 이미지 경로와 레퍼런스 문서만 주고 "영향이 큰 차이 5개"를 묻는다.
- 포즈 연결은 테스트처럼 `src/visual-inspector.js`를 네트워크 경계에서 바꿔 끼워 `window.__lookCompare`를 노출하는 방식이다. 제품 코드는 바꾸지 않는다. `constructor(world){`가 바뀌면 스크립트의 hook을 고친다.
- 비교에는 PIL이 필요하다. 스크립트가 PATH에서 PIL이 있는 python3를 찾는다. 없으면 `python3 -m pip install pillow`를 안내한다. `LOOK_COMPARE_PYTHON`으로 직접 지정할 수도 있다.
