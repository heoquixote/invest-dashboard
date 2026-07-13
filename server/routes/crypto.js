import { Router } from 'express';
import yahooFinance from '../services/yahooFinance.js';
import collector from '../services/collector.js';
import cache from '../utils/cache.js';

const router = Router();

/**
 * GET /api/crypto - 암호화폐 시세
 */
router.get('/', async (req, res) => {
    try {
        const cached = cache.get('crypto');
        if (Array.isArray(cached) && cached.length > 0) {
            return res.json({ success: true, data: cached, cached: true });
        }

        const latest = collector.getLatestData();
        if (latest.crypto && latest.crypto.length > 0) {
            cache.set('crypto', latest.crypto, 5 * 60 * 1000);
            return res.json({ success: true, data: latest.crypto });
        }

        const crypto = await yahooFinance.getCrypto();
        if (crypto.length > 0) {
            cache.set('crypto', crypto, 5 * 60 * 1000);
            return res.json({ success: true, data: crypto });
        }

        res.json({ success: true, data: latest.crypto || [] });
    } catch (error) {
        console.error('암호화폐 API 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
