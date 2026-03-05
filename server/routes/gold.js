import { Router } from 'express';
import yahooFinance from '../services/yahooFinance.js';
import collector from '../services/collector.js';
import cache from '../utils/cache.js';

const router = Router();

/**
 * GET /api/gold - 금/원자재 시세
 */
router.get('/', async (req, res) => {
    try {
        const cached = cache.get('commodities');
        if (cached) return res.json({ success: true, data: cached, cached: true });

        const latest = collector.getLatestData();
        if (latest.commodities.length > 0) {
            cache.set('commodities', latest.commodities, 5 * 60 * 1000);
            return res.json({ success: true, data: latest.commodities });
        }

        const commodities = await yahooFinance.getCommodities();
        cache.set('commodities', commodities, 5 * 60 * 1000);
        res.json({ success: true, data: commodities });
    } catch (error) {
        console.error('금/원자재 API 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
