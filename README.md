# InvestBoard

해외주식, 국내주식, ETF, 금/원자재, 암호화폐를 한 화면에서 모니터링하고, 포트폴리오와 개인 히스토리, 투자 전략 메모까지 함께 관리하는 투자 대시보드입니다.

프론트엔드는 `Vite + Vanilla JS`, 백엔드는 `Node.js + Express` 기반으로 동작합니다.

## 최근 업데이트

- 대시보드 상단 KPI 카드 정비
  - 상승 / 하락 / 보합 / 수집률 정리
  - `MVRV Z-Score` 카드 추가
  - 상승 / 하락 카드 하단에 `국내 / 해외 / ETF / 코인`별 비율 표시
- 종목 카드 UX 개선
  - 스파크라인 차트 클릭 시 외부 금융 페이지로 이동
  - 국내 종목은 네이버 금융, 해외/ETF/원자재/코인은 구글 금융으로 연결
  - 즐겨찾기 기능 추가 및 즐겨찾기만 필터 지원
- 시장 뉴스 메뉴 추가
  - `S&P 500`, `국내주식`, `해외주식`, `금`, `코인` 카테고리 제공
- 포트폴리오 화면 개선
  - `달러 현금(USD)` 자산 지원
  - `원화 포함 / 원화 제외` 토글
  - 구성비 도넛 차트 및 항목 클릭 필터
  - 보유 종목 `수정 / 삭제` 기능
- 히스토리 화면 정리
  - 비상장 거래와 해외주식 계좌 히스토리 통합 요약
- 투자 전략 메모 페이지 추가
- 히트맵 메뉴 추가
  - `Finviz` 히트맵 열기 버튼 제공
- 종목 확장
  - `ACE KRX금현물`
  - `LLY`, `NVO`, `SNDK`, `ABNB`, `RBLX`
  - 국내 `엔터` 카테고리 (`하이브`, `JYP`, `YG`, `SM`)
  - `DOGE-USD`

## 주요 기능

### 1. 대시보드

- 해외주식, 국내주식, ETF, 금/원자재, 암호화폐 시세 조회
- 상단 KPI 카드
  - 전체 종목 수
  - 상승 / 하락 / 보합 종목 수
  - 데이터 수집률
  - `USD/KRW`, `US10Y`, `US13W`, `DXY`, `MVRV Z-Score`
  - `S&P 500`, `NASDAQ-100`, `KOSPI`, `KOSDAQ`
- 시장 / 즐겨찾기 / 검색 기반 필터
- 종목 카드 스파크라인 제공
- 종목 카드 즐겨찾기 저장
- 차트 클릭 시 외부 금융 페이지 이동

### 2. 시장 뉴스

- 카테고리별 시장 뉴스 목록
  - `S&P 500`
  - `국내주식`
  - `해외주식`
  - `금`
  - `코인`
- 일일 수집 저장본 기반으로 표시
- 제목, 출처, 시각, 요약, 원문 링크 제공

### 3. 내 포트폴리오

- 보유 종목별 수량 / 매입가 / 평가금 / 손익 계산
- `달러 현금(USD)` 자산 지원
- 실시간 `USD/KRW` 환율 반영
- 상단 KPI 요약 카드
  - 총 평가금액
  - 총 투자금
  - 총 손익
  - 현재 환율
- 구성비 도넛 차트
  - `국내주식`
  - `해외주식`
  - `ETF`
  - `코인`
  - `원화/현금`
- `원화 포함 / 원화 제외` 토글
  - KPI 카드와 구성비 차트가 함께 재계산
- 구성비 항목 클릭 시 포트폴리오 표 필터링
- 포트폴리오 종목 `추가 / 수정 / 삭제`

### 4. 히스토리

- 비상장 거래 히스토리 표시
- 해외주식 계좌 입출금 / 잔고 메모 표시
- 전체 요약 카드 제공
  - 총 순투입금액
  - 현재 확인 자산
  - 누적 손익
  - 미평가 자산

### 5. 투자 전략

- 자유 메모 페이지 제공
- 브라우저 `localStorage` 자동 저장

### 6. 히트맵

- `Finviz` 히트맵 바로가기 제공
- `x-frame-options: SAMEORIGIN` 제한으로 앱 내부 iframe 임베드는 하지 않음

## 현재 종목 구성

### 해외

- 기술주
- 반도체
- 비만 치료제/의약
- AI/데이터
- 방산/항공
- 에너지
- 소비재
- 헬스케어
- 금융
- 통신/미디어
- 산업재
- 해외 ETF

예시 종목:

- `AAPL`, `MSFT`, `NVDA`, `AMD`, `PLTR`, `CRM`
- `LLY`, `NVO`
- `ABNB`, `RBLX`, `SNDK`
- `SPY`, `QQQ`, `VOO`, `SOXX`

### 국내

- 대표주
- 금융
- 2차전지/소재
- 방산
- 바이오
- IT/플랫폼
- 엔터
- 중공업
- 소비/유통
- 국내 ETF

예시 종목:

- `삼성전자`, `SK하이닉스`, `현대차`, `NAVER`
- `하이브`, `JYP Ent.`, `YG Entertainment`, `SM Entertainment`
- `TIGER 미국S&P500`, `TIGER 미국S&P500(H)`, `ACE KRX금현물`

### 원자재 / 코인

- 금, 은, 백금, 팔라듐
- 원유, 천연가스, 구리, 우라늄 ETF
- `BTC-USD`, `ETH-USD`, `XRP-USD`, `SOL-USD`, `BNB-USD`, `DOGE-USD`

## 기술 스택

- Frontend: `Vanilla JS`, `HTML`, `CSS`, `Chart.js`
- Backend: `Node.js`, `Express`
- Build: `Vite`
- Scheduling: `node-cron`
- Data sources:
  - Google Finance
  - Yahoo Finance v8
  - Checkonchain

## 프로젝트 구조

```text
invest-dashboard/
├── server/
│   ├── index.js
│   ├── routes/
│   │   ├── stocks.js
│   │   ├── gold.js
│   │   ├── crypto.js
│   │   ├── news.js
│   │   ├── private.js
│   │   └── analysis.js
│   ├── services/
│   │   ├── yahooFinance.js
│   │   ├── collector.js
│   │   ├── localStorage.js
│   │   ├── newsService.js
│   │   └── llmService.js
│   └── utils/
│       └── cache.js
├── src/
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── main.js
│       ├── api.js
│       ├── dashboard.js
│       ├── charts.js
│       ├── stockCard.js
│       └── analysisPanel.js
├── data/
├── .env.example
├── package.json
└── vite.config.js
```

## 실행 방법

### 1. 설치

```bash
npm install
```

### 2. 환경변수

```bash
cp .env.example .env
```

선택값:

```env
GEMINI_API_KEY=your_key
PORT=3001
```

참고:

- `GEMINI_API_KEY`가 없어도 대시보드 핵심 기능은 동작합니다.
- 현재 UI에서는 AI 분석 버튼을 제거해둔 상태지만, 관련 서버 코드는 남아 있습니다.

### 3. 개발 실행

```bash
npm run dev
```

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend: [http://localhost:3001](http://localhost:3001)

### 4. 빌드

```bash
npm run build
```

## 스크립트

```bash
npm run dev
npm run dev:server
npm run dev:client
npm run build
npm start
```

## 주요 API

### 시세 / 지표

- `GET /api/stocks/overseas`
- `GET /api/stocks/korean`
- `GET /api/stocks/custom`
- `GET /api/stocks/themes`
- `GET /api/stocks/:symbol/history`
- `GET /api/gold`
- `GET /api/crypto`
- `GET /api/indices`
- `GET /api/macros`
- `GET /api/exchange-rate`

### 뉴스 / 수집

- `GET /api/news`
- `POST /api/collect`
- `GET /api/collection-info`
- `GET /api/health`

### 개인 데이터

- `GET /api/private/history`

## 데이터 저장 정책

### 깃에 포함되는 데이터

- 공용 시장 데이터 JSON
- 뉴스 저장 데이터
- 앱 구동에 필요한 공용 코드와 설정

### 깃에 포함되지 않는 개인 데이터

- `data/custom_stocks.json`
- `data/private_history.json`
- 브라우저 `localStorage`의 포트폴리오 데이터
- 브라우저 `localStorage`의 투자 전략 메모 / 즐겨찾기 데이터

즉:

- 포트폴리오 보유 정보는 브라우저에만 남습니다.
- 개인 히스토리는 로컬 파일에만 남습니다.
- 커스텀 종목과 개인 히스토리는 `.gitignore`로 제외됩니다.

## 참고 사항

- 국내 종목 전일비는 저장된 JSON 이력 기준으로 보정합니다.
- 포트폴리오 환율 카드와 상단 매크로 환율 카드는 같은 `USD/KRW` 소스를 사용합니다.
- 히트맵은 외부 링크 방식으로만 제공합니다.

## 라이선스

MIT
