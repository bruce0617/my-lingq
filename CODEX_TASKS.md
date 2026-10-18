# Codex 작업 지시서 — My LingQ

## 프로젝트 개요
- LingQ(유료 언어학습 앱)의 핵심 기능을 개인용으로 무료 구현하는 프로젝트.
- 현재 앱: `index.html` 단일 파일 (HTML + CSS + 바닐라 JS, 빌드 도구 없음).
- 데이터: `localStorage` 키 `ml_lessons`(레슨 배열), `ml_words`(단어 객체 `{ status, meaning, example, added }`).
  - status: 0 새 단어, 1–4 학습 중, 5 아는 단어, -1 무시.
- UI 문구는 한국어.

## 공통 규칙
- 외부 프레임워크/빌드 도구를 추가하지 말 것 (바닐라 JS 유지).
- 기존 데이터 형식(`ml_lessons`, `ml_words`)을 깨지 말 것. 바꿔야 하면 마이그레이션 코드 포함.
- `localStorage` 접근은 기존 `store.load / store.save`를 통해서만.
- 작업마다 별도 커밋, 끝나면 변경 요약과 테스트 방법을 보고.

---

## Task 1 — 모바일 앱(PWA)으로 만들기  ⭐ 먼저
**목표:** 휴대폰 홈 화면에 추가해서 앱처럼(주소창 없이, 오프라인 가능) 쓰기.
**대상 기기: 아이폰 (iOS Safari) 우선.** 안드로이드는 고려하지 않아도 됨.
- iOS는 manifest 아이콘보다 `apple-touch-icon`(180px)을 사용하므로 반드시 포함.
- `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style` 메타 추가.
- iOS에서 `speechSynthesis`(발음 듣기)는 사용자 터치 이벤트 안에서만 동작함 — 확인할 것.

할 일:
1. `manifest.webmanifest` 생성 (name "My LingQ", short_name "MyLingQ", display `standalone`, theme/background color, 192·512px 아이콘).
2. `icons/icon-192.png`, `icons/icon-512.png` 생성 (단순한 📚 또는 "L" 디자인).
3. `sw.js` 서비스 워커: 앱 셸(`index.html`, manifest, 아이콘) 캐시 → 오프라인에서도 열림. 사전 API(`api.dictionaryapi.dev`) 요청은 캐시하지 말고 네트워크 우선.
4. `index.html`에 manifest 링크, `apple-touch-icon`, `theme-color` 메타, 서비스 워커 등록 코드 추가 (`file://`에서는 등록 건너뛰기).
5. `<meta name="viewport">`에 `viewport-fit=cover` 추가 (safe-area CSS는 Claude가 처리).

완료 기준:
- `npx serve .` 로 띄운 뒤 Chrome DevTools > Application 에서 manifest·서비스워커 오류 없음.
- 네트워크 끊고 새로고침해도 앱이 열림.

## Task 2 — ✅ 완료 (Claude가 처리: README, .gitignore, GitHub Pages 배포). 건너뛸 것.
- 앱은 https://bruce0617.github.io/my-lingq/ 로 배포됨. 서비스워커 캐시 경로는 `/my-lingq/` 하위 기준으로 작성할 것.
- `data/`(개인 학습 데이터)는 절대 커밋하지 말 것. `server.mjs`, `apps-script/`, 동기화 코드는 Claude 담당 — 수정 금지.

---

## 충돌 방지 규칙 ⚠️
Claude가 `index.html`의 기능(리더·오디오·콘텐츠 가져오기·복습·통계)을 동시에 작업 중.
- Codex는 `index.html`에서 **`<head>` 안의 태그 추가**와 **`</body>` 직전 서비스워커 등록 `<script>` 한 블록 추가**만 할 것.
- 그 외 `index.html` 본문·스타일·기존 스크립트는 수정 금지. 필요하면 보고만.
- 새 파일(`manifest.webmanifest`, `sw.js`, `icons/`, `README.md`, `.gitignore`)은 자유롭게.
