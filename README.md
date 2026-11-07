# Art Hackathon

예술·기술 실험 두 작품을 하나의 정적 사이트에서 제공하는 저장소입니다. 루트 진입 페이지는 작품별 그래픽·소개·전체 클릭 영역을 갖춘 반응형 갤러리이며, 각 작품은 독립된 하위 경로에서 실행합니다. 2026-11-07 코드 기준입니다.

## 프로젝트

| 폴더 | 프로젝트 | GitHub Pages |
| --- | --- | --- |
| [chatgpt/](chatgpt/) | [딸깍 — 그 사이의 시간](chatgpt/README.md) | [프로젝트 열기](https://gonasooc.github.io/art-hackathon/chatgpt/) |
| [metaverse/](metaverse/) | [시선이 데려가는 곳](metaverse/README.md) | [프로젝트 열기](https://gonasooc.github.io/art-hackathon/metaverse/) |

```text
art-hackathon/
├── .nojekyll          # 저장소 전체를 정적 파일로 게시
├── index.html        # 반응형 작품 갤러리
├── package.json      # 공용 실행 명령
├── server.mjs        # 모든 프로젝트를 제공하는 로컬 서버
├── tests/            # 공용 서버 검증
├── chatgpt/
│   ├── index.html    # /art-hackathon/chatgpt/ 진입점
│   ├── *.css
│   ├── src/
│   ├── public/
│   ├── scripts/
│   ├── tests/
│   ├── docs/
│   ├── package.json
│   └── README.md
└── metaverse/
    ├── index.html    # /art-hackathon/metaverse/ 진입점
    ├── src/          # 시선·깜빡임·객차·도입·오디오
    ├── assets/       # 모델·기차 텍스처·영상·환경음
    ├── vendor/       # 버전을 고정한 정적 라이브러리
    ├── docs/         # 최종 기획과 검증 기록
    ├── tests/
    ├── package.json
    └── README.md
```

## 현재 구현

- **딸깍 — 그 사이의 시간:** 대화 UI에서 시작하는 67.2초 시청각 프로토타입. 응답 영역이 확대되어 작업 과정과 다섯 결과물을 보여준 뒤 대화 화면으로 돌아옵니다.
- **시선이 데려가는 곳:** 보정·독립 검증 → 행성 도입 → 기차 탑승 → 00–07 여정. 17개 대상을 응시·깜빡임으로 소멸시키며, 카메라 없는 자동 시연과 개발용 수동 점검을 별도로 제공합니다. 도입·환경·효과음을 포함합니다.
- 초기 조사·기획은 각 프로젝트 문서에 보존합니다. 현재 실행 방법은 각 README, 변경별 확인 범위는 [메타버스 검증 기록](metaverse/docs/verification.md)을 기준으로 합니다.

## 로컬 실행과 검증

Node.js 22 이상에서 별도 의존성 설치 없이 실행합니다. 저장소 루트에서 다음 명령을 사용하세요.

```sh
npm start
```

- 프로젝트 목록: `http://127.0.0.1:5173/`
- 딸깍: `http://127.0.0.1:5173/chatgpt/`
- 시선 전시: `http://127.0.0.1:5173/metaverse/`
- 배포 경로 확인: `http://127.0.0.1:5173/art-hackathon/chatgpt/`

`npm run dev`도 같은 서버를 실행합니다. 파일 수정 후 새로고침하면 반영됩니다.

```sh
npm --prefix metaverse ci
npm run build
npm test
npm run test:metaverse
```

루트의 `build`는 `chatgpt/dist/딸깍.html`과 메타버스의 정적 라이브러리·자산 목록을 준비합니다. `test`는 공용 서버와 두 프로젝트를 검사하며, 빌드를 먼저 실행해야 합니다. `test:metaverse`는 Playwright 브라우저 검사로, 최초에는 `cd metaverse` 후 `npx playwright install chromium`으로 테스트 브라우저를 설치합니다. 정적 파일을 관람하는 `npm start`에는 의존성 설치가 필요하지 않습니다. `npm run refresh:portfolio`는 ChatGPT 프로젝트의 원본 자료를 갱신합니다.

자동 시연은 `http://127.0.0.1:5173/metaverse/?mode=visual`, 카페 수동 점검은 `http://127.0.0.1:5173/metaverse/?mode=inspect&car=04`로 엽니다. `mode=visual`은 임의 칸을 선택하는 점검 모드가 아닙니다.

## GitHub Pages 배포

저장소의 **Settings → Pages → Build and deployment**에서 **Deploy from a branch**, **main**, **/(root)**를 선택합니다. 변경을 `main`에 푸시하면 루트의 `.nojekyll`과 프로젝트별 정적 파일이 함께 게시됩니다. 관람용 정적 소스가 직접 진입점이며 `chatgpt/dist/`는 배포에 필요하지 않습니다. 메타버스는 `vendor/`와 `assets/audio/`를 포함한 `assets/` 전체를 함께 게시해야 합니다. 실제 원격 배포 상태는 이 문서 정리에서 확인하지 않았습니다. [GitHub 공식 안내](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

- 프로젝트 목록: <https://gonasooc.github.io/art-hackathon/>
- 딸깍: <https://gonasooc.github.io/art-hackathon/chatgpt/>
- 시선 전시: <https://gonasooc.github.io/art-hackathon/metaverse/>

프로젝트 주소의 마지막 `/`는 상대경로 에셋이 해당 폴더를 기준으로 로드되도록 합니다. `/chatgpt`로 접속해도 디렉터리 주소인 `/chatgpt/`로 연결됩니다.

## 다음 프로젝트 추가

1. 저장소 루트에 `example/` 같은 프로젝트 폴더를 만들고 그 안에 `index.html`을 둡니다.
2. CSS·JavaScript·이미지도 해당 폴더 안에 두고 `./styles.css`, `./src/app.js`, `./assets/image.png`처럼 상대경로로 참조합니다.
3. 루트 `index.html`의 `.projects` 목록에서 기존 `.project` 카드 구조를 참고해 상대경로 링크, 작품명·설명·그래픽을 추가하고 프로젝트 수 표시를 갱신합니다. 제목·설명의 접근성 ID는 기존 카드와 중복되지 않게 합니다.
4. 변경을 `main`에 푸시합니다.

그러면 `https://gonasooc.github.io/art-hackathon/example/`에서 열립니다. 공용 서버에서도 `http://127.0.0.1:5173/example/`로 바로 확인할 수 있으며, 프로젝트별 서버 라우트 설정은 필요하지 않습니다. `example`은 폴더 이름 예시이며 아직 프로젝트를 생성하지 않았습니다.

새 프로젝트에 빌드 도구를 사용한다면 배포할 정적 결과물이 `example/index.html`을 진입점으로 갖도록 배치하고, 에셋의 기준 경로를 `/art-hackathon/example/` 또는 상대경로로 설정하세요. 각 프로젝트의 빌드·테스트 명령은 해당 프로젝트의 `package.json`에서 관리합니다. 루트의 빌드·테스트 명령은 현재 `chatgpt`와 `metaverse`를 대상으로 하므로 새 프로젝트도 함께 실행하려면 이 명령에 추가하세요.
