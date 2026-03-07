/**
 * 주식 데이터 수집 서비스
 * Yahoo Finance v8 API 직접 호출 + Google Finance 폴백
 */

// ========== 테마별 종목 그룹 ==========

const STOCK_THEMES = {
    // ═══════════════════════════════════
    // 해외 주식 (시총 상위 ~100개)
    // ═══════════════════════════════════
    tech: {
        id: 'tech', name: '🖥️ 기술주 (Tech)', market: 'overseas',
        stocks: [
            { symbol: 'AAPL', name: 'Apple', gFinance: 'AAPL:NASDAQ' },
            { symbol: 'MSFT', name: 'Microsoft', gFinance: 'MSFT:NASDAQ' },
            { symbol: 'GOOGL', name: 'Alphabet', gFinance: 'GOOGL:NASDAQ' },
            { symbol: 'META', name: 'Meta', gFinance: 'META:NASDAQ' },
            { symbol: 'ORCL', name: 'Oracle', gFinance: 'ORCL:NYSE' },
            { symbol: 'ADBE', name: 'Adobe', gFinance: 'ADBE:NASDAQ' },
            { symbol: 'CSCO', name: 'Cisco', gFinance: 'CSCO:NASDAQ' },
            { symbol: 'INTC', name: 'Intel', gFinance: 'INTC:NASDAQ' },
            { symbol: 'IBM', name: 'IBM', gFinance: 'IBM:NYSE' },
            { symbol: 'NOW', name: 'ServiceNow', gFinance: 'NOW:NYSE' },
            { symbol: 'WDC', name: 'Western Digital (SanDisk)', gFinance: 'WDC:NASDAQ' },
        ]
    },
    semiconductor: {
        id: 'semiconductor', name: '💾 반도체 (Semiconductor)', market: 'overseas',
        stocks: [
            { symbol: 'NVDA', name: 'NVIDIA', gFinance: 'NVDA:NASDAQ' },
            { symbol: 'TSM', name: 'TSMC', gFinance: 'TSM:NYSE' },
            { symbol: 'AVGO', name: 'Broadcom', gFinance: 'AVGO:NASDAQ' },
            { symbol: 'AMD', name: 'AMD', gFinance: 'AMD:NASDAQ' },
            { symbol: 'QCOM', name: 'Qualcomm', gFinance: 'QCOM:NASDAQ' },
            { symbol: 'TXN', name: 'Texas Instruments', gFinance: 'TXN:NASDAQ' },
            { symbol: 'MU', name: 'Micron', gFinance: 'MU:NASDAQ' },
            { symbol: 'LRCX', name: 'Lam Research', gFinance: 'LRCX:NASDAQ' },
            { symbol: 'AMAT', name: 'Applied Materials', gFinance: 'AMAT:NASDAQ' },
            { symbol: 'KLAC', name: 'KLA Corp', gFinance: 'KLAC:NASDAQ' },
        ]
    },
    defense: {
        id: 'defense', name: '🛡️ 방산/항공 (Defense)', market: 'overseas',
        stocks: [
            { symbol: 'LMT', name: 'Lockheed Martin', gFinance: 'LMT:NYSE' },
            { symbol: 'RTX', name: 'RTX (Raytheon)', gFinance: 'RTX:NYSE' },
            { symbol: 'NOC', name: 'Northrop Grumman', gFinance: 'NOC:NYSE' },
            { symbol: 'BA', name: 'Boeing', gFinance: 'BA:NYSE' },
            { symbol: 'GD', name: 'General Dynamics', gFinance: 'GD:NYSE' },
            { symbol: 'LHX', name: 'L3Harris', gFinance: 'LHX:NYSE' },
            { symbol: 'HII', name: 'Huntington Ingalls', gFinance: 'HII:NYSE' },
        ]
    },
    energy: {
        id: 'energy', name: '⚡ 에너지 (Energy)', market: 'overseas',
        stocks: [
            { symbol: 'XOM', name: 'ExxonMobil', gFinance: 'XOM:NYSE' },
            { symbol: 'CVX', name: 'Chevron', gFinance: 'CVX:NYSE' },
            { symbol: 'COP', name: 'ConocoPhillips', gFinance: 'COP:NYSE' },
            { symbol: 'SLB', name: 'Schlumberger', gFinance: 'SLB:NYSE' },
            { symbol: 'EOG', name: 'EOG Resources', gFinance: 'EOG:NYSE' },
            { symbol: 'TSLA', name: 'Tesla', gFinance: 'TSLA:NASDAQ' },
            { symbol: 'NEE', name: 'NextEra Energy', gFinance: 'NEE:NYSE' },
            { symbol: 'ENPH', name: 'Enphase Energy', gFinance: 'ENPH:NASDAQ' },
        ]
    },
    consumer: {
        id: 'consumer', name: '🛒 소비재 (Consumer)', market: 'overseas',
        stocks: [
            { symbol: 'AMZN', name: 'Amazon', gFinance: 'AMZN:NASDAQ' },
            { symbol: 'WMT', name: 'Walmart', gFinance: 'WMT:NYSE' },
            { symbol: 'PG', name: 'Procter & Gamble', gFinance: 'PG:NYSE' },
            { symbol: 'KO', name: 'Coca-Cola', gFinance: 'KO:NYSE' },
            { symbol: 'PEP', name: 'PepsiCo', gFinance: 'PEP:NASDAQ' },
            { symbol: 'COST', name: 'Costco', gFinance: 'COST:NASDAQ' },
            { symbol: 'NKE', name: 'Nike', gFinance: 'NKE:NYSE' },
            { symbol: 'MCD', name: "McDonald's", gFinance: 'MCD:NYSE' },
            { symbol: 'SBUX', name: 'Starbucks', gFinance: 'SBUX:NASDAQ' },
            { symbol: 'DIS', name: 'Disney', gFinance: 'DIS:NYSE' },
        ]
    },
    healthcare: {
        id: 'healthcare', name: '💊 헬스케어 (Healthcare)', market: 'overseas',
        stocks: [
            { symbol: 'UNH', name: 'UnitedHealth', gFinance: 'UNH:NYSE' },
            { symbol: 'JNJ', name: 'Johnson & Johnson', gFinance: 'JNJ:NYSE' },
            { symbol: 'LLY', name: 'Eli Lilly', gFinance: 'LLY:NYSE' },
            { symbol: 'ABBV', name: 'AbbVie', gFinance: 'ABBV:NYSE' },
            { symbol: 'PFE', name: 'Pfizer', gFinance: 'PFE:NYSE' },
            { symbol: 'MRK', name: 'Merck', gFinance: 'MRK:NYSE' },
            { symbol: 'TMO', name: 'Thermo Fisher', gFinance: 'TMO:NYSE' },
            { symbol: 'ABT', name: 'Abbott Labs', gFinance: 'ABT:NYSE' },
            { symbol: 'ISRG', name: 'Intuitive Surgical', gFinance: 'ISRG:NASDAQ' },
            { symbol: 'REGN', name: 'Regeneron', gFinance: 'REGN:NASDAQ' },
        ]
    },
    finance: {
        id: 'finance', name: '🏦 금융 (Finance)', market: 'overseas',
        stocks: [
            { symbol: 'JPM', name: 'JPMorgan Chase', gFinance: 'JPM:NYSE' },
            { symbol: 'V', name: 'Visa', gFinance: 'V:NYSE' },
            { symbol: 'MA', name: 'Mastercard', gFinance: 'MA:NYSE' },
            { symbol: 'BAC', name: 'Bank of America', gFinance: 'BAC:NYSE' },
            { symbol: 'GS', name: 'Goldman Sachs', gFinance: 'GS:NYSE' },
            { symbol: 'MS', name: 'Morgan Stanley', gFinance: 'MS:NYSE' },
            { symbol: 'BLK', name: 'BlackRock', gFinance: 'BLK:NYSE' },
            { symbol: 'PYPL', name: 'PayPal', gFinance: 'PYPL:NASDAQ' },
            { symbol: 'C', name: 'Citigroup', gFinance: 'C:NYSE' },
            { symbol: 'AXP', name: 'American Express', gFinance: 'AXP:NYSE' },
        ]
    },
    communication: {
        id: 'communication', name: '📡 통신/미디어 (Comm)', market: 'overseas',
        stocks: [
            { symbol: 'NFLX', name: 'Netflix', gFinance: 'NFLX:NASDAQ' },
            { symbol: 'T', name: 'AT&T', gFinance: 'T:NYSE' },
            { symbol: 'VZ', name: 'Verizon', gFinance: 'VZ:NYSE' },
            { symbol: 'TMUS', name: 'T-Mobile', gFinance: 'TMUS:NASDAQ' },
            { symbol: 'CMCSA', name: 'Comcast', gFinance: 'CMCSA:NASDAQ' },
            { symbol: 'SPOT', name: 'Spotify', gFinance: 'SPOT:NYSE' },
        ]
    },
    industrial: {
        id: 'industrial', name: '🏭 산업재 (Industrial)', market: 'overseas',
        stocks: [
            { symbol: 'CAT', name: 'Caterpillar', gFinance: 'CAT:NYSE' },
            { symbol: 'DE', name: 'Deere & Co', gFinance: 'DE:NYSE' },
            { symbol: 'UPS', name: 'UPS', gFinance: 'UPS:NYSE' },
            { symbol: 'HON', name: 'Honeywell', gFinance: 'HON:NASDAQ' },
            { symbol: 'GE', name: 'GE Aerospace', gFinance: 'GE:NYSE' },
            { symbol: 'MMM', name: '3M', gFinance: 'MMM:NYSE' },
        ]
    },
    ai_data: {
        id: 'ai_data', name: '🤖 AI/데이터 (AI)', market: 'overseas',
        stocks: [
            { symbol: 'CRM', name: 'Salesforce', gFinance: 'CRM:NYSE' },
            { symbol: 'SNOW', name: 'Snowflake', gFinance: 'SNOW:NYSE' },
            { symbol: 'PLTR', name: 'Palantir', gFinance: 'PLTR:NASDAQ' },
            { symbol: 'MDB', name: 'MongoDB', gFinance: 'MDB:NASDAQ' },
            { symbol: 'DDOG', name: 'Datadog', gFinance: 'DDOG:NASDAQ' },
            { symbol: 'AI', name: 'C3.ai', gFinance: 'AI:NYSE' },
            { symbol: 'PATH', name: 'UiPath', gFinance: 'PATH:NYSE' },
        ]
    },

    // ═══════════════════════════════════
    // 해외 ETF (주요 대형)
    // ═══════════════════════════════════
    etf_us: {
        id: 'etf_us', name: '📊 해외 ETF', market: 'overseas',
        stocks: [
            { symbol: 'SPY', name: 'SPDR S&P 500', gFinance: 'SPY:NYSEARCA' },
            { symbol: 'QQQ', name: 'Invesco QQQ (나스닥100)', gFinance: 'QQQ:NASDAQ' },
            { symbol: 'IWM', name: 'iShares Russell 2000', gFinance: 'IWM:NYSEARCA' },
            { symbol: 'DIA', name: 'SPDR Dow Jones', gFinance: 'DIA:NYSEARCA' },
            { symbol: 'VTI', name: 'Vanguard Total Market', gFinance: 'VTI:NYSEARCA' },
            { symbol: 'VOO', name: 'Vanguard S&P 500', gFinance: 'VOO:NYSEARCA' },
            { symbol: 'ARKK', name: 'ARK Innovation', gFinance: 'ARKK:NYSEARCA' },
            { symbol: 'XLF', name: 'Financial Select SPDR', gFinance: 'XLF:NYSEARCA' },
            { symbol: 'XLE', name: 'Energy Select SPDR', gFinance: 'XLE:NYSEARCA' },
            { symbol: 'SOXX', name: 'iShares Semiconductor', gFinance: 'SOXX:NASDAQ' },
        ]
    },

    // ═══════════════════════════════════
    // 국내 주식 (시총 상위 ~100개)
    // ═══════════════════════════════════
    kr_major: {
        id: 'kr_major', name: '🇰🇷 대표주', market: 'korean',
        stocks: [
            { symbol: '005930.KS', name: '삼성전자', korCode: '005930', gFinance: '005930:KRX' },
            { symbol: '000660.KS', name: 'SK하이닉스', korCode: '000660', gFinance: '000660:KRX' },
            { symbol: '005380.KS', name: '현대차', korCode: '005380', gFinance: '005380:KRX' },
            { symbol: '005490.KS', name: 'POSCO홀딩스', korCode: '005490', gFinance: '005490:KRX' },
            { symbol: '006400.KS', name: '삼성SDI', korCode: '006400', gFinance: '006400:KRX' },
            { symbol: '035420.KS', name: 'NAVER', korCode: '035420', gFinance: '035420:KRX' },
            { symbol: '035720.KS', name: '카카오', korCode: '035720', gFinance: '035720:KRX' },
            { symbol: '051910.KS', name: 'LG화학', korCode: '051910', gFinance: '051910:KRX' },
            { symbol: '003670.KS', name: '포스코퓨처엠', korCode: '003670', gFinance: '003670:KRX' },
            { symbol: '000270.KS', name: '기아', korCode: '000270', gFinance: '000270:KRX' },
        ]
    },
    kr_finance: {
        id: 'kr_finance', name: '🏦 국내 금융', market: 'korean',
        stocks: [
            { symbol: '055550.KS', name: '신한지주', korCode: '055550', gFinance: '055550:KRX' },
            { symbol: '105560.KS', name: 'KB금융', korCode: '105560', gFinance: '105560:KRX' },
            { symbol: '086790.KS', name: '하나금융지주', korCode: '086790', gFinance: '086790:KRX' },
            { symbol: '316140.KS', name: '우리금융지주', korCode: '316140', gFinance: '316140:KRX' },
            { symbol: '024110.KS', name: '기업은행', korCode: '024110', gFinance: '024110:KRX' },
            { symbol: '032830.KS', name: '삼성생명', korCode: '032830', gFinance: '032830:KRX' },
            { symbol: '034730.KS', name: 'SK스퀘어', korCode: '034730', gFinance: '034730:KRX' },
        ]
    },
    kr_battery: {
        id: 'kr_battery', name: '🔋 2차전지/소재', market: 'korean',
        stocks: [
            { symbol: '373220.KS', name: 'LG에너지솔루션', korCode: '373220', gFinance: '373220:KRX' },
            { symbol: '247540.KS', name: '에코프로비엠', korCode: '247540', gFinance: '247540:KRX' },
            { symbol: '086520.KS', name: '에코프로', korCode: '086520', gFinance: '086520:KRX' },
            { symbol: '006280.KS', name: '녹십자', korCode: '006280', gFinance: '006280:KRX' },
            { symbol: '011170.KS', name: '롯데케미칼', korCode: '011170', gFinance: '011170:KRX' },
        ]
    },
    kr_defense: {
        id: 'kr_defense', name: '🛡️ 국내 방산', market: 'korean',
        stocks: [
            { symbol: '012450.KS', name: '한화에어로스페이스', korCode: '012450', gFinance: '012450:KRX' },
            { symbol: '047810.KS', name: '한국항공우주', korCode: '047810', gFinance: '047810:KRX' },
            { symbol: '000880.KS', name: '한화', korCode: '000880', gFinance: '000880:KRX' },
            { symbol: '272210.KS', name: '한화시스템', korCode: '272210', gFinance: '272210:KRX' },
            { symbol: '079550.KS', name: 'LIG넥스원', korCode: '079550', gFinance: '079550:KRX' },
        ]
    },
    kr_bio: {
        id: 'kr_bio', name: '🧬 국내 바이오', market: 'korean',
        stocks: [
            { symbol: '207940.KS', name: '삼성바이오로직스', korCode: '207940', gFinance: '207940:KRX' },
            { symbol: '068270.KS', name: '셀트리온', korCode: '068270', gFinance: '068270:KRX' },
            { symbol: '326030.KS', name: 'SK바이오팜', korCode: '326030', gFinance: '326030:KRX' },
            { symbol: '009150.KS', name: '삼성전기', korCode: '009150', gFinance: '009150:KRX' },
            { symbol: '128940.KS', name: '한미약품', korCode: '128940', gFinance: '128940:KRX' },
        ]
    },
    kr_it: {
        id: 'kr_it', name: '💻 국내 IT/플랫폼', market: 'korean',
        stocks: [
            { symbol: '263750.KS', name: '펄어비스', korCode: '263750', gFinance: '263750:KRX' },
            { symbol: '259960.KS', name: '크래프톤', korCode: '259960', gFinance: '259960:KRX' },
            { symbol: '036570.KS', name: '엔씨소프트', korCode: '036570', gFinance: '036570:KRX' },
            { symbol: '352820.KS', name: '하이브', korCode: '352820', gFinance: '352820:KRX' },
            { symbol: '030200.KS', name: 'KT', korCode: '030200', gFinance: '030200:KRX' },
            { symbol: '017670.KS', name: 'SK텔레콤', korCode: '017670', gFinance: '017670:KRX' },
            { symbol: '066570.KS', name: 'LG전자', korCode: '066570', gFinance: '066570:KRX' },
        ]
    },
    kr_heavy: {
        id: 'kr_heavy', name: '🏗️ 국내 중공업', market: 'korean',
        stocks: [
            { symbol: '009540.KS', name: '한국조선해양', korCode: '009540', gFinance: '009540:KRX' },
            { symbol: '010130.KS', name: '고려아연', korCode: '010130', gFinance: '010130:KRX' },
            { symbol: '042670.KS', name: 'HD현대인프라코어', korCode: '042670', gFinance: '042670:KRX' },
            { symbol: '329180.KS', name: 'HD현대중공업', korCode: '329180', gFinance: '329180:KRX' },
            { symbol: '267250.KS', name: 'HD현대', korCode: '267250', gFinance: '267250:KRX' },
            { symbol: '010140.KS', name: '삼성중공업', korCode: '010140', gFinance: '010140:KRX' },
        ]
    },
    kr_consumer: {
        id: 'kr_consumer', name: '🛒 국내 소비/유통', market: 'korean',
        stocks: [
            { symbol: '051900.KS', name: 'LG생활건강', korCode: '051900', gFinance: '051900:KRX' },
            { symbol: '090430.KS', name: '아모레퍼시픽', korCode: '090430', gFinance: '090430:KRX' },
            { symbol: '004170.KS', name: '신세계', korCode: '004170', gFinance: '004170:KRX' },
            { symbol: '069960.KS', name: '현대백화점', korCode: '069960', gFinance: '069960:KRX' },
            { symbol: '034220.KS', name: 'LG디스플레이', korCode: '034220', gFinance: '034220:KRX' },
        ]
    },

    // ═══════════════════════════════════
    // 국내 ETF (주요 대형)
    // ═══════════════════════════════════
    etf_kr: {
        id: 'etf_kr', name: '📊 국내 ETF', market: 'korean',
        stocks: [
            { symbol: '360750.KS', name: 'TIGER 미국S&P500', korCode: '360750', gFinance: '360750:KRX' },
            { symbol: '379800.KS', name: 'KODEX 미국S&P500TR', korCode: '379800', gFinance: '379800:KRX' },
            { symbol: '133690.KS', name: 'TIGER 미국나스닥100', korCode: '133690', gFinance: '133690:KRX' },
            { symbol: '069500.KS', name: 'KODEX 200', korCode: '069500', gFinance: '069500:KRX' },
            { symbol: '102110.KS', name: 'TIGER 200', korCode: '102110', gFinance: '102110:KRX' },
            { symbol: '252670.KS', name: 'KODEX 200선물인버스2X', korCode: '252670', gFinance: '252670:KRX' },
            { symbol: '371460.KS', name: 'TIGER 차이나전기차', korCode: '371460', gFinance: '371460:KRX' },
            { symbol: '453810.KS', name: 'KODEX 미국AI테크TOP10', korCode: '453810', gFinance: '453810:KRX' },
            { symbol: '448290.KS', name: 'TIGER 미국S&P500(H)', korCode: '448290', gFinance: '448290:KRX' },
        ]
    },

    // ═══════════════════════════════════
    // 원자재/광물 (10개+)
    // ═══════════════════════════════════
    commodity: {
        id: 'commodity', name: '🥇 귀금속 (Precious)', market: 'commodity',
        stocks: [
            { symbol: 'GC=F', name: '금 (Gold)', gFinance: 'GLD:NYSEARCA' },
            { symbol: 'SI=F', name: '은 (Silver)', gFinance: 'SLV:NYSEARCA' },
            { symbol: 'PL=F', name: '백금 (Platinum)', gFinance: 'PPLT:NYSEARCA' },
            { symbol: 'PA=F', name: '팔라듐 (Palladium)', gFinance: 'PALL:NYSEARCA' },
        ]
    },
    minerals: {
        id: 'minerals', name: '⛏️ 광물/에너지 (Minerals)', market: 'commodity',
        stocks: [
            { symbol: 'HG=F', name: '구리 (Copper)', gFinance: 'CPER:NYSEARCA' },
            { symbol: 'CL=F', name: '원유 WTI (Crude Oil)', gFinance: 'USO:NYSEARCA' },
            { symbol: 'BZ=F', name: '원유 브렌트 (Brent)', gFinance: 'BNO:NYSEARCA' },
            { symbol: 'NG=F', name: '천연가스 (Natural Gas)', gFinance: 'UNG:NYSEARCA' },
            { symbol: 'ALI=F', name: '알루미늄 (Aluminum)', gFinance: 'JJU:NYSEARCA' },
            { symbol: 'ZN=F', name: '아연 (Zinc)', gFinance: 'ZINC:NYSEARCA' },
            { symbol: 'HO=F', name: '난방유 (Heating Oil)', gFinance: 'UHN:NYSEARCA' },
            { symbol: 'URA', name: '우라늄 ETF (Uranium)', gFinance: 'URA:NYSEARCA' },
        ]
    },

    // ═══════════════════════════════════
    // 암호화폐 (시총 상위 5개)
    // ═══════════════════════════════════
    crypto: {
        id: 'crypto', name: '🪙 암호화폐 (Crypto)', market: 'crypto',
        stocks: [
            { symbol: 'BTC-USD', name: '비트코인 (Bitcoin)', gFinance: 'BTC-USD' },
            { symbol: 'ETH-USD', name: '이더리움 (Ethereum)', gFinance: 'ETH-USD' },
            { symbol: 'XRP-USD', name: '리플 (XRP)', gFinance: 'XRP-USD' },
            { symbol: 'SOL-USD', name: '솔라나 (Solana)', gFinance: 'SOL-USD' },
            { symbol: 'BNB-USD', name: '바이낸스코인 (BNB)', gFinance: 'BNB-USD' },
        ]
    }
};

// 하위 호환용 플랫 리스트 생성
const OVERSEAS_SYMBOLS = Object.values(STOCK_THEMES)
    .filter(t => t.market === 'overseas')
    .flatMap(t => t.stocks);

const KOREAN_SYMBOLS = Object.values(STOCK_THEMES)
    .filter(t => t.market === 'korean')
    .flatMap(t => t.stocks);

const COMMODITY_SYMBOLS = Object.values(STOCK_THEMES)
    .filter(t => t.market === 'commodity')
    .flatMap(t => t.stocks);

const CRYPTO_SYMBOLS = Object.values(STOCK_THEMES)
    .filter(t => t.market === 'crypto')
    .flatMap(t => t.stocks);

// symbol → gFinance 매핑 캐시
const GFINANCE_MAP = new Map();
Object.values(STOCK_THEMES).forEach(theme => {
    theme.stocks.forEach(s => GFINANCE_MAP.set(s.symbol, s.gFinance));
});

// ========== Yahoo Finance v8 API (직접 HTTP) ==========

const YAHOO_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://finance.yahoo.com/',
    'Origin': 'https://finance.yahoo.com'
};

/**
 * Yahoo Finance v8 API로 시세 조회 (직접 HTTP)
 */
async function fetchYahooQuote(symbol) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=7d`;

    try {
        const res = await fetch(url, { headers: YAHOO_HEADERS });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const result = data?.chart?.result?.[0];
        if (!result) throw new Error('No data');

        const meta = result.meta;
        const quote = result.indicators?.quote?.[0];
        const prevClose = meta.chartPreviousClose || meta.previousClose || 0;
        const price = meta.regularMarketPrice || 0;
        const change = price - prevClose;
        const changePercent = prevClose ? (change / prevClose) * 100 : 0;

        // 7일간 종가 히스토리 추출
        const closes = quote?.close?.filter(c => c != null) || [];
        const history = closes.map(c => ({ close: c }));

        return {
            symbol,
            price,
            change,
            changePercent,
            volume: meta.regularMarketVolume || (quote?.volume?.slice(-1)[0]) || 0,
            high52: meta.fiftyTwoWeekHigh || 0,
            low52: meta.fiftyTwoWeekLow || 0,
            currency: meta.currency || 'USD',
            previousClose: prevClose,
            dayHigh: meta.regularMarketDayHigh || (quote?.high?.slice(-1)[0]) || 0,
            dayLow: meta.regularMarketDayLow || (quote?.low?.slice(-1)[0]) || 0,
            marketCap: 0,
            history,
            source: 'yahoo'
        };
    } catch (error) {
        return null;
    }
}

/**
 * Yahoo Finance v8 히스토리 데이터 조회
 */
async function fetchYahooHistory(symbol, range = '3mo') {
    const interval = range === '5d' ? '15m' : '1d';
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;

    try {
        const res = await fetch(url, { headers: YAHOO_HEADERS });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const result = data?.chart?.result?.[0];
        if (!result) return [];

        const timestamps = result.timestamp || [];
        const quote = result.indicators?.quote?.[0] || {};

        return timestamps.map((ts, i) => ({
            date: new Date(ts * 1000).toISOString(),
            open: quote.open?.[i] || 0,
            high: quote.high?.[i] || 0,
            low: quote.low?.[i] || 0,
            close: quote.close?.[i] || 0,
            volume: quote.volume?.[i] || 0
        })).filter(d => d.close > 0);
    } catch (error) {
        return [];
    }
}

// ========== Google Finance (주요 소스) ==========

/**
 * Google Finance 페이지에서 시세 스크래핑 (주요 소스)
 */
async function fetchGoogleQuote(symbol) {
    // 사전 매핑된 Google Finance 심볼 사용
    const gSymbol = GFINANCE_MAP.get(symbol) || convertToGoogleSymbol(symbol);
    const url = `https://www.google.com/finance/quote/${gSymbol}`;

    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8'
            }
        });
        if (!res.ok) return null;

        const html = await res.text();

        // 가격 추출 (data-last-price 속성)
        const priceMatch = html.match(/data-last-price="([^"]+)"/);
        const changeMatch = html.match(/data-price-change="([^"]+)"/);
        const changePercentMatch = html.match(/data-price-change-percent="([^"]+)"/);
        const currencyMatch = html.match(/data-currency-code="([^"]+)"/);

        if (!priceMatch) return null;

        const price = parseFloat(priceMatch[1]) || 0;
        let change = parseFloat(changeMatch?.[1]) || 0;
        let changePercent = parseFloat(changePercentMatch?.[1]) || 0;
        const currency = currencyMatch?.[1] || 'USD';

        // 전일 종가 추출 (YMlKec fxKbKc 클래스에서 2번째 가격)
        let previousClose = price - change;
        const priceMatches = html.match(/YMlKec fxKbKc">[^<]*</g);
        if (priceMatches && priceMatches.length >= 2) {
            // 두 번째 값이 전일 종가
            const prevText = priceMatches[1].replace(/YMlKec fxKbKc">/, '').replace(/</, '');
            const prevVal = parseFloat(prevText.replace(/[₩$,\s]/g, ''));
            if (prevVal > 0) {
                previousClose = prevVal;
                // data-price-change가 0이거나 없으면 직접 계산
                if (change === 0 && price !== previousClose) {
                    change = price - previousClose;
                    changePercent = (change / previousClose) * 100;
                }
            }
        }

        return {
            symbol,
            price,
            change,
            changePercent,
            volume: 0,
            high52: 0,
            low52: 0,
            currency,
            previousClose,
            dayHigh: 0,
            dayLow: 0,
            marketCap: 0,
            source: 'google'
        };
    } catch (error) {
        return null;
    }
}

function convertToGoogleSymbol(symbol) {
    // Yahoo → Google 심볼 변환 (fallback)
    if (symbol.endsWith('.KS')) return symbol.replace('.KS', ':KRX');
    if (symbol.endsWith('.KQ')) return symbol.replace('.KQ', ':KOSDAQ');
    if (symbol === 'KRW=X') return 'USD-KRW';
    return `${symbol}:NASDAQ`;
}

// ========== 통합 API ==========

/**
 * 종목 시세 조회 (Google Finance 우선 → Yahoo 폴백)
 */
async function getQuote(symbol) {
    // 1차: Google Finance (안정적)
    let quote = await fetchGoogleQuote(symbol);
    if (quote) return quote;

    console.log(`  ↪ Google 실패, Yahoo Finance 폴백 시도: ${symbol}`);

    // 2차: Yahoo Finance v8
    quote = await fetchYahooQuote(symbol);
    if (quote) return quote;

    console.error(`❌ 시세 조회 실패 (${symbol}): 모든 소스 실패`);
    return null;
}

/**
 * 전일비 + 전월비 데이터 추가
 * Google Finance 변동 데이터를 전일비로, Yahoo 1mo 히스토리로 전월비 계산
 * + 최근 7일 종가 히스토리를 스파크라인용으로 추출
 */
async function enrichWithComparisons(quote) {
    if (!quote || !quote.price) return quote;

    // Google Finance에서 이미 가져온 change 데이터를 전일비로 사용
    if (quote.change !== undefined) {
        quote.dailyChange = quote.change || 0;
        quote.dailyChangePercent = quote.changePercent || 0;
    }

    // 전월비: Yahoo v8 chart API로 1mo 히스토리 시도
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(quote.symbol)}?interval=1d&range=1mo`;
        const res = await fetch(url, { headers: YAHOO_HEADERS });

        if (res.ok) {
            const data = await res.json();
            const result = data?.chart?.result?.[0];
            if (result) {
                const closes = result.indicators?.quote?.[0]?.close?.filter(c => c != null) || [];

                if (closes.length >= 5) {
                    const monthAgoClose = closes[0];
                    if (monthAgoClose > 0) {
                        quote.monthlyChange = quote.price - monthAgoClose;
                        quote.monthlyChangePercent = ((quote.price - monthAgoClose) / monthAgoClose) * 100;
                        quote.monthAgoPrice = monthAgoClose;
                    }
                }

                // Yahoo 데이터로 전일비도 보강 (Google이 0일 경우)
                if ((!quote.dailyChangePercent || quote.dailyChangePercent === 0) && closes.length >= 2) {
                    const prevDayClose = closes[closes.length - 2];
                    if (prevDayClose > 0) {
                        quote.dailyChange = quote.price - prevDayClose;
                        quote.dailyChangePercent = ((quote.price - prevDayClose) / prevDayClose) * 100;
                    }
                }

                // 스파크라인용 최근 7일 종가 히스토리 추출
                if (!quote.history || quote.history.length === 0) {
                    const last7 = closes.slice(-7);
                    quote.history = last7.map(c => ({ close: c }));
                }
            }
        }
    } catch (e) {
        // Yahoo 히스토리 실패 시 무시 - Google 전일비만 사용
    }

    return quote;
}

/**
 * 테마별 주식 조회
 */
async function getStocksByTheme(themeId) {
    const theme = STOCK_THEMES[themeId];
    if (!theme) return [];

    const results = [];
    for (const stock of theme.stocks) {
        let quote = await getQuote(stock.symbol);
        if (quote) {
            quote.name = stock.name;
            quote.theme = themeId;
            quote.themeName = theme.name;
            if (stock.korCode) quote.korCode = stock.korCode;
            quote = await enrichWithComparisons(quote);
            results.push(quote);
        }
        await delay(200);
    }
    return results;
}

/**
 * 해외 주식 전체 조회 (테마 메타데이터 포함)
 */
async function getOverseasStocks() {
    const results = [];
    const overseasThemes = Object.values(STOCK_THEMES).filter(t => t.market === 'overseas');
    for (const theme of overseasThemes) {
        for (const stock of theme.stocks) {
            let quote = await getQuote(stock.symbol);
            if (quote) {
                quote.name = stock.name;
                quote.theme = theme.id;
                quote.themeName = theme.name;
                quote = await enrichWithComparisons(quote);
                results.push(quote);
            }
            await delay(200);
        }
    }
    return results;
}

/**
 * 국내 주식 전체 조회 (테마 메타데이터 포함)
 */
async function getKoreanStocks() {
    const results = [];
    const koreanThemes = Object.values(STOCK_THEMES).filter(t => t.market === 'korean');
    for (const theme of koreanThemes) {
        for (const stock of theme.stocks) {
            let quote = await getQuote(stock.symbol);
            if (quote) {
                quote.name = stock.name;
                quote.korCode = stock.korCode;
                quote.theme = theme.id;
                quote.themeName = theme.name;
                quote = await enrichWithComparisons(quote);
                results.push(quote);
            }
            await delay(200);
        }
    }
    return results;
}

/**
 * 금/원자재 조회
 */
async function getCommodities() {
    const results = [];
    const commodityThemes = Object.values(STOCK_THEMES).filter(t => t.market === 'commodity');
    for (const theme of commodityThemes) {
        for (const item of theme.stocks) {
            let quote = await getQuote(item.symbol);
            if (quote) {
                quote.name = item.name;
                quote.theme = theme.id;
                quote.themeName = theme.name;
                quote = await enrichWithComparisons(quote);
                results.push(quote);
            }
            await delay(200);
        }
    }

    // 환율 조회 (Google Finance)
    let usdKrw = 1350;
    try {
        const fxUrl = 'https://www.google.com/finance/quote/USD-KRW';
        const res = await fetch(fxUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
        });
        const html = await res.text();
        const priceMatch = html.match(/data-last-price="([^"]+)"/);
        if (priceMatch) usdKrw = parseFloat(priceMatch[1]);
    } catch (e) {
        console.warn('⚠️  환율 조회 실패, 기본값 1350원 사용');
    }

    results.forEach(item => {
        item.priceKRW = Math.round(item.price * usdKrw);
        item.usdKrw = usdKrw;
    });

    return results;
}

/**
 * 암호화폐 조회 (Yahoo Finance 우선 - 코인은 Yahoo가 더 안정적)
 */
async function getCrypto() {
    const results = [];
    const cryptoThemes = Object.values(STOCK_THEMES).filter(t => t.market === 'crypto');
    for (const theme of cryptoThemes) {
        for (const item of theme.stocks) {
            // 코인은 Yahoo Finance가 더 안정적 (Google Finance에 코인 미지원)
            let quote = await fetchYahooQuote(item.symbol);
            if (!quote) {
                quote = await fetchGoogleQuote(item.symbol);
            }
            if (quote) {
                quote.name = item.name;
                quote.theme = theme.id;
                quote.themeName = theme.name;
                quote = await enrichWithComparisons(quote);
                results.push(quote);
            }
            await delay(200);
        }
    }

    // 환율 조회 (Google Finance)
    let usdKrw = 1350;
    try {
        const fxUrl = 'https://www.google.com/finance/quote/USD-KRW';
        const res = await fetch(fxUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
        });
        const html = await res.text();
        const priceMatch = html.match(/data-last-price="([^"]+)"/);
        if (priceMatch) usdKrw = parseFloat(priceMatch[1]);
    } catch (e) {
        console.warn('⚠️  환율 조회 실패, 기본값 1350원 사용');
    }

    results.forEach(item => {
        item.priceUSD = item.price;
        item.price = Math.round(item.price * usdKrw);
        item.priceKRW = item.price;
        item.usdKrw = usdKrw;
        item.currency = 'KRW';
        // 전일종가, 변동액도 원화 변환
        if (item.previousClose) {
            item.previousClose = Math.round(item.previousClose * usdKrw);
        }
        if (item.dailyChange) {
            item.dailyChange = Math.round(item.dailyChange * usdKrw);
        }
        if (item.monthlyChange) {
            item.monthlyChange = Math.round(item.monthlyChange * usdKrw);
        }
        if (item.monthAgoPrice) {
            item.monthAgoPrice = Math.round(item.monthAgoPrice * usdKrw);
        }
    });

    return results;
}

/**
 * 종목 히스토리 데이터 (차트용)
 */
async function getHistory(symbol, period = '3mo') {
    // Yahoo v8 chart API 시도
    const history = await fetchYahooHistory(symbol, period);
    if (history.length > 0) return history;

    // 폴백: 현재가 기반 시뮬레이션 데이터
    const quote = await getQuote(symbol);
    if (quote) return generateSimulatedHistory(quote.price, period);
    return [];
}

/**
 * 시뮬레이션 히스토리 (API 실패 시 fallback)
 */
function generateSimulatedHistory(currentPrice, period) {
    const days = period === '5d' ? 5 : period === '1mo' ? 30 : period === '3mo' ? 90 : 365;
    const history = [];
    const volatility = 0.015;

    let price = currentPrice * (0.95 + Math.random() * 0.1);
    const now = new Date();

    for (let i = days; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);

        const change = price * volatility * (Math.random() - 0.47);
        price = Math.max(price * 0.8, price + change);

        history.push({
            date: date.toISOString(),
            open: price * (1 + (Math.random() - 0.5) * 0.01),
            high: price * (1 + Math.random() * 0.012),
            low: price * (1 - Math.random() * 0.012),
            close: price,
            volume: Math.floor(Math.random() * 10000000)
        });
    }
    return history;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
    getOverseasStocks,
    getKoreanStocks,
    getCommodities,
    getCrypto,
    getStocksByTheme,
    getHistory,
    getQuote,
    STOCK_THEMES,
    OVERSEAS_SYMBOLS,
    KOREAN_SYMBOLS,
    COMMODITY_SYMBOLS,
    CRYPTO_SYMBOLS
};
