# CLAUDE.md

InvestBoard: 해외·국내 주식, ETF, 금, 코인 시세와 개인 포트폴리오를 보는 투자 대시보드. 프론트엔드는 Vite + Vanilla JS.

배포 위치는 이 저장소가 아니라 홈페이지 저장소 `heoquixote/heoquixote.github.io`의 `invest/` 폴더다 (https://www.data-learners.com/invest/, 소유자 전용).

## 작업 규칙

- main에 직접 push 금지. `claude/<작업명>` 브랜치에서 작업하고 PR을 연다. 머지는 소유자가 직접 한다.
- 화면 문구는 모두 한국어. em dash(—)는 쓰지 않는다.
- 개인 투자 데이터(보유 수량, 매입가, 거래 내역, 계좌 히스토리)는 절대 커밋하지 않는다. 화면 예시가 필요하면 가짜 값을 쓴다.
- `.env`, `credentials/`, `data/*.json`은 gitignore 대상이며 유지한다.

## 구조와 데이터 흐름

| 경로 | 역할 |
|---|---|
| `src/` | Vite 루트. `index.html`, `css/`, `js/` |
| `src/js/api.js` | **모든 API 호출의 단일 진입점.** n8n 웹훅 `https://hote.app.n8n.cloud/webhook/dl/`로 POST |
| `src/js/main.js`, `dashboard.js`, `stockCard.js`, `charts.js` | 화면 구성, 종목 카드, 스파크라인·차트 |
| `server/` | Express + node-cron 로컬 백엔드 (Yahoo Finance 수집, 로컬 JSON 저장). 현재 프론트엔드는 n8n API를 직접 호출하므로 사이트 배포판에는 쓰이지 않는다. 수정 전에 실제로 쓰이는 경로인지 먼저 확인 |
| `docs/screenshots/` | README용 스크린샷 |

운영 데이터와 인증은 n8n 워크플로우 `[Data Learners] 투자 대시보드 API`와 n8n data table에 있다. 요청·응답 형식을 바꾸면 PR 본문에 n8n 워크플로우 쪽 수정이 필요한지 명시한다.

## 명령어

```bash
npm install
npm run dev:client    # 프론트엔드만 (http://localhost:5173)
npm run dev           # 로컬 Express(3001) + Vite 동시 실행
npm run build:site    # 사이트 배포용 빌드 (base: /invest/) → dist/
```

## 배포 절차

1. 이 저장소에서 변경 PR 머지
2. `npm run build:site`
3. `heoquixote.github.io` 저장소에서 `claude/invest-<작업명>` 브랜치 생성
4. 그 저장소의 `invest/` 폴더를 비우고 `dist/` 내용 전체로 교체 (해시가 붙은 `assets/*.js` 파일명이 바뀌므로 이전 파일은 삭제)
5. 홈페이지 저장소에 PR (제목 예: `투자 대시보드: <변경 요약> 반영`)

## README

기능을 추가하거나 바꾸면 `README.md`의 "최근 업데이트"와 "주요 기능" 항목을 함께 갱신한다.
