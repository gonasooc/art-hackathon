# Art Hackathon

여러 프로젝트를 각자의 폴더에 보관하고, 하나의 GitHub Pages 사이트에서 프로젝트별 경로로 공개하는 저장소입니다.

## 프로젝트

| 폴더 | 프로젝트 | GitHub Pages |
| --- | --- | --- |
| [chatgpt/](chatgpt/) | [딸깍 — 그 사이의 시간](chatgpt/README.md) | [프로젝트 열기](https://gonasooc.github.io/art-hackathon/chatgpt/) |

```text
art-hackathon/
├── .nojekyll          # 저장소 전체를 정적 파일로 게시
├── index.html        # 프로젝트 목록
├── package.json      # 공용 실행 명령
├── server.mjs        # 모든 프로젝트를 제공하는 로컬 서버
├── tests/            # 공용 서버 검증
└── chatgpt/
    ├── index.html    # /art-hackathon/chatgpt/ 진입점
    ├── *.css
    ├── src/
    ├── public/
    ├── scripts/
    ├── tests/
    ├── docs/
    ├── package.json
    └── README.md
```

## 로컬 실행과 검증

Node.js 22 이상에서 별도 의존성 설치 없이 실행합니다. 저장소 루트에서 다음 명령을 사용하세요.

```sh
npm start
```

- 프로젝트 목록: `http://127.0.0.1:5173/`
- 현재 프로젝트: `http://127.0.0.1:5173/chatgpt/`
- 배포 경로 확인: `http://127.0.0.1:5173/art-hackathon/chatgpt/`

`npm run dev`도 같은 서버를 실행합니다. 파일 수정 후 새로고침하면 반영됩니다.

```sh
npm run build
npm test
```

루트의 `build`는 현재 프로젝트의 단독 전달용 파일 `chatgpt/dist/딸깍.html`을 생성합니다. `test`는 공용 서버와 현재 프로젝트를 검사하며, 단독 HTML 검사 때문에 빌드를 먼저 실행해야 합니다. `npm run refresh:portfolio`는 현재 프로젝트의 원본 자료를 갱신합니다. 프로젝트 내부에서 해당 명령을 실행할 수도 있습니다.

## GitHub Pages 배포

저장소의 **Settings → Pages → Build and deployment**에서 **Deploy from a branch**, **main**, **/(root)**를 선택합니다. 변경을 `main`에 푸시하면 루트의 `.nojekyll`과 프로젝트별 정적 파일이 함께 게시됩니다. 별도의 Pages 빌드는 필요하지 않습니다. [GitHub 공식 안내](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

- 프로젝트 목록: <https://gonasooc.github.io/art-hackathon/>
- 현재 프로젝트: <https://gonasooc.github.io/art-hackathon/chatgpt/>

프로젝트 주소의 마지막 `/`는 상대경로 에셋이 해당 폴더를 기준으로 로드되도록 합니다. `/chatgpt`로 접속해도 디렉터리 주소인 `/chatgpt/`로 연결됩니다.

## 다음 프로젝트 추가

1. 저장소 루트에 `example/` 같은 프로젝트 폴더를 만들고 그 안에 `index.html`을 둡니다.
2. CSS·JavaScript·이미지도 해당 폴더 안에 두고 `./styles.css`, `./src/app.js`, `./assets/image.png`처럼 상대경로로 참조합니다.
3. 루트 `index.html`의 목록에 `<li><a href="./example/">프로젝트 이름</a></li>`를 추가합니다.
4. 변경을 `main`에 푸시합니다.

그러면 `https://gonasooc.github.io/art-hackathon/example/`에서 열립니다. 공용 서버에서도 `http://127.0.0.1:5173/example/`로 바로 확인할 수 있으며, 프로젝트별 서버 라우트 설정은 필요하지 않습니다. `example`은 폴더 이름 예시이며 아직 프로젝트를 생성하지 않았습니다.

새 프로젝트에 빌드 도구를 사용한다면 배포할 정적 결과물이 `example/index.html`을 진입점으로 갖도록 배치하고, 에셋의 기준 경로를 `/art-hackathon/example/` 또는 상대경로로 설정하세요. 각 프로젝트의 빌드·테스트 명령은 해당 프로젝트의 `package.json`에서 관리합니다. 루트의 빌드·테스트 명령은 현재 `chatgpt`를 대상으로 하므로 새 프로젝트도 함께 실행하려면 이 명령에 추가하세요.
