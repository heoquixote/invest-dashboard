import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PRIVATE_HISTORY_PATH = path.resolve(__dirname, '../../data/private_history.json');

const router = Router();

function ensurePrivateHistoryFile() {
    if (!fs.existsSync(PRIVATE_HISTORY_PATH)) {
        fs.writeFileSync(PRIVATE_HISTORY_PATH, '[]', 'utf-8');
    }
}

function readPrivateHistory() {
    try {
        ensurePrivateHistoryFile();
        return JSON.parse(fs.readFileSync(PRIVATE_HISTORY_PATH, 'utf-8'));
    } catch (error) {
        console.error('개인 히스토리 읽기 실패:', error.message);
        return [];
    }
}

router.get('/history', (req, res) => {
    res.json({ success: true, data: readPrivateHistory() });
});

export default router;
