import yahooFinance from '../services/yahooFinance.js';
import storage from '../services/localStorage.js';

/**
 * 데이터 수집기 - Yahoo Finance → 로컬 JSON 파일 기록
 */

function formatDate() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatTime() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${h}:${min}`;
}

/**
 * 해외 주식 수집 → 스프레드시트 기록
 */
async function collectOverseasStocks() {
    console.log('📡 해외 주식 데이터 수집 중...');
    const stocks = await yahooFinance.getOverseasStocks();
    const date = formatDate();
    const time = formatTime();

    const rows = stocks.map(s => [
        date, time, s.symbol, s.name,
        s.price, s.changePercent?.toFixed(2),
        s.volume, s.high52, s.low52, s.marketCap
    ]);

    storage.appendRows('해외주식', rows);
    console.log(`✅ 해외 주식 ${stocks.length}개 수집 완료`);
    return stocks;
}

/**
 * 국내 주식 수집 → 스프레드시트 기록
 */
async function collectKoreanStocks() {
    console.log('📡 국내 주식 데이터 수집 중...');
    const stocks = await yahooFinance.getKoreanStocks();
    const date = formatDate();
    const time = formatTime();

    const rows = stocks.map(s => [
        date, time, s.symbol, s.name,
        s.price, s.changePercent?.toFixed(2),
        s.volume, s.high52, s.low52, s.marketCap
    ]);

    storage.appendRows('국내주식', rows);
    console.log(`✅ 국내 주식 ${stocks.length}개 수집 완료`);
    return stocks;
}

/**
 * 금/원자재 수집 → 스프레드시트 기록
 */
async function collectCommodities() {
    console.log('📡 금/원자재 데이터 수집 중...');
    const commodities = await yahooFinance.getCommodities();
    const date = formatDate();
    const time = formatTime();

    const rows = commodities.map(c => [
        date, time, c.symbol, c.name,
        c.price, c.changePercent?.toFixed(2),
        c.priceKRW || ''
    ]);

    storage.appendRows('금_원자재', rows);
    console.log(`✅ 금/원자재 ${commodities.length}개 수집 완료`);
    return commodities;
}

/**
 * 암호화폐 수집 → 스프레드시트 기록
 */
async function collectCrypto() {
    console.log('📡 암호화폐 데이터 수집 중...');
    const crypto = await yahooFinance.getCrypto();
    const date = formatDate();
    const time = formatTime();

    const rows = crypto.map(c => [
        date, time, c.symbol, c.name,
        c.price, c.changePercent?.toFixed(2),
        c.priceKRW || ''
    ]);

    storage.appendRows('암호화폐', rows);
    console.log(`✅ 암호화폐 ${crypto.length}개 수집 완료`);
    return crypto;
}

/**
 * 전체 데이터 수집 실행
 */
async function collectAll() {
    console.log('\n🔄 ===== 전체 데이터 수집 시작 =====');
    const startTime = Date.now();

    let overseas = [], korean = [], commodities = [], crypto = [];

    try {
        overseas = await collectOverseasStocks();
    } catch (e) {
        console.error('❌ 해외 주식 수집 실패:', e.message);
    }

    try {
        korean = await collectKoreanStocks();
    } catch (e) {
        console.error('❌ 국내 주식 수집 실패:', e.message);
    }

    try {
        commodities = await collectCommodities();
    } catch (e) {
        console.error('❌ 금/원자재 수집 실패:', e.message);
    }

    try {
        crypto = await collectCrypto();
    } catch (e) {
        console.error('❌ 암호화폐 수집 실패:', e.message);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ ===== 전체 수집 완료 (${elapsed}초) =====\n`);

    return { overseas, korean, commodities, crypto };
}

// 최신 수집 데이터 메모리 캐시
let latestData = { overseas: [], korean: [], commodities: [], crypto: [] };
let lastCollectedAt = null;

async function runCollection() {
    latestData = await collectAll();
    lastCollectedAt = new Date().toISOString();

    // 수집 타임스탬프도 로컬 파일로 저장
    storage.appendRows('수집이력', [[
        formatDate(), formatTime(),
        latestData.overseas.length,
        latestData.korean.length,
        latestData.commodities.length,
        latestData.crypto.length
    ]]);

    return latestData;
}

function getLatestData() {
    return latestData;
}

function getCollectionInfo() {
    return {
        lastCollectedAt,
        counts: {
            overseas: latestData.overseas.length,
            korean: latestData.korean.length,
            commodities: latestData.commodities.length,
            crypto: latestData.crypto.length
        }
    };
}

export default {
    collectOverseasStocks,
    collectKoreanStocks,
    collectCommodities,
    collectCrypto,
    collectAll,
    runCollection,
    getLatestData,
    getCollectionInfo
};
