import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';

import stocksRouter from './routes/stocks.js';
import goldRouter from './routes/gold.js';
import cryptoRouter from './routes/crypto.js';
import analysisRouter from './routes/analysis.js';
import newsRouter from './routes/news.js';
import privateRouter from './routes/private.js';
import storage from './services/localStorage.js';
import collector from './services/collector.js';
import llmService from './services/llmService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const YAHOO_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Accept': 'application/json',
};

// 미들웨어
app.use(cors());
app.use(express.json());

async function fetchYahooChartSnapshot(symbol, range = '1mo') {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`;
    const fetchRes = await fetch(url, { headers: YAHOO_HEADERS });
    if (!fetchRes.ok) {
        throw new Error(`HTTP ${fetchRes.status}`);
    }

    const data = await fetchRes.json();
    const result = data?.chart?.result?.[0];
    if (!result) {
        throw new Error('No data');
    }

    const meta = result.meta || {};
    const prevClose = meta.chartPreviousClose || meta.previousClose || 0;
    const price = meta.regularMarketPrice ?? null;
    const quote = result.indicators?.quote?.[0];
    const closes = quote?.close?.filter(value => value != null) || [];

    return {
        price,
        previousClose: prevClose,
        changePercent: prevClose && price != null ? ((price - prevClose) / prevClose) * 100 : 0,
        history: closes.map(close => ({ close }))
    };
}

async function fetchUsdKrwFromGoogle() {
    const fxUrl = 'https://www.google.com/finance/quote/USD-KRW';
    const response = await fetch(fxUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const priceMatch = html.match(/data-last-price="([^"]+)"/);
    if (!priceMatch) {
        throw new Error('No FX price');
    }

    return parseFloat(priceMatch[1]);
}

function decodePlotlyTypedArray(value) {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== 'object' || !value.bdata || !value.dtype) return [];

    const buffer = Buffer.from(value.bdata, 'base64');

    switch (value.dtype) {
        case 'f8': {
            const result = [];
            for (let offset = 0; offset < buffer.length; offset += 8) {
                result.push(buffer.readDoubleLE(offset));
            }
            return result;
        }
        case 'f4': {
            const result = [];
            for (let offset = 0; offset < buffer.length; offset += 4) {
                result.push(buffer.readFloatLE(offset));
            }
            return result;
        }
        default:
            return [];
    }
}

async function fetchCheckOnChainMetricSnapshot(url, traceName) {
    const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const match = html.match(/Plotly\.newPlot\(\s*"[^"]+",\s*(\[[\s\S]*?\])\s*,\s*(\{[\s\S]*?\})\s*,\s*\{"responsive":\s*true\}/);
    if (!match) {
        throw new Error('Plotly data not found');
    }

    const traces = JSON.parse(match[1]);
    const trace = traces.find(item => item.name === traceName);
    if (!trace) {
        throw new Error(`Trace not found: ${traceName}`);
    }

    const yValues = decodePlotlyTypedArray(trace.y).filter(value => Number.isFinite(value));
    if (!yValues.length) {
        throw new Error('No y values');
    }

    const value = yValues.at(-1);
    const previousValue = yValues.findLast(item => Number.isFinite(item) && item !== value) ?? yValues.at(-2) ?? null;

    return {
        value,
        previousValue,
        changeValue: previousValue != null ? value - previousValue : null
    };
}

// 라우트
app.use('/api/stocks', stocksRouter);
app.use('/api/gold', goldRouter);
app.use('/api/crypto', cryptoRouter);
app.use('/api/analysis', analysisRouter);
app.use('/api/news', newsRouter);
app.use('/api/private', privateRouter);

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

        const results = await Promise.all(
            indices.map(async (idx) => {
                try {
                    const snapshot = await fetchYahooChartSnapshot(idx.symbol, '1mo');

                    return {
                        symbol: idx.symbol,
                        name: idx.name,
                        emoji: idx.emoji,
                        price: snapshot.price,
                        changePercent: snapshot.changePercent,
                        previousClose: snapshot.previousClose,
                        currency: idx.symbol.startsWith('^K') ? 'KRW' : 'USD',
                        history: snapshot.history
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

// 매크로 지표 조회 (환율/금리/달러)
app.get('/api/macros', async (req, res) => {
    try {
        const macroDefs = [
            { key: 'US10Y', symbol: '^TNX', name: '미국 10Y', emoji: '🏦', format: 'percent', divisor: 10 },
            { key: 'US13W', symbol: '^IRX', name: '미국 13W', emoji: '⏱️', format: 'percent', divisor: 10 },
            { key: 'DXY', symbol: 'DX-Y.NYB', name: '달러 인덱스', emoji: '💵', format: 'number' }
        ];

        const macroResults = await Promise.all(
            macroDefs.map(async (macro) => {
                try {
                    const snapshot = await fetchYahooChartSnapshot(macro.symbol, '1mo');
                    const value = snapshot.price != null ? snapshot.price / (macro.divisor || 1) : null;
                    return {
                        key: macro.key,
                        symbol: macro.symbol,
                        name: macro.name,
                        emoji: macro.emoji,
                        value,
                        changePercent: snapshot.changePercent,
                        format: macro.format
                    };
                } catch (error) {
                    console.error(`매크로 조회 실패 (${macro.symbol}):`, error.message);
                    return {
                        key: macro.key,
                        symbol: macro.symbol,
                        name: macro.name,
                        emoji: macro.emoji,
                        value: null,
                        changePercent: 0,
                        format: macro.format
                    };
                }
            })
        );

        let usdKrw = null;
        try {
            usdKrw = await fetchUsdKrwFromGoogle();
        } catch (error) {
            console.error('USD/KRW 조회 실패:', error.message);
            const fallback = collector.getLatestData().commodities?.[0]?.usdKrw;
            usdKrw = fallback || null;
        }

        let mvrvZScore = null;
        try {
            const snapshot = await fetchCheckOnChainMetricSnapshot(
                'https://charts.checkonchain.com/btconchain/unrealised/mvrv_all_zscore/mvrv_all_zscore_light.html',
                'MVRV Z-Score'
            );
            mvrvZScore = {
                key: 'MVRV_Z',
                symbol: 'BTC-MVRV-Z',
                name: 'MVRV Z-Score',
                emoji: '₿',
                value: snapshot.value,
                previousValue: snapshot.previousValue,
                changeValue: snapshot.changeValue,
                changePercent: null,
                format: 'number'
            };
        } catch (error) {
            console.error('MVRV Z-Score 조회 실패:', error.message);
            mvrvZScore = {
                key: 'MVRV_Z',
                symbol: 'BTC-MVRV-Z',
                name: 'MVRV Z-Score',
                emoji: '₿',
                value: null,
                previousValue: null,
                changeValue: null,
                changePercent: null,
                format: 'number'
            };
        }

        res.json({
            success: true,
            data: [
                {
                    key: 'USD/KRW',
                    symbol: 'USD-KRW',
                    name: 'USD/KRW',
                    emoji: '💱',
                    value: usdKrw,
                    changePercent: null,
                    format: 'krw'
                },
                ...macroResults,
                mvrvZScore
            ]
        });
    } catch (error) {
        console.error('매크로 지표 API 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 환율 조회
app.get('/api/exchange-rate', async (req, res) => {
    try {
        let usdKrw = null;
        try {
            usdKrw = await fetchUsdKrwFromGoogle();
        } catch (error) {
            console.error('exchange-rate USD/KRW 조회 실패:', error.message);
            const data = collector.getLatestData();
            const gold = data.commodities?.[0];
            usdKrw = gold?.usdKrw || 1350;
        }

        res.json({
            success: true,
            data: {
                usdKrw,
                updatedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('환율 API 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 서버 시작
async function startServer() {
    console.log('\n🚀 투자 분석 대시보드 서버 시작...\n');

    // 1. 로컬 파일 스토리지 초기화
    storage.setupStorage();

    // 2. 저장된 로컬 캐시를 메모리로 복원
    collector.hydrateLatestDataFromStorage();

    // 3. Gemini LLM 초기화
    llmService.initLLM();

    // 4. 서버 리스닝을 먼저 시작
    app.listen(PORT, () => {
        console.log(`\n✅ 서버 실행 중: http://localhost:${PORT}`);
        console.log('📊 API 엔드포인트:');
        console.log(`   GET  http://localhost:${PORT}/api/stocks/overseas`);
        console.log(`   GET  http://localhost:${PORT}/api/stocks/korean`);
        console.log(`   GET  http://localhost:${PORT}/api/gold`);
        console.log(`   GET  http://localhost:${PORT}/api/crypto`);
        console.log(`   GET  http://localhost:${PORT}/api/news`);
        console.log(`   POST http://localhost:${PORT}/api/analysis/:symbol`);
        console.log(`   POST http://localhost:${PORT}/api/analysis/portfolio/all`);
        console.log(`   POST http://localhost:${PORT}/api/collect`);
        console.log(`\n🔄 자동 수집: 매일 오전 9시 (전일 종가 + 뉴스)\n`);
    });

    // 5. 초기 데이터 수집은 백그라운드에서 실행
    console.log('\n📡 초기 데이터 수집 시작 (백그라운드)...');
    collector.runCollection().catch((error) => {
        console.error('초기 데이터 수집 실패:', error.message);
    });

    // 6. 매일 오전 9시 자동 수집 (전일 종가 업데이트)
    cron.schedule('0 9 * * *', async () => {
        console.log('\n⏰ [오전 9시] 전일 종가 데이터 수집 시작...');
        await collector.runCollection();
    }, { timezone: 'Asia/Seoul' });
}

startServer().catch(console.error);
