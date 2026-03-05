import { Router } from 'express';
import llmService from '../services/llmService.js';
import yahooFinance from '../services/yahooFinance.js';
import collector from '../services/collector.js';
import cache from '../utils/cache.js';

const router = Router();

/**
 * POST /api/analysis/:symbol - 개별 종목 분석
 */
router.post('/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const cacheKey = `analysis_${symbol}`;

        const cached = cache.get(cacheKey);
        if (cached) return res.json({ success: true, data: cached, cached: true });

        // 종목 데이터 조회
        const quote = await yahooFinance.getQuote(symbol);
        if (!quote) {
            return res.status(404).json({ success: false, error: '종목을 찾을 수 없습니다' });
        }

        // 히스토리 데이터 조회
        const history = await yahooFinance.getHistory(symbol, '3mo');

        // LLM 분석
        const analysis = await llmService.analyzeStock(quote, history);

        // 결과 캐시 (30분)
        const result = { ...analysis, symbol, name: quote.name, price: quote.price, analyzedAt: new Date().toISOString() };
        cache.set(cacheKey, result, 30 * 60 * 1000);

        // 스프레드시트에 기록
        await llmService.saveAnalysisToSheet(symbol, quote.name, analysis);

        res.json({ success: true, data: result });
    } catch (error) {
        console.error(`분석 API 오류 (${req.params.symbol}):`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/analysis/portfolio/all - 전체 포트폴리오 분석
 */
router.post('/portfolio/all', async (req, res) => {
    try {
        const cached = cache.get('portfolio_analysis');
        if (cached) return res.json({ success: true, data: cached, cached: true });

        // 모든 종목 데이터 수집
        const latest = collector.getLatestData();
        const allStocks = [...latest.overseas, ...latest.korean, ...latest.commodities];

        if (allStocks.length === 0) {
            return res.status(400).json({ success: false, error: '수집된 데이터가 없습니다. 잠시 후 재시도해주세요.' });
        }

        const analysis = await llmService.analyzePortfolio(allStocks);
        const result = { ...analysis, analyzedAt: new Date().toISOString(), stockCount: allStocks.length };
        cache.set('portfolio_analysis', result, 30 * 60 * 1000);

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('포트폴리오 분석 API 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/analysis/status - LLM 연결 상태
 */
router.get('/status', (req, res) => {
    const hasKey = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here';
    res.json({
        success: true,
        llmEnabled: hasKey,
        message: hasKey ? 'Gemini API 연결됨' : 'Gemini API 키가 설정되지 않았습니다'
    });
});

export default router;
