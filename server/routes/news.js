import { Router } from 'express';
import collector from '../services/collector.js';

const router = Router();

router.get('/', (req, res) => {
    try {
        const latest = collector.getLatestData();
        res.json({
            success: true,
            data: latest.news || {
                updatedAt: null,
                categories: [],
                items: {}
            }
        });
    } catch (error) {
        console.error('시장 뉴스 API 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
