import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';

import stocksRouter from './routes/stocks.js';
import goldRouter from './routes/gold.js';
import cryptoRouter from './routes/crypto.js';
import analysisRouter from './routes/analysis.js';
import storage from './services/localStorage.js';
import collector from './services/collector.js';
import llmService from './services/llmService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 미들웨어
app.use(cors());
app.use(express.json());

// 라우트
app.use('/api/stocks', stocksRouter);
app.use('/api/gold', goldRouter);
app.use('/api/crypto', cryptoRouter);
app.use('/api/analysis', analysisRouter);

// 헬스 체크
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// 수동 수집 트리거
app.post('/api/collect', async (req, res) => {
    try {
        const data = await collector.runCollection();
        const info = collector.getCollectionInfo();
        res.json({
            success: true,
            message: '데이터 수집 완료',
            lastCollectedAt: info.lastCollectedAt,
            counts: {
                overseas: data.overseas.length,
                korean: data.korean.length,
                commodities: data.commodities.length,
                crypto: data.crypto.length
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 수집 정보 조회
app.get('/api/collection-info', (req, res) => {
    const info = collector.getCollectionInfo();
    res.json({ success: true, data: info });
});

// 시장 지수 조회 (S&P 500, NASDAQ-100, KOSPI, KOSDAQ)
app.get('/api/indices', async (req, res) => {
    try {
        const indices = [
            { symbol: '^GSPC', name: 'S&P 500', emoji: '🇺🇸' },
            { symbol: '^NDX', name: 'NASDAQ-100', emoji: '📈' },
            { symbol: '^KS11', name: 'KOSPI', emoji: '🇰🇷' },
            { symbol: '^KQ11', name: 'KOSDAQ', emoji: '🚀' }
        ];

        const YAHOO_HEADERS = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'application/json',
        };

        const results = await Promise.all(
            indices.map(async (idx) => {
                try {
                    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(idx.symbol)}?interval=1d&range=1mo`;
                    const fetchRes = await fetch(url, { headers: YAHOO_HEADERS });
                    if (!fetchRes.ok) throw new Error(`HTTP ${fetchRes.status}`);

                    const data = await fetchRes.json();
                    const result = data?.chart?.result?.[0];
                    if (!result) throw new Error('No data');

                    const meta = result.meta;
                    const prevClose = meta.chartPreviousClose || meta.previousClose || 0;
                    const price = meta.regularMarketPrice || 0;
                    const change = price - prevClose;
                    const changePercent = prevClose ? (change / prevClose) * 100 : 0;

                    // 스파크라인용 히스토리 추출
                    const quote = result.indicators?.quote?.[0];
                    const closes = quote?.close?.filter(c => c != null) || [];
                    const history = closes.map(c => ({ close: c }));

                    return {
                        symbol: idx.symbol,
                        name: idx.name,
                        emoji: idx.emoji,
                        price,
                        changePercent,
                        previousClose: prevClose,
                        currency: meta.currency || 'USD',
                        history
                    };
                } catch (e) {
                    console.error(`지수 조회 실패 (${idx.symbol}):`, e.message);
                    return { symbol: idx.symbol, name: idx.name, emoji: idx.emoji, price: null, changePercent: 0, history: [] };
                }
            })
        );

        res.json({ success: true, data: results });
    } catch (error) {
        console.error('시장 지수 API 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 환율 조회
app.get('/api/exchange-rate', (req, res) => {
    const data = collector.getLatestData();
    const gold = data.commodities?.[0];
    const usdKrw = gold?.usdKrw || 1350;
    res.json({ success: true, data: { usdKrw, updatedAt: new Date().toISOString() } });
});

// 서버 시작
async function startServer() {
    console.log('\n🚀 투자 분석 대시보드 서버 시작...\n');

    // 1. 로컬 파일 스토리지 초기화
    storage.setupStorage();

    // 2. Gemini LLM 초기화
    llmService.initLLM();

    // 3. 초기 데이터 수집
    console.log('\n📡 초기 데이터 수집 중...');
    await collector.runCollection();

    // 4. 매일 오전 9시 자동 수집 (전일 종가 업데이트)
    cron.schedule('0 9 * * *', async () => {
        console.log('\n⏰ [오전 9시] 전일 종가 데이터 수집 시작...');
        await collector.runCollection();
    }, { timezone: 'Asia/Seoul' });

    // 5. 서버 리스닝
    app.listen(PORT, () => {
        console.log(`\n✅ 서버 실행 중: http://localhost:${PORT}`);
        console.log('📊 API 엔드포인트:');
        console.log(`   GET  http://localhost:${PORT}/api/stocks/overseas`);
        console.log(`   GET  http://localhost:${PORT}/api/stocks/korean`);
        console.log(`   GET  http://localhost:${PORT}/api/gold`);
        console.log(`   GET  http://localhost:${PORT}/api/crypto`);
        console.log(`   POST http://localhost:${PORT}/api/analysis/:symbol`);
        console.log(`   POST http://localhost:${PORT}/api/analysis/portfolio/all`);
        console.log(`   POST http://localhost:${PORT}/api/collect`);
        console.log(`\n🔄 자동 수집: 30분 간격\n`);
    });
}

startServer().catch(console.error);
