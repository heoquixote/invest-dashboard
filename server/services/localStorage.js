import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 데이터 저장 디렉토리
const DATA_DIR = path.resolve(__dirname, '../../data');

/**
 * 데이터 디렉토리 초기화
 */
function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        console.log(`📁 데이터 디렉토리 생성: ${DATA_DIR}`);
    }
}

/**
 * 시트(파일) 경로 반환
 */
function getFilePath(sheetName) {
    return path.join(DATA_DIR, `${sheetName}.json`);
}

/**
 * 시트 데이터 읽기
 */
function readSheet(sheetName) {
    const filePath = getFilePath(sheetName);
    if (!fs.existsSync(filePath)) {
        return [];
    }
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
    } catch (error) {
        console.error(`❌ 파일 읽기 실패 (${sheetName}):`, error.message);
        return [];
    }
}

/**
 * 시트 데이터 쓰기
 */
function writeSheet(sheetName, data) {
    ensureDataDir();
    const filePath = getFilePath(sheetName);
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        return true;
    } catch (error) {
        console.error(`❌ 파일 쓰기 실패 (${sheetName}):`, error.message);
        return false;
    }
}

/**
 * 행 추가 (Google Sheets appendRows 대체)
 * rows: 2차원 배열 [[col1, col2, ...], ...]
 */
function appendRows(sheetName, rows) {
    const existing = readSheet(sheetName);
    const meta = sheetMeta[sheetName];

    if (!meta) {
        // 메타 정보 없으면 raw 배열로 저장
        existing.push(...rows);
        return writeSheet(sheetName, existing);
    }

    // 헤더 기반으로 객체 변환하여 저장
    const newEntries = rows.map(row => {
        const obj = {};
        meta.headers.forEach((header, i) => {
            obj[header] = row[i] !== undefined ? row[i] : '';
        });
        return obj;
    });

    existing.push(...newEntries);

    // 최대 저장 건수 제한 (종목별 최대 1000건)
    const MAX_RECORDS = 5000;
    const trimmed = existing.length > MAX_RECORDS
        ? existing.slice(-MAX_RECORDS)
        : existing;

    return writeSheet(sheetName, trimmed);
}

/**
 * 각 종목의 최신 데이터 조회
 */
function getLatestData(sheetName) {
    const data = readSheet(sheetName);
    if (data.length === 0) return [];

    // 종목별 최신 데이터만 추출 (마지막 항목이 최신)
    const latestBySymbol = new Map();
    for (const entry of data) {
        const symbol = entry['종목코드'];
        if (symbol) {
            latestBySymbol.set(symbol, entry);
        }
    }

    return Array.from(latestBySymbol.values());
}

/**
 * 특정 종목의 히스토리 데이터 조회
 */
function getHistoryData(sheetName, symbol, limit = 30) {
    const data = readSheet(sheetName);
    return data
        .filter(entry => entry['종목코드'] === symbol)
        .slice(-limit);
}

/**
 * 시트 메타데이터 (헤더 정의)
 */
const sheetMeta = {
    '해외주식': {
        headers: ['날짜', '시간', '종목코드', '종목명', '현재가(USD)', '변동률(%)', '거래량', '52주최고', '52주최저', '시가총액']
    },
    '국내주식': {
        headers: ['날짜', '시간', '종목코드', '종목명', '현재가(KRW)', '변동률(%)', '거래량', '52주최고', '52주최저', '시가총액']
    },
    '금_원자재': {
        headers: ['날짜', '시간', '종목코드', '종목명', '현재가(USD)', '변동률(%)', 'KRW환산가']
    },
    'LLM분석': {
        headers: ['날짜', '종목코드', '종목명', '추천', '신뢰도(%)', '리스크', '분석근거', '목표가']
    },
    '수집이력': {
        headers: ['날짜', '시간', '해외주식수', '국내주식수', '원자재수']
    }
};

/**
 * 초기 설정 (디렉토리 생성 + 빈 파일 초기화)
 */
function setupStorage() {
    ensureDataDir();

    for (const sheetName of Object.keys(sheetMeta)) {
        const filePath = getFilePath(sheetName);
        if (!fs.existsSync(filePath)) {
            writeSheet(sheetName, []);
            console.log(`📋 데이터 파일 생성: ${sheetName}.json`);
        }
    }

    console.log('✅ 로컬 파일 스토리지 초기 설정 완료');
    return true;
}

export default {
    setupStorage,
    appendRows,
    readSheet,
    getLatestData,
    getHistoryData,
    ensureDataDir
};
