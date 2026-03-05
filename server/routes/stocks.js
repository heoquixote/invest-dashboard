import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yahooFinance from '../services/yahooFinance.js';
import collector from '../services/collector.js';
import cache from '../utils/cache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CUSTOM_STOCKS_PATH = path.resolve(__dirname, '../../data/custom_stocks.json');

const router = Router();

// 커스텀 종목 파일 읽기/쓰기 헬퍼
function readCustomStocks() {
    try {
        if (fs.existsSync(CUSTOM_STOCKS_PATH)) {
            return JSON.parse(fs.readFileSync(CUSTOM_STOCKS_PATH, 'utf-8'));
        }
    } catch (e) { /* ignore */ }
    return [];
}

function writeCustomStocks(stocks) {
    fs.writeFileSync(CUSTOM_STOCKS_PATH, JSON.stringify(stocks, null, 2), 'utf-8');
}

/**
 * GET /api/stocks/themes - 테마 목록 메타데이터
 */
router.get('/themes', (req, res) => {
    const themes = {};
    for (const [key, theme] of Object.entries(yahooFinance.STOCK_THEMES)) {
        themes[key] = {
            id: theme.id,
            name: theme.name,
            market: theme.market,
            count: theme.stocks.length
        };
    }
    res.json({ success: true, data: themes });
});

/**
 * GET /api/stocks/overseas - 해외 주식 데이터
 */
router.get('/overseas', async (req, res) => {
    try {
        const cached = cache.get('overseas_stocks');
        if (cached) return res.json({ success: true, data: cached, cached: true });

        // 메모리 캐시에서 최신 수집 데이터 확인
        const latest = collector.getLatestData();
        if (latest.overseas.length > 0) {
            cache.set('overseas_stocks', latest.overseas, 5 * 60 * 1000);
            return res.json({ success: true, data: latest.overseas });
        }

        // 캐시 없으면 직접 조회
        const stocks = await yahooFinance.getOverseasStocks();
        cache.set('overseas_stocks', stocks, 5 * 60 * 1000);
        res.json({ success: true, data: stocks });
    } catch (error) {
        console.error('해외 주식 API 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/stocks/korean - 국내 주식 데이터
 */
router.get('/korean', async (req, res) => {
    try {
        const cached = cache.get('korean_stocks');
        if (cached) return res.json({ success: true, data: cached, cached: true });

        const latest = collector.getLatestData();
        if (latest.korean.length > 0) {
            cache.set('korean_stocks', latest.korean, 5 * 60 * 1000);
            return res.json({ success: true, data: latest.korean });
        }

        const stocks = await yahooFinance.getKoreanStocks();
        cache.set('korean_stocks', stocks, 5 * 60 * 1000);
        res.json({ success: true, data: stocks });
    } catch (error) {
        console.error('국내 주식 API 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/stocks/custom - 사용자 추가 종목 목록 + 실시간 시세
 */
router.get('/custom', async (req, res) => {
    try {
        const customStocks = readCustomStocks();
        if (customStocks.length === 0) {
            return res.json({ success: true, data: [] });
        }

        // 각 종목의 실시간 시세 조회
        const results = [];
        for (const item of customStocks) {
            let quote = await yahooFinance.getQuote(item.symbol);
            if (quote) {
                quote.name = item.name || quote.name || item.symbol;
                quote.theme = 'custom';
                quote.themeName = '⭐ 내가 추가한 종목';
                quote.market = item.market || 'overseas';
                quote.isCustom = true;
                results.push(quote);
            }
        }

        res.json({ success: true, data: results });
    } catch (error) {
        console.error('커스텀 종목 API 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/stocks/custom - 종목 추가
 * body: { symbol, name, market }
 */
router.post('/custom', (req, res) => {
    try {
        const { symbol, name, market } = req.body;
        if (!symbol) {
            return res.status(400).json({ success: false, error: '심볼을 입력해주세요' });
        }

        const stocks = readCustomStocks();
        const exists = stocks.find(s => s.symbol.toUpperCase() === symbol.toUpperCase());
        if (exists) {
            return res.status(409).json({ success: false, error: '이미 추가된 종목입니다' });
        }

        const newStock = {
            symbol: symbol.toUpperCase(),
            name: name || symbol.toUpperCase(),
            market: market || 'overseas',
            addedAt: new Date().toISOString()
        };

        stocks.push(newStock);
        writeCustomStocks(stocks);

        console.log(`⭐ 커스텀 종목 추가: ${newStock.symbol} (${newStock.name})`);
        res.json({ success: true, data: newStock, message: `${newStock.name} 추가 완료` });
    } catch (error) {
        console.error('종목 추가 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/stocks/custom/:symbol - 종목 삭제
 */
router.delete('/custom/:symbol', (req, res) => {
    try {
        const { symbol } = req.params;
        let stocks = readCustomStocks();
        const before = stocks.length;
        stocks = stocks.filter(s => s.symbol.toUpperCase() !== symbol.toUpperCase());

        if (stocks.length === before) {
            return res.status(404).json({ success: false, error: '해당 종목을 찾을 수 없습니다' });
        }

        writeCustomStocks(stocks);
        console.log(`🗑️ 커스텀 종목 삭제: ${symbol}`);
        res.json({ success: true, message: `${symbol} 삭제 완료` });
    } catch (error) {
        console.error('종목 삭제 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/stocks/:symbol/history - 종목 히스토리 (차트)
 */
router.get('/:symbol/history', async (req, res) => {
    try {
        const { symbol } = req.params;
        const period = req.query.period || '3mo';
        const cacheKey = `history_${symbol}_${period}`;

        const cached = cache.get(cacheKey);
        if (cached) return res.json({ success: true, data: cached, cached: true });

        const history = await yahooFinance.getHistory(symbol, period);
        cache.set(cacheKey, history, 10 * 60 * 1000);
        res.json({ success: true, data: history });
    } catch (error) {
        console.error(`히스토리 API 오류 (${req.params.symbol}):`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
