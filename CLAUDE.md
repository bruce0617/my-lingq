# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트

유료 LingQ를 대신하는 개인용 영어 읽기·단어 학습 PWA. 주 사용 기기는 **아이폰·아이패드**(사파리, 홈 화면 앱). UI 문구와 코드 주석은 한국어.

- 앱 전체가 `index.html` 한 파일(HTML + CSS + 바닐라 JS). 빌드 도구·프레임워크·패키지 없음 — 추가하지 말 것.
- 배포: `main`에 push하면 GitHub Pages(https://bruce0617.github.io/my-lingq/)에 반영. 사용자는 변경마다 커밋 + push까지 기대함. 커밋 메시지는 한국어.
- `data/`(LingQ에서 내보낸 개인 학습 데이터)와 `netflix-extension/`은 `.gitignore` 대상 — 공개 저장소에 올리지 않음.
- `CODEX_TASKS.md`는 Codex용 옛 지시서(PWA 작업은 이미 끝남, 저장소 설명도 옛것). 참고만.

## 실행·확인

```bash
node server.mjs                      # http://127.0.0.1:8000 (앱 + /api/transcript)
HOST=0.0.0.0 node server.mjs         # 같은 Wi-Fi 아이폰에서 접속
python3 -m http.server 8765          # 정적 파일만 (자막 API 없음)
```

테스트 스위트·린터는 없다. 화면 확인은 Playwright로 한다(저장소에 의존성 없음 — 임시 폴더에 `playwright-core`를 설치해서 사용).
- **반드시 WebKit**(`webkit.launch()`, 사파리 엔진)과 `devices['iPhone 13']` / `devices['iPad Pro 11']`로 확인. Chrome에서만 되고 사파리에서 깨진 적이 여러 번 있음. Chrome 헤드리스는 `backdrop-filter` 고정 요소를 가끔 안 그려서 스크린샷이 틀어짐.
- 터치 드래그·밀기는 Chrome CDP `Input.dispatchTouchEvent`로 흉내 냄.
- 확인할 기본 흐름: 레슨 만들기(붙여넣기) → 리더 페이지 넘김 → 단어 누르기/구간 드래그 → ▶ 재생 막대 → 서재 필터 → 다크 모드 전환(밝게/어둡게 기기 각각).

## 구조 (index.html 안)

스크립트는 `// ---------- 이름 ----------` 머리말로 구역이 나뉨: 저장소 → 화면 전환 → 서재 → 콘텐츠 가져오기 → 유튜브/넷플릭스 → 리더 → 레슨 편집 → 문장 보기 → 오디오 → 아이폰 페이지 보기 → 단어장 → 복습 → 통계 → 백업 → LingQ 가져오기 → 클라우드 동기화. 시작 코드는 파일 맨 아래(`openStore()` 후 `show('library')`)라서, 위쪽 함수가 아래쪽 `const`를 참조해도 실행 시점엔 문제없음.

**데이터**
- IndexedDB `mylingq`의 `kv` 저장소에 `ml_lessons`, `ml_words`, `ml_log`, `ml_settings`, `ml_deleted`. 시작할 때 전부 메모리(`store.cache`)로 읽고, `store.save()`가 바로 씀. IndexedDB 불가 시 localStorage로 대체. `store.ok` 전에는 저장하지 않음(빈 값 덮어쓰기 방지).
- `words[key]` = `{status, meaning, example, added, u, ok, mem, again}`. key는 소문자 단어, 공백이 있으면 구문. status: 0 새 단어(파랑) · 1–4 학습 중(노랑) · 5 아는 단어 · -1 무시.
- 레슨: `{id, title, text | cues:[{t,text}], video(유튜브 ID) | netflix, pos, posAt, done, u, edited}`. `cues`가 있으면 시간 있는 대본(`isTimed()`).
- **언어별 분리**: 위 막대 `#langSel`(`settings.lang`, `LANGS`)로 공부할 언어를 고름. 레슨·단어에 `lang`(없으면 영어)이 붙고, 서재·단어장·복습·통계는 `myWords()`/`langOf()`로 지금 언어만 보여줌. 일본어 낱말은 `Intl.Segmenter`(`tokensOf`), 구문 키는 U+200B로 이음(`phraseKey`, `PH_SEP`) — 구문 키를 `' '`로 직접 만들지 말 것.
- 다크 모드 선택만 localStorage `ml_theme`(기기별)이고, `<head>` 인라인 스크립트가 첫 렌더 전에 `html[data-theme]`을 붙임.

**동기화 (Firebase, 구글 로그인 시)**: Firestore `users/{uid}/words/b{n}`(단어를 버킷으로 나눠 JSON 문자열), `lessons/{id}`, `meta/main`(log·deleted). 병합 규칙: 항목마다 `u`(수정 시각)가 큰 쪽, 보던 위치는 `posAt`가 큰 쪽, 삭제는 `deleted` 목록, 로그는 필드별 최댓값. 저장은 `schedulePush()`로 2.5초 모아서. 변경 시 `saveLessons()`/`saveWords()`/`touchWord()`를 거쳐야 `u`가 갱신되고 동기화됨.

**유튜브 자막** (`fetchTranscriptApi`): github.io에서는 집 Mac 중계(`MAC_RELAY`, Tailscale Funnel) → Apps Script 순, 그 외 호스트에서는 같은 서버의 `/api/transcript` → Apps Script. Apps Script는 유튜브 봇 확인에 거의 막힘 — 실질 경로는 Mac.
- `server.mjs`는 서버 두 개: 8000(앱 파일 + `/api/transcript`)과 8787(`/api/transcript`만, 127.0.0.1, CORS 허용 목록, 시간당 60회 제한). Funnel은 8787만 인터넷에 공개. launchd `com.mylingq.server`가 상시 실행, 로그는 `/tmp/mylingq-server.log`.
- 자막은 유튜브 ANDROID 클라이언트로 `youtubei/v1/player` → captionTracks에서 영어(사람 자막 우선) 선택.
- Funnel 켜기/끄기는 Mac을 인터넷에 여는 일이라 사용자가 직접 실행함.

**넷플릭스**: 넷플릭스 자막은 직접 가져오지 않음. 사용자 전용 크롬 확장(`netflix-extension/`)이 `window.postMessage`로 앱과 주고받음(`mylingq-netflix`로 대본 전달, `mylingq-netflix-seek`로 장면 이동). 아이폰·아이패드에서는 웹 넷플릭스를 시간 지정 주소로 엶.

## 아이폰·아이패드 화면 (깨지기 쉬운 부분)

- 터치 화면 판정이 두 곳에 같은 조건으로 있음: CSS `@media (max-width:800px), (pointer:coarse) and (max-width:1400px)`와 JS `isTouchLayout()`. 바꿀 때 둘 다.
- **페이지 보기**(`layoutPages`, `pageOf`, `turnPage`): `#text`에 높이를 주고 CSS 다단으로 흘려 한 단 = 한 페이지, `scrollLeft`로 넘김.
  - 사파리는 `columns:1`을 다단으로 취급하지 않고 넘친 단을 `scrollWidth`에 넣지 않음 → `column-width`를 쓰고, 페이지 수는 마지막 문장의 `getClientRects()` 위치로 계산.
  - 높이는 떠 있는 아래 막대(`#bbar`)의 윗선 기준이며 `scrollY`를 더해 계산(단어 창 때문에 스크롤된 상태에서도 같은 높이).
  - `updatePlayer()`가 매번 `layoutPages()`를 불러 현재 문장 페이지로 맞춤.
- **단어 구간 드래그 vs 페이지 밀기**: 길게(0.25초) 누르면 드래그 시작, 이때 `swipe = null`로 밀기를 취소. 밀기는 `#v-reader` 전체에서 받되 단어 창·재생 막대·아래 막대 위는 제외.
- 영상·재생 막대는 ▶(`#bPlay`)를 누를 때만 `body.pbar`로 보임. 리더에서는 `body.reading`이 위 메뉴를 숨김.

## 디자인 (iOS 26 Liquid Glass 스타일)

- 색은 전부 `:root` CSS 변수. 다크 값은 **두 블록에 똑같이** 있음: `@media (prefers-color-scheme:dark){:root:not([data-theme=light])}`와 `:root[data-theme=dark]`. 다크 전용 규칙을 추가하면 두 조건 모두에 넣어야 함.
- 바탕은 `html`에, `body`는 투명해야 `body::before`(고정 색 번짐 `--mesh`)가 보임. 리더(`body.reading`)는 단색.
- 테마 전환 시 `html.theme-swap`을 약 60ms 붙여 `#nav`·`#bbar`·`body::before`를 잠깐 빼냈다 넣음 — 아이폰이 고정 층을 다시 그리지 않아 옛 색이 남던 버그 대응. `theme-color` meta도 값만 바꾸지 않고 태그를 새로 끼움.
- 아래 탭 아이콘은 인라인 SVG. 밝은 모드에서 고른 탭은 `#g-accent` 그라데이션. 그 밖의 버튼 이모지는 사용자가 선호하므로 선 아이콘으로 바꾸지 않음.
- 본문(스크립트·단어)은 책 글꼴 Literata(Google Fonts), 화면은 시스템 글꼴(SF).

## 서비스 워커

`sw.js`는 같은 출처의 앱 셸만 네트워크 우선 + 캐시 대체. 다른 출처(Firebase, 유튜브, 사전·번역 API, ts.net 등)는 가로채지 않음. 셸 파일 목록을 바꾸면 `CACHE_NAME` 버전을 올릴 것.
