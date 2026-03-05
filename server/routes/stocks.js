import { Router } from 'express';
import yahooFinance from '../services/yahooFinance.js';
import collector from '../services/collector.js';
import cache from '../utils/cache.js';

const router = Router();

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
