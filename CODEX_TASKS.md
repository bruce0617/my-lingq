# Codex 작업 지시서 — My LingQ

## 프로젝트 개요
- LingQ(유료 언어학습 앱)의 핵심 기능을 개인용으로 무료 구현하는 프로젝트. 사용자는 **아이폰**에서 주로 사용.
- 앱: `index.html` 단일 파일 (HTML + CSS + 바닐라 JS, 빌드 도구 없음).
- 배포: GitHub Pages **https://bruce0617.github.io/my-lingq/** (저장소 `bruce0617/my-lingq`, `main` 브랜치 루트).
  집 Mac에서는 `server.mjs`가 http://localhost:8000 으로도 같은 앱을 제공.
- 데이터: `localStorage`(`ml_lessons`, `ml_words`, `ml_log`, `ml_settings`, `ml_deleted`) + 구글 로그인 시 Firebase Firestore 동기화.
- UI 문구는 한국어.

## 공통 규칙
- 외부 프레임워크/빌드 도구를 추가하지 말 것 (바닐라 JS 유지).
- `data/`(사용자 개인 학습 데이터)는 절대 커밋하지 말 것 (`.gitignore`에 있음).
- `server.mjs`, `apps-script/`, `index.html`의 기존 스크립트·스타일·본문은 Claude 담당 — **수정 금지**. 필요하면 보고만.
- 커밋까지만 하고 **push는 하지 말 것** (사용자 확인 후 배포). 끝나면 변경 요약과 테스트 방법을 보고.

---

## Task 1 — 아이폰 홈 화면 앱(PWA) 완성  ⭐ 남은 작업
**목표:** 아이폰 사파리에서 "홈 화면에 추가"했을 때 진짜 앱처럼 보이고(아이콘·전체 화면), 인터넷이 약해도 앱 화면이 열리게.

할 일:
1. `manifest.webmanifest` 생성 — name "My LingQ", short_name "My LingQ", `display: standalone`,
   `start_url: "./"`, `scope: "./"`, theme/background color, 192·512px 아이콘. (**경로는 모두 상대경로** — `/my-lingq/` 아래에서 동작해야 함)
2. `icons/icon-180.png`(apple-touch-icon), `icons/icon-192.png`, `icons/icon-512.png` 생성 — 단순한 📚 또는 "L" 디자인.
3. `sw.js` 서비스 워커:
   - `index.html`·manifest·아이콘은 **네트워크 우선, 실패 시 캐시** (캐시 우선으로 하면 업데이트가 안 보이게 되므로 금지).
   - 다른 출처 요청(Firebase, YouTube, 사전·번역 API, script.google.com, ts.net)은 **가로채지 말 것** — 그대로 통과.
   - 캐시 이름에 버전을 붙이고, 새 버전 활성화 시 옛 캐시 삭제.
4. `index.html` — **허용된 범위만** 수정:
   - `<head>`에 태그 추가: manifest 링크, `apple-touch-icon`, `theme-color`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`.
   - 기존 `<meta name="viewport">`에 `viewport-fit=cover`만 추가.
   - `</body>` 직전에 서비스워커 등록 `<script>` 한 블록 추가 (`location.protocol`이 `https:`이거나 호스트가 `localhost`일 때만 등록).

완료 기준:
- `node server.mjs` 후 http://localhost:8000 에서 Chrome DevTools > Application 의 Manifest·Service Worker 오류 없음.
- 네트워크를 끊고 새로고침해도 앱 화면이 열림 (단어·레슨은 localStorage에 있으므로 그대로 보임).
- 기존 기능(유튜브 레슨, 단어 클릭, 구글 로그인 버튼)이 그대로 동작.

---

## 완료된 작업 (참고용, 건너뛸 것)
- ~~Task 2: README, .gitignore, GitHub Pages 배포~~ — Claude가 처리.
