import yahooFinance from '../services/yahooFinance.js';
import storage from '../services/localStorage.js';
import newsService from '../services/newsService.js';

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

async function collectMarketNews() {
    const news = await newsService.collectMarketNews();
    const rows = Object.entries(news.items).flatMap(([category, items]) =>
        items.map(item => [
            category,
            item.title,
            item.link,
            item.source,
            item.publishedAt || '',
            item.summary || ''
        ])
    );

    storage.writeSheet('시장뉴스', rows.map(row => ({
        카테고리: row[0],
        제목: row[1],
        링크: row[2],
        출처: row[3],
        게시시각: row[4],
        요약: row[5]
    })));

    latestData.news = news;

    return news;
}

/**
 * 전체 데이터 수집 실행
 */
async function collectAll() {
    console.log('\n🔄 ===== 전체 데이터 수집 시작 =====');
    const startTime = Date.now();

    let overseas = [], korean = [], commodities = [], crypto = [];
    let news = { updatedAt: null, categories: newsService.NEWS_CATEGORIES, items: {} };

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

    try {
        news = await collectMarketNews();
    } catch (e) {
        console.error('❌ 시장 뉴스 수집 실패:', e.message);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ ===== 전체 수집 완료 (${elapsed}초) =====\n`);

    return { overseas, korean, commodities, crypto, news };
}

// 최신 수집 데이터 메모리 캐시
let latestData = { overseas: [], korean: [], commodities: [], crypto: [], news: { updatedAt: null, categories: newsService.NEWS_CATEGORIES, items: {} } };
let lastCollectedAt = null;

function buildThemeLookup(market) {
    const lookup = new Map();
    Object.values(yahooFinance.STOCK_THEMES)
        .filter(theme => theme.market === market)
        .forEach(theme => {
            theme.stocks.forEach(stock => {
                lookup.set(stock.symbol, {
                    name: stock.name,
                    theme: theme.id,
                    themeName: theme.name,
                    korCode: stock.korCode
                });
            });
        });
    return lookup;
}

function getLatestEntries(rows, getSymbol) {
    const latestBySymbol = new Map();
    rows.forEach(row => {
        const symbol = getSymbol(row);
        if (symbol) latestBySymbol.set(symbol, row);
    });
    return Array.from(latestBySymbol.values());
}

function loadCachedOverseas() {
    const themeLookup = buildThemeLookup('overseas');
    const rows = storage.readSheet('해외주식');

    return getLatestEntries(rows, row => row['종목코드']).map(row => {
        const meta = themeLookup.get(row['종목코드']) || {};
        return {
            symbol: row['종목코드'],
            name: meta.name || row['종목명'],
            price: Number(row['현재가(USD)']) || 0,
            changePercent: Number(row['변동률(%)']) || 0,
            dailyChangePercent: Number(row['변동률(%)']) || 0,
            volume: Number(row['거래량']) || 0,
            high52: Number(row['52주최고']) || 0,
            low52: Number(row['52주최저']) || 0,
            marketCap: Number(row['시가총액']) || 0,
            currency: 'USD',
            theme: meta.theme,
            themeName: meta.themeName,
            history: []
        };
    });
}

function loadCachedKorean() {
    const themeLookup = buildThemeLookup('korean');
    const rows = storage.readSheet('국내주식');

    return getLatestEntries(rows, row => row['종목코드']).map(row => {
        const meta = themeLookup.get(row['종목코드']) || {};
        return {
            symbol: row['종목코드'],
            korCode: meta.korCode,
            name: meta.name || row['종목명'],
            price: Number(row['현재가(KRW)']) || 0,
            changePercent: Number(row['변동률(%)']) || 0,
            dailyChangePercent: Number(row['변동률(%)']) || 0,
            volume: Number(row['거래량']) || 0,
            high52: Number(row['52주최고']) || 0,
            low52: Number(row['52주최저']) || 0,
            marketCap: Number(row['시가총액']) || 0,
            currency: 'KRW',
            theme: meta.theme,
            themeName: meta.themeName,
            history: []
        };
    });
}

function loadCachedCommodities() {
    const themeLookup = buildThemeLookup('commodity');
    const rows = storage.readSheet('금_원자재');

    return getLatestEntries(rows, row => row['종목코드']).map(row => {
        const meta = themeLookup.get(row['종목코드']) || {};
        return {
            symbol: row['종목코드'],
            name: meta.name || row['종목명'],
            price: Number(row['현재가(USD)']) || 0,
            priceKRW: Number(row['KRW환산가']) || 0,
            usdKrw: row['KRW환산가'] && row['현재가(USD)'] ? Number(row['KRW환산가']) / Number(row['현재가(USD)']) : 0,
            changePercent: Number(row['변동률(%)']) || 0,
            dailyChangePercent: Number(row['변동률(%)']) || 0,
            currency: 'USD',
            theme: meta.theme,
            themeName: meta.themeName,
            history: []
        };
    });
}

function loadCachedCrypto() {
    const themeLookup = buildThemeLookup('crypto');
    const rows = storage.readSheet('암호화폐');

    return getLatestEntries(rows, row => Array.isArray(row) ? row[2] : row['종목코드']).map(row => {
        const symbol = Array.isArray(row) ? row[2] : row['종목코드'];
        const name = Array.isArray(row) ? row[3] : row['종목명'];
        const price = Array.isArray(row) ? row[4] : row['현재가(KRW)'];
        const changePercent = Array.isArray(row) ? row[5] : row['변동률(%)'];
        const priceKRW = Array.isArray(row) ? row[6] : row['KRW환산가'];
        const meta = themeLookup.get(symbol) || {};

        return {
            symbol,
            name: meta.name || name,
            price: Number(price) || 0,
            priceKRW: Number(priceKRW) || Number(price) || 0,
            changePercent: Number(changePercent) || 0,
            dailyChangePercent: Number(changePercent) || 0,
            currency: 'KRW',
            theme: meta.theme,
            themeName: meta.themeName,
            history: []
        };
    });
}

function loadCachedCollectionInfo() {
    const historyRows = storage.readSheet('수집이력');
    const lastRow = historyRows.at(-1);
    if (!lastRow) return;

    const date = lastRow['날짜'];
    const time = lastRow['시간'];
    if (date && time) {
        lastCollectedAt = new Date(`${date}T${time}:00+09:00`).toISOString();
    }
}

function loadCachedNews() {
    const rows = storage.readSheet('시장뉴스');
    const items = {};

    newsService.NEWS_CATEGORIES.forEach(category => {
        items[category.id] = rows
            .filter(row => row['카테고리'] === category.id)
            .map(row => ({
                category: category.id,
                categoryName: category.name,
                title: row['제목'],
                link: row['링크'],
                source: row['출처'],
                publishedAt: row['게시시각'] || null,
                summary: row['요약'] || row['제목']
            }));
    });

    return {
        updatedAt: lastCollectedAt,
        categories: newsService.NEWS_CATEGORIES,
        items
    };
}

function hydrateLatestDataFromStorage() {
    latestData = {
        overseas: loadCachedOverseas(),
        korean: loadCachedKorean(),
        commodities: loadCachedCommodities(),
        crypto: loadCachedCrypto(),
        news: loadCachedNews()
    };
    loadCachedCollectionInfo();
    latestData.news.updatedAt = lastCollectedAt;

    const totalCount = latestData.overseas.length + latestData.korean.length + latestData.commodities.length + latestData.crypto.length;
    console.log(`📦 로컬 캐시 데이터 로드 완료 (${totalCount}개 종목)`);
    return latestData;
}

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
        },
        newsUpdatedAt: latestData.news?.updatedAt || null
    };
}

export default {
    collectOverseasStocks,
    collectKoreanStocks,
    collectCommodities,
    collectCrypto,
    collectMarketNews,
    collectAll,
    runCollection,
    hydrateLatestDataFromStorage,
    getLatestData,
    getCollectionInfo
};
