---
name: look-compare
description: 객차 렌더를 레퍼런스 이미지와 같은 구도로 찍어 나란히 붙이고, 명암·색 수치로 차이를 찾아 고친다. 객차의 형태·조명·재질·색을 바꿨거나 레퍼런스 재현도를 확인할 때 사용.
argument-hint: "[칸 번호 또는 poses.json 이름] [레퍼런스 이미지]"
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/snap.mjs *) Bash(python3 ${CLAUDE_SKILL_DIR}/scripts/compare.py *)
---

# 레퍼런스 비교 루프

목표는 "비슷해 보인다"가 아니라, 같은 구도·같은 조건에서 차이를 찾아 영향이 큰 것부터 줄이는 것이다.

## 1. 레퍼런스 준비

- 레퍼런스 이미지는 `.cache/<이름>-references/`에 있다. 커밋하지 않으므로 없으면 해당 `docs/*-reference.md`의 출처에서 다시 만든다.
- 영상 프레임: `ffmpeg -ss <초> -i <영상> -frames:v 1 .cache/<이름>-references/frame-<초>.png`
- Figma 노드 이미지는 호출 제한이 있으니 한 번만 받아 저장하고 이후엔 로컬 파일만 쓴다. 보드는 수정하지 않는다.
- 레퍼런스 영상 프레임 아래쪽의 자막(예: "전체 공간")은 비교 대상이 아니다. `--ignore-bottom 0.12`로 수치에서 뺀다.

## 2. 구도 맞추기

포즈는 `[x, y, z, pitch, yaw]`이며 비주얼 테스트의 `data-visual-pose`와 같은 형식이다.

- 바닥 y = 1.05, 체험 눈높이 카메라 y = 2.67, 통로 중심 z = -7.9, 통로 반폭 .78
- 칸 안쪽은 -x 방향. yaw = 1.5708이면 안쪽을 본다. yaw가 커지면 왼쪽(+z)으로, pitch가 음수면 아래로 향한다. 화면 오른쪽은 -z.
- 프리셋: `entrance`(x = -0.65에서 안쪽), `inspection`(x = -5.45에서 오브젝트 쪽, 기본값), `exit`(x = -11.45에서 뒤돌아봄)
- 카메라 FOV는 세로 48°. 레퍼런스의 소실점 위치로 pitch·yaw를, 바닥·천장이 보이는 비율로 높이를 추정한다.
- 레퍼런스 화각이 넓어 보이면 `--fov`로 맞춰 비교하되, 실제 체험은 48°라는 점을 기록한다. 체험 시점을 벗어난 구도는 비교용일 뿐이다.
- 사람이 직접 맞출 수도 있다. `npm start` 후 `http://127.0.0.1:5173/metaverse/?mode=visual&car=02`에서 드래그·WASD·Q/E로 맞추고, DevTools 콘솔에서 `copy(document.querySelector('#world').dataset.visualPose)`.
- 맞춘 포즈는 `${CLAUDE_SKILL_DIR}/poses.json`에 이름을 붙여 저장한다(`car`, `ref`, `pose`, 선택: `fov`, `ignoreBottom`, `note`).

## 3. 찍고 비교하기 (한 번에)

```sh
node ${CLAUDE_SKILL_DIR}/scripts/snap.mjs --name 02-frame-1
node ${CLAUDE_SKILL_DIR}/scripts/snap.mjs --car 03 --pose "-5.45,2.67,-7.9,-0.19,1.5708" --ref .cache/death-references/frame-3.png --ignore-bottom 0.12
```

- `?mode=visual`로 카메라 없이 칸을 열고, 장식 애니메이션을 멈춘 뒤 UI를 숨기고 찍는다. 화면 비율은 레퍼런스에 맞춘다.
- `--ref`가 있으면 `compare.py`가 이어서 돌며, 나란히 붙인 이미지 경로와 수치를 출력한다. 그 이미지를 Read로 직접 본다.
- 기타 옵션: `--preset`, `--size 1280x720`, `--exposure 1.2`(밝기 배율), `--tone aces|neutral|agx|none`, `--animate <ms>`, `--chrome`(UI 포함), `--out`, `--base`(이미 켠 서버 사용), `--headed`(실제 GPU, 창이 열림)
- 결과는 `.cache/look-compare/`에 남고 커밋되지 않는다.
- 비교 이미지만 다시 만들 때: `python3 ${CLAUDE_SKILL_DIR}/scripts/compare.py <레퍼런스> <렌더>`

## 4. 차이 목록 (영향이 큰 순서)

1. 명암 구조: 어두운 영역과 밝은 영역의 비율과 위치(평균 밝기, shadows, 3×3 격자)
2. 덩어리·비례: 큰 형태의 크기·위치·실루엣. 레퍼런스의 주인공 덩어리가 있는지
3. 색: 대표 색, 채도, 따뜻함
4. 재질: 거칠기, 반사, 면 처리(각진 로우폴리인지 매끈한지), 텍스처 크기
5. 디테일

각 항목에 레퍼런스에서 보이는 것, 렌더에서 보이는 것, 고칠 곳(`파일:줄`)을 적는다. 수치에 `*`가 남아 있으면 "비슷하다"고 결론 내리지 않는다. 기준값은 대략적인 값이라, 수치가 통과해도 이미지를 직접 본다. 체험상 이유(예: 시선 대상의 가시성)로 일부러 다르게 둔 것은 "의도적 차이"로 따로 적는다.

## 5. 고치고 다시 찍기

- 한 번에 한 축씩 고친다: 명암 → 덩어리 → 색 → 재질. 루프는 2–3회로 제한하고, 남은 차이는 기록한다.
- 색을 맞추기 전에 노출과 톤매핑 조건을 고정한다. 현재 제품은 ACES와 노출 1.1이다. `--tone neutral` 같은 비교는 실험이며, 제품 렌더러 설정을 바꾸는 것은 사용자 결정이다.
- 객차 계약을 지킨다. 대상 메시는 `MeshStandardMaterial`, 중앙 통로는 비우고, 응시점은 6m 이내 raycast 첫 충돌, 동작 줄이기에서는 장식 움직임 정지. 바꾼 뒤 `npm test`와 관련 브라우저 검사를 돌린다.

## 6. 기록과 한계

- `docs/<이름>-reference.md`에 비교한 레퍼런스, 포즈, 남은 차이와 의도적 차이를 적는다.
- 헤드리스 렌더는 SwiftShader 소프트웨어 렌더다. 구도·명암 비교에는 충분하지만 최종 색과 성능은 노트북 Chrome(또는 `--headed`)에서 확인한다.
- 구현 맥락 없이 판정받으려면, 새 에이전트에게 비교 이미지 경로와 레퍼런스 문서만 주고 "영향이 큰 차이 5개"를 묻는다. 구현 설명은 주지 않는다.
- 포즈 연결은 `snap.mjs`가 테스트처럼 `src/visual-inspector.js`를 네트워크 경계에서 바꿔 끼워 `window.__lookCompare`를 노출하는 방식이다. 제품 코드는 바꾸지 않는다. `constructor(world){`가 바뀌면 스크립트의 hook을 갱신한다.
