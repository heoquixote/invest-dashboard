/**
 * 대시보드 모듈 - 테마별 그룹 렌더링 + 해외/국내 필터
 */
import * as api from './api.js';
import { createStockCard, drawSparkline } from './stockCard.js';
import { renderPriceChart, renderModalChart, renderPortfolioAllocationChart } from './charts.js';
import { createAnalysisCard, createPortfolioAnalysis } from './analysisPanel.js';

let currentView = 'all'; // all, news, portfolio, history, strategy, heatmap
let currentMarketFilter = 'all'; // all, korean, overseas, etf, crypto
let currentCategoryFilter = 'all'; // all, tech, defense, energy, consumer, finance, ai_data, kr_major, kr_theme, commodity
let currentMovementFilter = 'all'; // all, up, down, spike, crash
let currentFavoriteFilter = 'all'; // all, favorites
let currentSearchQuery = '';
let currentNewsFilter = 'all';
let includeCashInAllocation = true;
let currentPortfolioAllocationFilter = 'all';
const MARKET_CATEGORY_CONFIG = {
    all: [
        { id: 'all', label: '전체' }
    ],
    korean: [
        { id: 'all', label: '전체' },
        { id: 'kr_major', label: '🇰🇷 대표주' },
        { id: 'kr_finance', label: '🏦 금융' },
        { id: 'kr_battery', label: '🔋 2차전지' },
        { id: 'kr_defense', label: '🛡️ 방산' },
        { id: 'kr_bio', label: '🧬 바이오' },
        { id: 'kr_it', label: '💻 IT/플랫폼' },
        { id: 'kr_entertainment', label: '🎤 엔터' },
        { id: 'kr_heavy', label: '🏗️ 중공업' },
        { id: 'kr_consumer', label: '🛒 소비/유통' }
    ],
    overseas: [
        { id: 'all', label: '전체' },
        { id: 'tech', label: '🖥️ 기술주' },
        { id: 'semiconductor', label: '💾 반도체' },
        { id: 'obesity_drug', label: '💉 비만 치료제/의약' },
        { id: 'ai_data', label: '🤖 AI/데이터' },
        { id: 'defense', label: '🛡️ 방산' },
        { id: 'energy', label: '⚡ 에너지' },
        { id: 'consumer', label: '🛒 소비재' },
        { id: 'healthcare', label: '💊 헬스케어' },
        { id: 'finance', label: '🏦 금융' },
        { id: 'communication', label: '📡 통신/미디어' },
        { id: 'industrial', label: '🏭 산업재' },
        { id: 'commodity', label: '🥇 귀금속' },
        { id: 'minerals', label: '⛏️ 원자재/광물' }
    ],
    etf: [
        { id: 'all', label: '전체' },
        { id: 'etf_us', label: '🌎 해외 ETF' },
        { id: 'etf_kr', label: '🇰🇷 국내 ETF' }
    ],
    crypto: [
        { id: 'all', label: '전체' },
        { id: 'crypto', label: '🪙 주요 코인' }
    ]
};

const state = {
    overseas: [],
    korean: [],
    gold: [],
    crypto: [],
    news: { updatedAt: null, categories: [], items: {} },
    custom: [],
    privateHistory: [],
    favorites: JSON.parse(localStorage.getItem('favoriteStocks') || '[]'),
    strategyMemo: localStorage.getItem('strategyMemo') || '',
    strategyMemoSavedAt: localStorage.getItem('strategyMemoSavedAt') || '',
    portfolio: JSON.parse(localStorage.getItem('portfolio') || '[]'),
    loading: false
};

/**
 * 대시보드 초기화
 */
export async function initDashboard() {
    setupNavigation();
    setupFilterTabs();
    setupCategoryFilters();
    setupMovementFilters();
    setupFavoriteFilters();
    setupSummaryCardFilters();
    setupSearchFilter();
    setupNewsFilters();
    setupModalEvents();
    setupHeaderButtons();
    setupPortfolio();
    setupCustomStockModal();
    setupStrategyMemo();
    renderCategoryChips();
    await loadAllData();
    checkHealth();
}

/**
 * 전체 데이터 로드
 */
async function loadAllData() {
    state.loading = true;
    updateLoadingUI(true);

    try {
        const [overseas, korean, gold, crypto, custom, news, privateHistory] = await Promise.all([
            api.fetchOverseasStocks().catch(() => ({ data: [] })),
            api.fetchKoreanStocks().catch(() => ({ data: [] })),
            api.fetchGold().catch(() => ({ data: [] })),
            api.fetchCrypto().catch(() => ({ data: [] })),
            api.fetchCustomStocks().catch(() => ({ data: [] })),
            api.fetchNews().catch(() => ({ data: { updatedAt: null, categories: [], items: {} } })),
            api.fetchPrivateHistory().catch(() => ({ data: [] }))
        ]);

        state.overseas = overseas.data || [];
        state.korean = korean.data || [];
        state.gold = gold.data || [];
        state.crypto = crypto.data || [];
        state.news = news.data || { updatedAt: null, categories: [], items: {} };
        state.custom = custom.data || [];
        state.privateHistory = privateHistory.data || [];

        renderCurrentView();
        updateSummaryCards();
        updateLastTime();

        // 데이터 수집 기준일 표시
        updateDataDate();
    } catch (error) {
        console.error('데이터 로드 실패:', error);
    } finally {
        state.loading = false;
        updateLoadingUI(false);
    }
}

/**
 * 시장 지수 및 통계 KPI 카드 업데이트
 */
async function updateSummaryCards() {
    // 1. 기존 통계 업데이트 (Total, Up, Down, Coverage)
    const all = getAllStocks();
    const upCount = all.filter(s => (s.dailyChangePercent ?? s.changePercent ?? 0) > 0).length;
    const downCount = all.filter(s => (s.dailyChangePercent ?? s.changePercent ?? 0) < 0).length;
    const flatCount = all.filter(s => (s.dailyChangePercent ?? s.changePercent ?? 0) === 0).length;
    const withPrice = all.filter(s => s.price > 0).length;

    const totalEl = document.getElementById('totalCount');
    const upEl = document.getElementById('upCount');
    const downEl = document.getElementById('downCount');
    const coverageEl = document.getElementById('coverageCount');
    const flatMetaEl = document.getElementById('flatCountMeta');
    const upBreakdownEl = document.getElementById('upBreakdown');
    const downBreakdownEl = document.getElementById('downBreakdown');

    if (totalEl) totalEl.textContent = all.length;
    if (upEl) upEl.textContent = upCount;
    if (downEl) downEl.textContent = downCount;
    if (flatMetaEl) flatMetaEl.textContent = `보합 ${flatCount}`;
    if (upBreakdownEl) upBreakdownEl.textContent = formatMovementBreakdown(all, 'up');
    if (downBreakdownEl) downBreakdownEl.textContent = formatMovementBreakdown(all, 'down');
    if (coverageEl) {
        coverageEl.textContent = `${withPrice}/${all.length}`;
        coverageEl.title = `종가 기준 ${withPrice}개 종목 수집 완료`;
    }

    syncSummaryFilterState();

    // 2. 매크로 지표 업데이트
    try {
        const res = await api.fetchMacroIndicators();
        const indicators = res.data || [];

        const macroMap = {
            'USD/KRW': { valueId: 'usdKrwValue', changeId: 'usdKrwChange', cardId: 'cardUsdKrw' },
            'US10Y': { valueId: 'us10yValue', changeId: 'us10yChange', cardId: 'cardUs10Y' },
            'US13W': { valueId: 'us13wValue', changeId: 'us13wChange', cardId: 'cardUs13W' },
            'DXY': { valueId: 'dxyValue', changeId: 'dxyChange', cardId: 'cardDxy' },
            'MVRV_Z': { valueId: 'mvrvZValue', changeId: 'mvrvZChange', cardId: 'cardMvrvZ' }
        };

        indicators.forEach(indicator => {
            const mapping = macroMap[indicator.key];
            if (!mapping) return;

            const valueEl = document.getElementById(mapping.valueId);
            const changeEl = document.getElementById(mapping.changeId);
            const cardEl = document.getElementById(mapping.cardId);
            const hasChange = typeof indicator.changePercent === 'number';
            const pct = Number(indicator.changePercent) || 0;
            const hasPointChange = typeof indicator.changeValue === 'number';
            const pointChange = Number(indicator.changeValue) || 0;
            const isUp = hasChange ? pct >= 0 : pointChange >= 0;

            if (valueEl) {
                valueEl.textContent = formatMacroValue(indicator);
            }

            if (changeEl) {
                if (hasChange) {
                    const arrow = isUp ? '▲' : '▼';
                    changeEl.textContent = `${arrow} ${Math.abs(pct).toFixed(2)}%`;
                    changeEl.className = `card-change ${isUp ? 'up' : 'down'}`;
                } else if (hasPointChange) {
                    const arrow = isUp ? '▲' : '▼';
                    changeEl.textContent = `${arrow} ${Math.abs(pointChange).toFixed(2)}pt`;
                    changeEl.className = `card-change ${isUp ? 'up' : 'down'}`;
                } else {
                    changeEl.textContent = '기준 환율';
                    changeEl.className = 'card-change neutral';
                }
            }

            if (cardEl) {
                cardEl.classList.remove('up', 'down');
                if (hasChange || hasPointChange) {
                    cardEl.classList.add(isUp ? 'up' : 'down');
                }
            }
        });
    } catch (error) {
        console.error('매크로 지표 로드 실패:', error);
    }

    // 3. 시장 지수 업데이트
    try {
        const res = await api.fetchIndices();
        const indices = res.data || [];

        const indexMap = {
            '^GSPC': { priceId: 'sp500Price', changeId: 'sp500Change', cardId: 'cardSP500', sparkId: 'sparkline-GSPC' },
            '^NDX': { priceId: 'nasdaqPrice', changeId: 'nasdaqChange', cardId: 'cardNASDAQ', sparkId: 'sparkline-NDX' },
            '^KS11': { priceId: 'kospiPrice', changeId: 'kospiChange', cardId: 'cardKOSPI', sparkId: 'sparkline-KS11' },
            '^KQ11': { priceId: 'kosdaqPrice', changeId: 'kosdaqChange', cardId: 'cardKOSDAQ', sparkId: 'sparkline-KQ11' }
        };

        indices.forEach(idx => {
            const mapping = indexMap[idx.symbol];
            if (!mapping) return;

            const priceEl = document.getElementById(mapping.priceId);
            const changeEl = document.getElementById(mapping.changeId);
            const cardEl = document.getElementById(mapping.cardId);

            if (priceEl && idx.price != null) {
                // KOSPI/KOSDAQ은 소수점 2자리, US 지수는 소수점 2자리 + 콤마
                priceEl.textContent = idx.price.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
            }

            const pct = idx.changePercent || 0;
            const isUp = pct >= 0;

            if (changeEl) {
                const arrow = isUp ? '▲' : '▼';
                changeEl.textContent = `${arrow} ${Math.abs(pct).toFixed(2)}%`;
                changeEl.className = `card-change ${isUp ? 'up' : 'down'}`;
            }

            // 카드 전체에 up/down 클래스 추가
            if (cardEl) {
                cardEl.classList.remove('up', 'down');
                cardEl.classList.add(isUp ? 'up' : 'down');
            }

            // 스파크라인 그리기
            if (mapping.sparkId && idx.history?.length > 0) {
                // 부드러운 렌더링을 위해 약간의 지연 후 실행
                setTimeout(() => {
                    drawSparkline(mapping.sparkId, idx.history, isUp);
                }, 100);
            }
        });
    } catch (error) {
        console.error('시장 지수 로드 실패:', error);
    }
}

function getSummaryMarketBucket(stock) {
    const market = stock.market || '';
    const theme = stock.theme || '';
    const symbol = stock.symbol || '';

    if (theme === 'crypto' || market === 'crypto') return 'crypto';
    if (['etf_us', 'etf_kr'].includes(theme) || market === 'etf') return 'etf';
    if (market === 'korean' || stock.currency === 'KRW' || symbol.endsWith('.KS') || symbol.endsWith('.KQ')) {
        return 'korean';
    }

    return 'overseas';
}

function formatMovementBreakdown(stocks, direction) {
    const buckets = [
        ['korean', '국내'],
        ['overseas', '해외'],
        ['etf', 'ETF'],
        ['crypto', '코인']
    ];

    return buckets
        .map(([key, label]) => {
            const bucketStocks = stocks.filter(stock => getSummaryMarketBucket(stock) === key);
            const movedCount = bucketStocks.filter(stock => {
                const changePercent = Number(stock.dailyChangePercent ?? stock.changePercent ?? 0);
                return direction === 'up' ? changePercent > 0 : changePercent < 0;
            }).length;
            const totalCount = bucketStocks.length;
            const ratio = totalCount > 0 ? (movedCount / totalCount) * 100 : 0;

            return `${label} ${movedCount}/${totalCount} (${ratio.toFixed(0)}%)`;
        })
        .join(' · ');
}

function formatMacroValue(indicator) {
    if (indicator.value == null) return '-';

    switch (indicator.format) {
        case 'krw':
            return `₩${Number(indicator.value).toLocaleString('ko-KR', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            })}`;
        case 'percent':
            return `${Number(indicator.value).toFixed(2)}%`;
        default:
            return Number(indicator.value).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
    }
}

function getAllStocks() {
    return [...state.overseas, ...state.korean, ...state.gold, ...state.crypto, ...state.custom];
}

/**
 * 현재 뷰에 맞게 렌더링
 */
function renderCurrentView() {
    const title = document.getElementById('viewTitle');
    const summaryCards = document.getElementById('summaryCards');
    const stocksSection = document.getElementById('stocksSection');
    const newsSection = document.getElementById('newsSection');
    const chartSection = document.getElementById('chartSection');
    const analysisSection = document.getElementById('analysisSection');
    const portfolioSection = document.getElementById('portfolioSection');
    const historySection = document.getElementById('historySection');
    const strategySection = document.getElementById('strategySection');
    const heatmapSection = document.getElementById('heatmapSection');
    const filterBar = document.getElementById('marketFilterBar');

    if (summaryCards) summaryCards.style.display = 'grid';
    stocksSection.style.display = 'block';
    if (newsSection) newsSection.style.display = 'none';
    chartSection.style.display = 'none';
    analysisSection.style.display = 'none';
    if (portfolioSection) portfolioSection.style.display = 'none';
    if (historySection) historySection.style.display = 'none';
    if (strategySection) strategySection.style.display = 'none';
    if (heatmapSection) heatmapSection.style.display = 'none';

    switch (currentView) {
        case 'all':
            title.textContent = '대시보드';
            filterBar.style.display = 'flex';
            renderThemedStocks(getFilteredStocks());
            break;
        case 'news':
            title.textContent = '🗞️ 시장 뉴스';
            if (summaryCards) summaryCards.style.display = 'none';
            stocksSection.style.display = 'none';
            if (newsSection) newsSection.style.display = 'block';
            filterBar.style.display = 'none';
            renderNewsView();
            break;
        case 'portfolio':
            title.textContent = '💼 내 포트폴리오';
            if (summaryCards) summaryCards.style.display = 'none';
            stocksSection.style.display = 'none';
            if (portfolioSection) portfolioSection.style.display = 'block';
            filterBar.style.display = 'none';
            renderPortfolio();
            break;
        case 'history':
            title.textContent = '🧾 히스토리';
            if (summaryCards) summaryCards.style.display = 'none';
            stocksSection.style.display = 'none';
            filterBar.style.display = 'none';
            if (historySection) historySection.style.display = 'block';
            renderHistoryView();
            break;
        case 'strategy':
            title.textContent = '📝 투자 전략';
            if (summaryCards) summaryCards.style.display = 'none';
            stocksSection.style.display = 'none';
            filterBar.style.display = 'none';
            if (strategySection) strategySection.style.display = 'block';
            renderStrategyMemo();
            break;
        case 'heatmap':
            title.textContent = '🗺️ 히트맵';
            if (summaryCards) summaryCards.style.display = 'none';
            stocksSection.style.display = 'none';
            filterBar.style.display = 'none';
            if (heatmapSection) heatmapSection.style.display = 'block';
            break;
        default:
            currentView = 'all';
            title.textContent = '대시보드';
            filterBar.style.display = 'flex';
            renderThemedStocks(getFilteredStocks());
            break;
    }
}

/**
 * 해외/국내 + 카테고리 필터 적용
 */
function getFilteredStocks() {
    let stocks = getStocksForMarket(currentMarketFilter);

    // 카테고리 필터
    if (currentCategoryFilter !== 'all') {
        stocks = stocks.filter(s => s.theme === currentCategoryFilter);
    }

    // 등락 필터
    if (currentMovementFilter !== 'all') {
        stocks = stocks.filter(s => {
            const pct = s.dailyChangePercent ?? s.changePercent ?? 0;
            switch (currentMovementFilter) {
                case 'up': return pct > 0;
                case 'down': return pct < 0;
                case 'spike': return pct >= 5;
                case 'crash': return pct <= -5;
                default: return true;
            }
        });
    }

    if (currentFavoriteFilter === 'favorites') {
        stocks = stocks.filter(stock => isFavoriteStock(stock.symbol));
    }

    if (currentSearchQuery) {
        const query = currentSearchQuery.toLowerCase();
        stocks = stocks.filter(stock => {
            const fields = [
                stock.name,
                stock.symbol,
                stock.korCode,
                stock.themeName,
                stock.theme
            ]
                .filter(Boolean)
                .map(value => String(value).toLowerCase());

            return fields.some(value => value.includes(query));
        });
    }

    return stocks;
}

function getStocksForMarket(market) {
    switch (market) {
        case 'korean':
            return [...state.korean, ...state.custom.filter(stock => stock.market === 'korean')];
        case 'overseas':
            return [
                ...state.overseas,
                ...state.gold,
                ...state.custom.filter(stock => !['korean', 'etf', 'crypto'].includes(stock.market))
            ];
        case 'etf':
            return [
                ...[...state.overseas, ...state.korean].filter(stock => ['etf_us', 'etf_kr'].includes(stock.theme)),
                ...state.custom.filter(stock => stock.market === 'etf')
            ];
        case 'crypto':
            return [...state.crypto, ...state.custom.filter(stock => stock.market === 'crypto')];
        case 'all':
        default:
            return getAllStocks();
    }
}

/**
 * 테마별 그룹 렌더링
 */
function renderThemedStocks(stocks) {
    const grid = document.getElementById('stocksGrid');
    grid.innerHTML = '';

    if (!stocks.length) {
        grid.innerHTML = currentSearchQuery
            ? `<div class="stocks-empty">"${currentSearchQuery}" 검색 결과가 없습니다.</div>`
            : '<div class="stocks-empty">데이터가 없습니다. \'수집\' 버튼을 클릭해주세요.</div>';
        return;
    }

    // 테마별로 그룹화
    const themeGroups = {};
    const noTheme = [];

    stocks.forEach(stock => {
        if (stock.themeName) {
            if (!themeGroups[stock.themeName]) {
                themeGroups[stock.themeName] = [];
            }
            themeGroups[stock.themeName].push(stock);
        } else {
            noTheme.push(stock);
        }
    });

    // 테마별로 섹션 렌더링
    for (const [themeName, themeStocks] of Object.entries(themeGroups)) {
        const section = document.createElement('div');
        section.className = 'theme-section';
        section.innerHTML = `<div class="theme-header"><h3 class="theme-title">${themeName}</h3><span class="theme-count">${themeStocks.length}종목</span></div>`;

        const themeGrid = document.createElement('div');
        themeGrid.className = 'stocks-grid';

        themeStocks.forEach(stock => {
            const card = createStockCard({
                ...stock,
                isFavorite: isFavoriteStock(stock.symbol)
            }, {
                onToggleFavorite: toggleFavoriteStock
            });
            themeGrid.appendChild(card);
        });

        section.appendChild(themeGrid);
        grid.appendChild(section);

        // 스파크라인 그리기 (실제 7일 종가 데이터 사용)
        setTimeout(() => {
            themeStocks.forEach(stock => {
                const canvasId = `sparkline-${stock.symbol.replace(/[^a-zA-Z0-9]/g, '_')}`;
                const dailyPct = stock.dailyChangePercent ?? stock.changePercent ?? 0;
                const historyData = (stock.history && stock.history.length >= 2) ? stock.history : generateMiniData(stock.price);
                drawSparkline(canvasId, historyData, dailyPct >= 0);
            });
        }, 100);
    }

    // 미분류 종목
    if (noTheme.length > 0) {
        const themeGrid = document.createElement('div');
        themeGrid.className = 'stocks-grid';
        noTheme.forEach(stock => {
            const card = createStockCard({
                ...stock,
                isFavorite: isFavoriteStock(stock.symbol)
            }, {
                onToggleFavorite: toggleFavoriteStock
            });
            themeGrid.appendChild(card);
        });
        grid.appendChild(themeGrid);
    }
}

function generateMiniData(price) {
    const data = [];
    let p = price * (0.97 + Math.random() * 0.06);
    for (let i = 0; i < 20; i++) {
        p += p * 0.008 * (Math.random() - 0.45);
        data.push({ close: p });
    }
    return data;
}

function renderNewsView() {
    const container = document.getElementById('newsGrid');
    const updatedAtEl = document.getElementById('newsUpdatedAt');
    if (!container) return;

    const newsData = state.news || {};
    const updatedAt = newsData.updatedAt;
    const categoryItems = newsData.items || {};

    if (updatedAtEl) {
        updatedAtEl.textContent = `뉴스 수집 시각: ${updatedAt ? formatNewsDate(updatedAt) : '-'}`;
    }

    const items = currentNewsFilter === 'all'
        ? Object.values(categoryItems).flat()
        : (categoryItems[currentNewsFilter] || []);

    const sortedItems = items
        .filter(item => item?.title && item?.link)
        .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));

    if (!sortedItems.length) {
        container.innerHTML = '<div class="stocks-empty">표시할 뉴스가 없습니다. 종가 수집 배치를 한 번 실행하면 채워집니다.</div>';
        return;
    }

    container.innerHTML = sortedItems.map(item => `
        <article class="news-card">
            <div class="news-card-top">
                <span class="news-badge">${item.categoryName || item.category}</span>
                <span class="news-time">${item.publishedAt ? formatNewsDate(item.publishedAt) : '시간 정보 없음'}</span>
            </div>
            <a class="news-title" href="${item.link}" target="_blank" rel="noopener noreferrer">${item.title}</a>
            <p class="news-summary">${item.summary || item.title}</p>
            <div class="news-card-bottom">
                <span class="news-source">${item.source || '출처 미상'}</span>
                <a class="news-link" href="${item.link}" target="_blank" rel="noopener noreferrer">원문 보기</a>
            </div>
        </article>
    `).join('');
}

function renderHistoryView() {
    const container = document.getElementById('historyContent');
    if (!container) return;

    const historyAssets = state.privateHistory || [];

    if (!historyAssets.length) {
        container.innerHTML = '<div class="history-empty">등록된 히스토리가 없습니다.</div>';
        return;
    }

    const overview = buildHistoryOverview(historyAssets);

    container.innerHTML = `
        <section class="history-overview-card">
            <div class="history-overview-header">
                <div>
                    <h2>전체 요약</h2>
                    <p>비상장과 해외주식 히스토리를 한 번에 정리한 누적 기준입니다.</p>
                </div>
                <div class="history-overview-badge">평가 가능 자산 기준 손익 포함</div>
            </div>
            <div class="history-overview-grid">
                <div class="history-overview-metric">
                    <span class="history-overview-label">총 순투입금액</span>
                    <strong>${formatWon(overview.totalNetInvested)}</strong>
                    <span class="history-overview-sub">비상장 + 해외주식 합산</span>
                </div>
                <div class="history-overview-metric">
                    <span class="history-overview-label">현재 확인 자산</span>
                    <strong>${formatWon(overview.totalKnownValue)}</strong>
                    <span class="history-overview-sub">최신 잔고/보유 메모 반영</span>
                </div>
                <div class="history-overview-metric ${overview.totalKnownPnL >= 0 ? 'up' : 'down'}">
                    <span class="history-overview-label">누적 손익</span>
                    <strong>${overview.totalKnownPnL >= 0 ? '▲ ' : '▼ '}${formatWon(Math.abs(overview.totalKnownPnL))}</strong>
                    <span class="history-overview-sub">${overview.valuedAssetCount}개 자산 평가 기준</span>
                </div>
                <div class="history-overview-metric muted">
                    <span class="history-overview-label">미평가 자산</span>
                    <strong>${formatWon(overview.unvaluedNetInvested)}</strong>
                    <span class="history-overview-sub">${overview.unvaluedNames.join(', ') || '없음'}</span>
                </div>
            </div>
        </section>
        ${historyAssets.map(asset => {
        const isCashflow = asset.historyType === 'cashflow';
        const summary = isCashflow ? buildCashflowSummary(asset.transactions) : buildHistorySummary(asset.transactions);
        const holdingTotal = (asset.holdings || []).reduce((sum, item) => sum + item.value, 0);
        const currentValue = getAssetCurrentValue(asset);
        const currentPnL = typeof currentValue === 'number' ? currentValue - getAssetNetInvested(asset) : null;

        return `
            <article class="history-asset-card">
                <div class="history-asset-header">
                    <div>
                        <div class="history-asset-title-row">
                            <h2>${asset.name}</h2>
                            <span class="history-asset-badge">${asset.market}</span>
                        </div>
                        <p class="history-asset-note">${asset.note}</p>
                    </div>
                    <div class="history-asset-holding">
                        <span class="history-asset-holding-label">${isCashflow ? '현재 확인 자산' : '잔여 수량'}</span>
                        <strong>${isCashflow ? formatWon(currentValue || 0) : `${summary.remainingShares.toLocaleString()}주`}</strong>
                    </div>
                </div>

                <div class="history-summary-grid">
                    ${isCashflow ? `
                        <div class="history-summary-card buy">
                            <span class="history-summary-label">총 입금액</span>
                            <strong>${formatWon(summary.depositAmount)}</strong>
                            <span class="history-summary-sub">${summary.depositCount}건</span>
                        </div>
                        <div class="history-summary-card sell">
                            <span class="history-summary-label">총 출금액</span>
                            <strong>${formatWon(summary.withdrawalAmount)}</strong>
                            <span class="history-summary-sub">${summary.withdrawalCount}건</span>
                        </div>
                    ` : `
                        <div class="history-summary-card buy">
                            <span class="history-summary-label">총 매수</span>
                            <strong>${formatWon(summary.buyAmount)}</strong>
                            <span class="history-summary-sub">${summary.buyShares.toLocaleString()}주 · 평균 ${formatWon(summary.buyAvgPrice, false)}/주</span>
                        </div>
                        <div class="history-summary-card sell">
                            <span class="history-summary-label">총 매도</span>
                            <strong>${formatWon(summary.sellAmount)}</strong>
                            <span class="history-summary-sub">${summary.sellShares.toLocaleString()}주 · 평균 ${formatWon(summary.sellAvgPrice, false)}/주</span>
                        </div>
                    `}
                    <div class="history-summary-card neutral">
                        <span class="history-summary-label">${isCashflow ? '차액' : '순투입금액'}</span>
                        <strong>${formatWon(isCashflow ? summary.netAmount : summary.netInvested)}</strong>
                        <span class="history-summary-sub">${isCashflow ? '입금 - 출금 기준' : '매수 - 매도 기준'}</span>
                    </div>
                    <div class="history-summary-card neutral">
                        <span class="history-summary-label">거래 건수</span>
                        <strong>${summary.tradeCount}건</strong>
                        <span class="history-summary-sub">최초 ${formatHistoryDate(summary.firstDate)} · 마지막 ${formatHistoryDate(summary.lastDate)}</span>
                    </div>
                    <div class="history-summary-card ${currentPnL == null ? 'muted' : (currentPnL >= 0 ? 'buy' : 'sell')}">
                        <span class="history-summary-label">누적 손익</span>
                        <strong>${currentPnL == null ? '미평가' : `${currentPnL >= 0 ? '▲ ' : '▼ '}${formatWon(Math.abs(currentPnL))}`}</strong>
                        <span class="history-summary-sub">${currentPnL == null ? '현재 평가 정보가 없어 계산 보류' : '현재 확인 자산 - 순투입금액'}</span>
                    </div>
                </div>

                ${(asset.balanceSnapshots?.length || asset.holdings?.length) ? `
                    <div class="history-side-grid">
                        ${asset.balanceSnapshots?.length ? `
                            <div class="history-side-card">
                                <h3>잔고 메모</h3>
                                <div class="history-side-list">
                                    ${asset.balanceSnapshots.map(item => `
                                        <div class="history-side-row">
                                            <span>${item.label} ${formatHistoryDate(item.date)}</span>
                                            <strong>${formatWon(item.value)}</strong>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                        ${asset.holdings?.length ? `
                            <div class="history-side-card">
                                <h3>보유 메모</h3>
                                <div class="history-side-list">
                                    ${asset.holdings.map(item => `
                                        <div class="history-side-row">
                                            <span>${item.label}</span>
                                            <strong>${formatWon(item.value)}</strong>
                                        </div>
                                    `).join('')}
                                    <div class="history-side-row total">
                                        <span>합계</span>
                                        <strong>${formatWon(holdingTotal)}</strong>
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}

                <div class="history-table">
                    <div class="history-table-header">
                        <span>날짜</span>
                        <span>구분</span>
                        <span>${isCashflow ? '금액' : '수량'}</span>
                        <span>${isCashflow ? '누적 잔고' : '단가'}</span>
                        <span>${isCashflow ? '비고' : '금액'}</span>
                    </div>
                    ${asset.transactions
                        .slice()
                        .sort((a, b) => new Date(a.date) - new Date(b.date))
                        .map(item => `
                            <div class="history-table-row ${item.type}">
                                <span>${formatHistoryDate(item.date)}</span>
                                <span class="history-trade-type ${item.type}">${getHistoryTypeLabel(item.type)}</span>
                                <span>${isCashflow ? formatWon(item.amount) : `${item.shares.toLocaleString()}주`}</span>
                                <span>${isCashflow ? formatWon(item.balance) : formatWon(item.price, false)}</span>
                                <span>${isCashflow ? getCashflowMemo(item) : formatWon(item.amount)}</span>
                            </div>
                        `).join('')}
                </div>
            </article>
        `;
    }).join('')}`;
}

function buildHistorySummary(transactions) {
    const buyTrades = transactions.filter(item => item.type === 'buy');
    const sellTrades = transactions.filter(item => item.type === 'sell');
    const buyAmount = buyTrades.reduce((sum, item) => sum + item.amount, 0);
    const sellAmount = sellTrades.reduce((sum, item) => sum + item.amount, 0);
    const buyShares = buyTrades.reduce((sum, item) => sum + item.shares, 0);
    const sellShares = sellTrades.reduce((sum, item) => sum + item.shares, 0);

    return {
        buyAmount,
        sellAmount,
        buyShares,
        sellShares,
        buyAvgPrice: buyShares > 0 ? buyAmount / buyShares : 0,
        sellAvgPrice: sellShares > 0 ? sellAmount / sellShares : 0,
        remainingShares: buyShares - sellShares,
        netInvested: buyAmount - sellAmount,
        tradeCount: transactions.length,
        firstDate: transactions[0]?.date,
        lastDate: transactions[transactions.length - 1]?.date
    };
}

function buildCashflowSummary(transactions) {
    const deposits = transactions.filter(item => item.type === 'deposit');
    const withdrawals = transactions.filter(item => item.type === 'withdrawal');
    const depositAmount = deposits.reduce((sum, item) => sum + item.amount, 0);
    const withdrawalAmount = withdrawals.reduce((sum, item) => sum + item.amount, 0);

    return {
        depositAmount,
        withdrawalAmount,
        depositCount: deposits.length,
        withdrawalCount: withdrawals.length,
        netAmount: depositAmount - withdrawalAmount,
        tradeCount: transactions.length,
        firstDate: transactions[0]?.date,
        lastDate: transactions[transactions.length - 1]?.date
    };
}

function buildHistoryOverview(assets) {
    const assetSummaries = assets.map(asset => {
        const netInvested = getAssetNetInvested(asset);
        const currentValue = getAssetCurrentValue(asset);
        const hasCurrentValue = typeof currentValue === 'number';

        return {
            name: asset.name,
            netInvested,
            currentValue,
            hasCurrentValue,
            pnl: hasCurrentValue ? currentValue - netInvested : null
        };
    });

    return {
        totalNetInvested: assetSummaries.reduce((sum, asset) => sum + asset.netInvested, 0),
        totalKnownValue: assetSummaries.filter(asset => asset.hasCurrentValue).reduce((sum, asset) => sum + asset.currentValue, 0),
        totalKnownPnL: assetSummaries.filter(asset => asset.hasCurrentValue).reduce((sum, asset) => sum + asset.pnl, 0),
        unvaluedNetInvested: assetSummaries.filter(asset => !asset.hasCurrentValue).reduce((sum, asset) => sum + asset.netInvested, 0),
        valuedAssetCount: assetSummaries.filter(asset => asset.hasCurrentValue).length,
        unvaluedNames: assetSummaries.filter(asset => !asset.hasCurrentValue).map(asset => asset.name)
    };
}

function getAssetNetInvested(asset) {
    if (asset.historyType === 'cashflow') {
        return buildCashflowSummary(asset.transactions).netAmount;
    }
    return buildHistorySummary(asset.transactions).netInvested;
}

function getAssetCurrentValue(asset) {
    if (asset.historyType !== 'cashflow') return null;

    const latestBalance = getLatestBalanceSnapshot(asset.balanceSnapshots || []);
    const holdingsTotal = (asset.holdings || []).reduce((sum, item) => sum + item.value, 0);
    return (latestBalance?.value || 0) + holdingsTotal;
}

function getLatestBalanceSnapshot(balanceSnapshots = []) {
    return balanceSnapshots
        .slice()
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0] || null;
}

function formatWon(value, includeCurrency = true) {
    const rounded = Math.round(value || 0).toLocaleString('ko-KR');
    return includeCurrency ? `₩${rounded}` : `${rounded}원`;
}

function formatHistoryDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('ko-KR', {
        year: '2-digit',
        month: '2-digit',
        day: '2-digit'
    });
}

function getHistoryTypeLabel(type) {
    const labels = {
        buy: '매수',
        sell: '매도',
        deposit: '입금',
        withdrawal: '출금'
    };
    return labels[type] || type;
}

function getCashflowMemo(item) {
    return item.type === 'deposit' ? '계좌 입금' : '계좌 출금';
}

function getExternalFinanceUrl(stock) {
    if (stock?.externalUrl) return stock.externalUrl;

    if (stock?.korCode) {
        return `https://finance.naver.com/item/main.naver?code=${stock.korCode}`;
    }

    if (stock?.symbol?.endsWith('.KS') || stock?.symbol?.endsWith('.KQ')) {
        const code = stock.symbol.replace('.KS', '').replace('.KQ', '');
        return `https://finance.naver.com/item/main.naver?code=${code}`;
    }

    if (stock?.symbol?.includes('-USD') || stock?.symbol?.includes('=F')) {
        return `https://www.google.com/finance/quote/${encodeURIComponent(stock.symbol)}`;
    }

    return '';
}

function formatNewsDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';

    return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * 사이드바 네비게이션 설정
 */
function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            currentView = btn.dataset.view;
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderCurrentView();
        });
    });
}

function setupStrategyMemo() {
    const textarea = document.getElementById('strategyMemoInput');
    const clearButton = document.getElementById('strategyClearBtn');

    if (textarea) {
        textarea.value = state.strategyMemo || '';
        textarea.addEventListener('input', () => {
            state.strategyMemo = textarea.value;
            state.strategyMemoSavedAt = new Date().toISOString();
            localStorage.setItem('strategyMemo', state.strategyMemo);
            localStorage.setItem('strategyMemoSavedAt', state.strategyMemoSavedAt);
            updateStrategySavedAt();
        });
    }

    if (clearButton) {
        clearButton.addEventListener('click', () => {
            state.strategyMemo = '';
            state.strategyMemoSavedAt = new Date().toISOString();
            localStorage.setItem('strategyMemo', '');
            localStorage.setItem('strategyMemoSavedAt', state.strategyMemoSavedAt);
            if (textarea) textarea.value = '';
            updateStrategySavedAt();
        });
    }
}

function renderStrategyMemo() {
    const textarea = document.getElementById('strategyMemoInput');
    if (textarea && textarea.value !== state.strategyMemo) {
        textarea.value = state.strategyMemo || '';
    }
    updateStrategySavedAt();
}

function updateStrategySavedAt() {
    const savedAtEl = document.getElementById('strategySavedAt');
    if (!savedAtEl) return;

    if (!state.strategyMemoSavedAt) {
        savedAtEl.textContent = '저장 기록 없음';
        return;
    }

    const date = new Date(state.strategyMemoSavedAt);
    if (Number.isNaN(date.getTime())) {
        savedAtEl.textContent = '방금 저장됨';
        return;
    }

    savedAtEl.textContent = `자동 저장: ${date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    })}`;
}

/**
 * 해외/국내 필터 탭 설정
 */
function setupFilterTabs() {
    document.querySelectorAll('.filter-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            currentMarketFilter = btn.dataset.filter;
            document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCategoryFilter = 'all';
            renderCategoryChips();
            renderCurrentView();
        });
    });
}

/**
 * 등락 필터 설정
 */
function setupMovementFilters() {
    document.querySelectorAll('.movement-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            currentMovementFilter = btn.dataset.movement;
            syncMovementFilterUI();
            renderCurrentView();
        });
    });
}

function setupFavoriteFilters() {
    document.querySelectorAll('.favorite-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            currentFavoriteFilter = btn.dataset.favoriteFilter || 'all';
            syncFavoriteFilterUI();
            renderCurrentView();
        });
    });

    syncFavoriteFilterUI();
}

function setupSummaryCardFilters() {
    const filterMap = {
        cardTotal: 'all',
        cardUp: 'up',
        cardDown: 'down'
    };

    Object.entries(filterMap).forEach(([cardId, movement]) => {
        const card = document.getElementById(cardId);
        if (!card) return;

        card.classList.add('summary-card-filter');
        card.addEventListener('click', () => {
            currentMovementFilter = movement;
            syncMovementFilterUI();
            renderCurrentView();
        });
    });
}

function syncMovementFilterUI() {
    document.querySelectorAll('.movement-chip').forEach(button => {
        button.classList.toggle('active', button.dataset.movement === currentMovementFilter);
    });
    syncSummaryFilterState();
}

function syncFavoriteFilterUI() {
    document.querySelectorAll('.favorite-chip').forEach(button => {
        button.classList.toggle('active', button.dataset.favoriteFilter === currentFavoriteFilter);
    });
}

function syncSummaryFilterState() {
    const activeMap = {
        cardTotal: currentMovementFilter === 'all',
        cardUp: currentMovementFilter === 'up',
        cardDown: currentMovementFilter === 'down'
    };

    Object.entries(activeMap).forEach(([cardId, isActive]) => {
        const card = document.getElementById(cardId);
        if (!card) return;
        card.classList.toggle('active-filter', isActive);
    });
}

/**
 * 카테고리 필터 칩 설정
 */
function setupCategoryFilters() {
    const categoryFilters = document.getElementById('categoryFilters');
    if (!categoryFilters) return;

    categoryFilters.addEventListener('click', (event) => {
        const button = event.target.closest('.category-chip');
        if (!button) return;

        currentCategoryFilter = button.dataset.category;
        syncCategoryFilterUI();
        renderCurrentView();
    });
}

function setupSearchFilter() {
    const input = document.getElementById('stockSearchInput');
    if (!input) return;

    input.addEventListener('input', (event) => {
        currentSearchQuery = event.target.value.trim();
        renderCurrentView();
    });
}

function setupNewsFilters() {
    document.querySelectorAll('.news-tab').forEach(button => {
        button.addEventListener('click', () => {
            currentNewsFilter = button.dataset.newsFilter || 'all';
            document.querySelectorAll('.news-tab').forEach(tab => {
                tab.classList.toggle('active', tab.dataset.newsFilter === currentNewsFilter);
            });
            if (currentView === 'news') {
                renderNewsView();
            }
        });
    });
}

function renderCategoryChips() {
    const categoryFilters = document.getElementById('categoryFilters');
    if (!categoryFilters) return;

    const options = MARKET_CATEGORY_CONFIG[currentMarketFilter] || MARKET_CATEGORY_CONFIG.all;
    const label = categoryFilters.querySelector('.filter-group-label')?.outerHTML || '<span class="filter-group-label">카테고리</span>';

    categoryFilters.innerHTML = `${label}${options.map(option => `
        <button class="category-chip${option.id === currentCategoryFilter ? ' active' : ''}" data-category="${option.id}">
            ${option.label}
        </button>
    `).join('')}`;
}

function syncCategoryFilterUI() {
    document.querySelectorAll('.category-chip').forEach(button => {
        button.classList.toggle('active', button.dataset.category === currentCategoryFilter);
    });
}

/**
 * 종목 상세 모달 이벤트
 */
function setupModalEvents() {
    const modal = document.getElementById('stockModal');
    const closeBtn = modal?.querySelector('.modal-close');

    if (closeBtn) {
        closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    }

    modal?.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });

    // ESC 키
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal?.classList.contains('active')) {
            modal.classList.remove('active');
        }
    });
}

/**
 * 종목 차트 영역 클릭 → 외부 주식 페이지
 */
document.addEventListener('click', (e) => {
    const favoriteButton = e.target.closest('.stock-favorite-btn');
    if (favoriteButton) {
        e.preventDefault();
        e.stopPropagation();
        toggleFavoriteStock(favoriteButton.dataset.favoriteSymbol);
        return;
    }

    const chartLink = e.target.closest('.stock-chart-link');
    if (!chartLink) return;
    const symbol = chartLink.dataset.chartSymbol;
    const stock = getAllStocks().find(s => s.symbol === symbol);
    if (!stock) return;

    const externalUrl = getExternalFinanceUrl(stock);
    if (externalUrl) {
        window.open(externalUrl, '_blank', 'noopener,noreferrer');
        return;
    }

    showModal(stock);
});

function isFavoriteStock(symbol) {
    return state.favorites.includes(symbol);
}

function toggleFavoriteStock(symbol) {
    if (!symbol) return;

    if (isFavoriteStock(symbol)) {
        state.favorites = state.favorites.filter(item => item !== symbol);
    } else {
        state.favorites = [...state.favorites, symbol];
    }

    localStorage.setItem('favoriteStocks', JSON.stringify(state.favorites));
    renderCurrentView();
}

async function showModal(stock) {
    const modal = document.getElementById('stockModal');
    const isKorean = stock.symbol.includes('.KS') || stock.symbol.includes('.KQ');
    const displaySymbol = stock.symbol.replace('.KS', '').replace('.KQ', '');
    const title = `${stock.name} (${displaySymbol})`;
    const currency = stock.currency === 'KRW' ? '₩' : '$';
    const dailyPct = stock.dailyChangePercent ?? stock.changePercent ?? 0;
    const monthlyPct = stock.monthlyChangePercent ?? null;
    const dailyDirection = dailyPct === 0 ? 'neutral' : (dailyPct > 0 ? 'up' : 'down');
    const dailyArrow = dailyPct === 0 ? '' : (dailyPct > 0 ? '▲' : '▼');

    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalPrice').textContent = `${currency}${stock.price?.toLocaleString()}`;
    document.getElementById('modalPrice').className = `modal-price ${dailyDirection}`;

    // 변동률 뱃지 (가격 옆)
    const badge = document.getElementById('modalChangeBadge');
    if (badge) {
        badge.textContent = `${dailyArrow ? `${dailyArrow} ` : ''}${Math.abs(dailyPct).toFixed(2)}%`;
        badge.className = `modal-change-badge ${dailyDirection}`;
    }

    document.getElementById('modalChange').innerHTML = `${dailyArrow ? `${dailyArrow} ` : ''}${Math.abs(dailyPct).toFixed(2)}%`;
    document.getElementById('modalPrevClose').textContent = stock.previousClose ? `${currency}${stock.previousClose?.toLocaleString()}` : '-';

    // 전일종가 날짜 계산
    const prevDateEl = document.getElementById('modalPrevDate');
    if (prevDateEl) {
        const now = new Date();
        const prev = new Date(now);
        // 전일(영업일) 계산: 월요일이면 금요일, 일요일이면 금요일
        const day = now.getDay();
        if (day === 1) prev.setDate(now.getDate() - 3); // 월 → 금
        else if (day === 0) prev.setDate(now.getDate() - 2); // 일 → 금
        else prev.setDate(now.getDate() - 1);
        const m = prev.getMonth() + 1;
        const d = prev.getDate();
        prevDateEl.textContent = `(${m}/${d})`;
    }

    document.getElementById('modalHigh52').textContent = `${currency}${stock.high52?.toLocaleString() || '0'}`;
    document.getElementById('modalLow52').textContent = `${currency}${stock.low52?.toLocaleString() || '0'}`;

    // 전월비 표시
    const monthlyEl = document.getElementById('modalMonthly');
    if (monthlyEl && monthlyPct !== null) {
        monthlyEl.textContent = `${monthlyPct >= 0 ? '▲' : '▼'} ${Math.abs(monthlyPct).toFixed(2)}%`;
        monthlyEl.className = `modal-metric-value ${monthlyPct >= 0 ? 'up' : 'down'}`;
    }

    modal.classList.add('active');

    // 차트 로드
    try {
        const histRes = await api.fetchHistory(stock.symbol);
        if (histRes.data?.length) {
            renderModalChart('modalChart', histRes.data, stock.name);
        }
    } catch (e) {
        console.warn('차트 로드 실패');
    }
}

/**
 * AI 분석 실행
 */
async function showAnalysis(stock) {
    const content = document.getElementById('analysisContent');
    if (!content) return;

    const section = document.getElementById('analysisSection');
    if (section) section.style.display = 'block';

    content.innerHTML = '<div class="analysis-loading"><div class="spinner"></div><p>AI 분석 중...</p></div>';

    try {
        const result = await api.requestAnalysis(stock.symbol, stock);
        if (result.data) {
            content.innerHTML = '';
            content.appendChild(createAnalysisCard(result.data));
            section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    } catch (error) {
        content.innerHTML = `<div class="analysis-error"><p>❌ 분석 실패: ${error.message}</p><p>GEMINI_API_KEY가 설정되어 있는지 확인해주세요.</p></div>`;
    }
}

/**
 * 헤더 버튼 설정
 */
function setupHeaderButtons() {
    document.getElementById('btnRefresh')?.addEventListener('click', async () => {
        const btn = document.getElementById('btnRefresh');
        btn.classList.add('spinning');
        await loadAllData();
        btn.classList.remove('spinning');
    });

    document.getElementById('btnCollect')?.addEventListener('click', async () => {
        const btn = document.getElementById('btnCollect');
        btn.disabled = true;
        btn.textContent = '⏳ 수집 중...';
        try {
            await api.triggerCollect();
            await loadAllData();
        } catch (e) {
            console.error('수집 실패:', e);
        } finally {
            btn.disabled = false;
            btn.textContent = '↓ 수집';
        }
    });

    // 테마 토글
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const themeBtn = document.getElementById('btnThemeToggle');
    if (themeBtn) {
        themeBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
        themeBtn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme') || 'dark';
            const next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
            themeBtn.textContent = next === 'dark' ? '☀️' : '🌙';
        });
    }
}

/**
 * 서버 연결 체크
 */
async function checkHealth() {
    const dot = document.querySelector('.status-dot');
    const text = document.querySelector('.status-text');
    try {
        await api.checkHealth();
        dot?.classList.add('connected');
        if (text) text.textContent = '서버 연결됨';
    } catch {
        dot?.classList.add('error');
        if (text) text.textContent = '서버 연결 실패';
    }
}

function updateLastTime() {
    const el = document.getElementById('lastUpdate');
    if (el) el.textContent = `마지막 새로고침: ${new Date().toLocaleTimeString('ko-KR')}`;
}

async function updateDataDate() {
    const el = document.getElementById('dataDate');
    if (!el) return;

    try {
        const info = await api.fetchCollectionInfo();
        if (info.data?.lastCollectedAt) {
            const date = new Date(info.data.lastCollectedAt);
            const dateStr = date.toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
            const timeStr = date.toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit'
            });
            el.textContent = `📅 데이터 기준: ${dateStr} ${timeStr}`;
            el.title = `마지막 데이터 수집: ${date.toLocaleString('ko-KR')}`;
        } else {
            el.textContent = '📅 데이터 수집 대기 중...';
        }
    } catch {
        el.textContent = '📅 수집 정보 없음';
    }
}

function updateLoadingUI(loading) {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.style.display = loading ? 'block' : 'none';
}

/**
 * 데이터 새로고침
 */
export async function refreshData() {
    await loadAllData();
}

// =============================================
// 커스텀 종목 추가 모달
// =============================================

function setupCustomStockModal() {
    const btnOpen = document.getElementById('btnAddCustomStock');
    const modal = document.getElementById('addStockModal');
    const btnClose = document.getElementById('addStockModalClose');
    const btnSubmit = document.getElementById('btnSubmitCustom');
    const btnCancel = document.getElementById('btnCancelCustom');

    btnOpen?.addEventListener('click', () => {
        modal.classList.add('active');
        loadCustomStocksList();
        document.getElementById('customSymbol')?.focus();
    });

    btnClose?.addEventListener('click', () => modal.classList.remove('active'));
    btnCancel?.addEventListener('click', () => modal.classList.remove('active'));

    modal?.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal?.classList.contains('active')) {
            modal.classList.remove('active');
        }
    });

    btnSubmit?.addEventListener('click', submitCustomStock);

    // Enter 키로 제출
    document.getElementById('customSymbol')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitCustomStock();
    });
}

async function submitCustomStock() {
    const symbolInput = document.getElementById('customSymbol');
    const nameInput = document.getElementById('customName');
    const marketSelect = document.getElementById('customMarket');
    const msgEl = document.getElementById('customStockMessage');
    const btnSubmit = document.getElementById('btnSubmitCustom');

    const symbol = symbolInput?.value.trim();
    const name = nameInput?.value.trim();
    const market = marketSelect?.value;

    if (!symbol) {
        showCustomMessage(msgEl, '심볼을 입력해주세요.', 'error');
        symbolInput?.focus();
        return;
    }

    btnSubmit.disabled = true;
    btnSubmit.textContent = '추가 중...';

    try {
        const result = await api.addCustomStock(symbol, name, market);
        if (result.success) {
            showCustomMessage(msgEl, `✅ ${result.data.name} (${result.data.symbol}) 추가 완료!`, 'success');
            symbolInput.value = '';
            nameInput.value = '';
            loadCustomStocksList();
            // 데이터 새로고침
            setTimeout(async () => {
                const custom = await api.fetchCustomStocks().catch(() => ({ data: [] }));
                state.custom = custom.data || [];
                renderCurrentView();
                updateSummaryCards();
            }, 500);
        } else {
            showCustomMessage(msgEl, `❌ ${result.error || '추가 실패'}`, 'error');
        }
    } catch (error) {
        showCustomMessage(msgEl, `❌ ${error.message || '서버 오류'}`, 'error');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = '추가하기';
    }
}

function showCustomMessage(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = `form-message ${type}`;
    setTimeout(() => {
        el.className = 'form-message';
        el.textContent = '';
    }, 4000);
}

async function loadCustomStocksList() {
    const listEl = document.getElementById('customStocksList');
    if (!listEl) return;

    try {
        const res = await api.fetchCustomStocks();
        const stocks = res.data || [];

        if (stocks.length === 0) {
            listEl.innerHTML = '<p class="custom-empty">아직 추가한 종목이 없습니다.</p>';
            return;
        }

        listEl.innerHTML = stocks.map(s => `
            <div class="custom-stock-item">
                <div class="custom-stock-info">
                    <span class="custom-stock-symbol">${s.symbol}</span>
                    <span class="custom-stock-name">${s.name || s.symbol} · ${s.currency === 'KRW' ? '₩' : '$'}${s.price?.toLocaleString() || '-'}</span>
                </div>
                <button class="btn-remove-custom" data-symbol="${s.symbol}">삭제</button>
            </div>
        `).join('');

        // 삭제 버튼 이벤트
        listEl.querySelectorAll('.btn-remove-custom').forEach(btn => {
            btn.addEventListener('click', async () => {
                const symbol = btn.dataset.symbol;
                if (!confirm(`${symbol} 종목을 삭제하시겠습니까?`)) return;
                try {
                    await api.deleteCustomStock(symbol);
                    loadCustomStocksList();
                    // 데이터 새로고침
                    const custom = await api.fetchCustomStocks().catch(() => ({ data: [] }));
                    state.custom = custom.data || [];
                    renderCurrentView();
                    updateSummaryCards();
                } catch (e) {
                    alert('삭제 실패: ' + e.message);
                }
            });
        });
    } catch (e) {
        listEl.innerHTML = '<p class="custom-empty">목록 로드 실패</p>';
    }
}

// =============================================
// 포트폴리오 관리
// =============================================

let exchangeRate = 1350; // USD/KRW
let editingPortfolioSymbol = null;

function setupPortfolio() {
    const btnConfirm = document.getElementById('btnConfirmAdd');
    const btnCancel = document.getElementById('btnCancelAdd');
    const btnOpenAdd = document.getElementById('btnOpenPortfolioAdd');
    const cashToggleButtons = document.querySelectorAll('[data-cash-toggle]');
    const form = document.getElementById('portfolioAddForm');
    const stockSelect = document.getElementById('addStockSelect');

    btnOpenAdd?.addEventListener('click', () => {
        editingPortfolioSymbol = null;
        clearAddForm();
        populateStockSelector();
        form.style.display = form.style.display === 'block' ? 'none' : 'block';
        if (form.style.display === 'block') {
            form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });

    btnCancel?.addEventListener('click', () => {
        form.style.display = 'none';
        editingPortfolioSymbol = null;
        clearAddForm();
    });

    btnConfirm?.addEventListener('click', () => addStockToPortfolio());

    cashToggleButtons.forEach(button => {
        button.addEventListener('click', () => {
            const nextValue = button.dataset.cashToggle === 'include';
            if (includeCashInAllocation === nextValue) return;
            includeCashInAllocation = nextValue;
            syncPortfolioCashToggle();
            renderPortfolio();
        });
    });
    syncPortfolioCashToggle();

    // 셀렉터 변경 시 자동 입력
    stockSelect?.addEventListener('change', () => {
        const val = stockSelect.value;
        if (!val) return;
        const [symbol, market] = val.split('|');
        if (symbol === 'USD-CASH' || market === 'cash_usd') {
            document.getElementById('addStockInput').value = 'USD';
            document.getElementById('addStockName').value = '달러 현금';
            document.getElementById('addStockBuyPrice').value = exchangeRate ? Math.round(exchangeRate) : '';
            document.getElementById('addStockMarket').value = 'cash_usd';
            return;
        }
        const allStocks = getAllStocks();
        const stock = allStocks.find(s => s.symbol === symbol);
        if (stock) {
            document.getElementById('addStockInput').value = stock.symbol;
            document.getElementById('addStockName').value = stock.name;
            document.getElementById('addStockBuyPrice').value = stock.price || '';
            document.getElementById('addStockMarket').value = stock.currency === 'KRW' ? 'korean' : 'overseas';
        }
    });

    // 환율 로드
    loadExchangeRate();
}

async function loadExchangeRate() {
    try {
        const res = await api.fetchExchangeRate();
        if (res.data?.usdKrw) {
            exchangeRate = res.data.usdKrw;
            const el = document.getElementById('pfExchangeRate');
            if (el) el.textContent = `₩${Math.round(exchangeRate).toLocaleString()}`;
        }
    } catch { /* ignore */ }
}

function populateStockSelector() {
    const select = document.getElementById('addStockSelect');
    if (!select) return;

    const allStocks = getAllStocks();
    const existingSymbols = new Set(state.portfolio.map(p => p.symbol));

    select.innerHTML = '<option value="">-- 기존 종목에서 선택 --</option>';

    if (!existingSymbols.has('USD-CASH')) {
        const usdOption = document.createElement('option');
        usdOption.value = 'USD-CASH|cash_usd';
        usdOption.textContent = `달러 현금 (USD) - ₩${Math.round(exchangeRate).toLocaleString()}`;
        select.appendChild(usdOption);
    }

    allStocks.forEach(stock => {
        if (existingSymbols.has(stock.symbol)) return;
        const opt = document.createElement('option');
        opt.value = `${stock.symbol}|${stock.currency === 'KRW' ? 'korean' : 'overseas'}`;
        const currency = stock.currency === 'KRW' ? '₩' : '$';
        opt.textContent = `${stock.name} (${stock.symbol}) - ${currency}${stock.price?.toLocaleString()}`;
        select.appendChild(opt);
    });
}

function clearAddForm() {
    const ids = ['addStockInput', 'addStockName', 'addStockBuyPrice'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const qty = document.getElementById('addStockQty');
    if (qty) qty.value = '1';
    const sel = document.getElementById('addStockSelect');
    if (sel) sel.value = '';
    const marketSelect = document.getElementById('addStockMarket');
    if (marketSelect) marketSelect.value = 'overseas';
    const symbolInput = document.getElementById('addStockInput');
    if (symbolInput) symbolInput.disabled = false;
    const stockSelect = document.getElementById('addStockSelect');
    if (stockSelect) stockSelect.disabled = false;
}

async function addStockToPortfolio() {
    const symbolInput = document.getElementById('addStockInput');
    const nameInput = document.getElementById('addStockName');
    const qtyInput = document.getElementById('addStockQty');
    const buyPriceInput = document.getElementById('addStockBuyPrice');
    const marketSelect = document.getElementById('addStockMarket');
    const form = document.getElementById('portfolioAddForm');

    const rawSymbol = symbolInput?.value.trim() || '';
    const symbol = rawSymbol.toUpperCase();
    const name = nameInput?.value.trim() || symbol;
    const qty = parseFloat(qtyInput?.value) || 1;
    const buyPrice = parseFloat(buyPriceInput?.value) || 0;
    const typedUsdCash = ['USD', 'USD-CASH', '달러', '달러현금'].includes(symbol);
    const market = typedUsdCash ? 'cash_usd' : (marketSelect?.value || 'overseas');
    const isCashUsd = market === 'cash_usd';

    if (!symbol && !isCashUsd) {
        symbolInput?.focus();
        return;
    }

    const normalizedSymbol = isCashUsd ? 'USD-CASH' : symbol;
    const normalizedName = isCashUsd ? (nameInput?.value.trim() || '달러 현금') : (nameInput?.value.trim() || symbol);

    // 중복 체크
    if (!editingPortfolioSymbol && state.portfolio.find(s => s.symbol === normalizedSymbol)) {
        alert(`${normalizedName}은 이미 포트폴리오에 있습니다.`);
        return;
    }

    const newStock = {
        symbol: normalizedSymbol,
        name: normalizedName,
        market,
        qty,
        buyPrice,
        currency: market === 'korean' ? 'KRW' : 'USD',
        addedAt: new Date().toISOString()
    };

    if (editingPortfolioSymbol) {
        state.portfolio = state.portfolio.map(item =>
            item.symbol === editingPortfolioSymbol
                ? { ...item, ...newStock, editedAt: new Date().toISOString() }
                : item
        );
    } else {
        state.portfolio.push(newStock);
    }

    savePortfolio();

    form.style.display = 'none';
    editingPortfolioSymbol = null;
    clearAddForm();
    renderPortfolio();
}

function openPortfolioEditForm(symbol) {
    const item = state.portfolio.find(stock => stock.symbol === symbol);
    const form = document.getElementById('portfolioAddForm');
    if (!item || !form) return;

    editingPortfolioSymbol = symbol;
    populateStockSelector();

    const symbolInput = document.getElementById('addStockInput');
    const nameInput = document.getElementById('addStockName');
    const qtyInput = document.getElementById('addStockQty');
    const buyPriceInput = document.getElementById('addStockBuyPrice');
    const marketSelect = document.getElementById('addStockMarket');
    const stockSelect = document.getElementById('addStockSelect');

    if (symbolInput) {
        symbolInput.value = item.symbol === 'USD-CASH' ? 'USD' : item.symbol;
        symbolInput.disabled = true;
    }
    if (nameInput) nameInput.value = item.name || '';
    if (qtyInput) qtyInput.value = item.qty ?? 1;
    if (buyPriceInput) buyPriceInput.value = item.buyPrice ?? '';
    if (marketSelect) marketSelect.value = item.market || 'overseas';
    if (stockSelect) {
        stockSelect.value = '';
        stockSelect.disabled = true;
    }

    form.style.display = 'block';
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function removeFromPortfolio(symbol) {
    state.portfolio = state.portfolio.filter(s => s.symbol !== symbol);
    if (editingPortfolioSymbol === symbol) {
        editingPortfolioSymbol = null;
        clearAddForm();
    }
    savePortfolio();
    renderPortfolio();
}

function savePortfolio() {
    localStorage.setItem('portfolio', JSON.stringify(state.portfolio));
}

function renderPortfolio() {
    const container = document.getElementById('portfolioStocks');
    if (!container) return;

    if (state.portfolio.length === 0) {
        container.innerHTML = `
            <div class="portfolio-empty">
                <span class="portfolio-empty-icon">📂</span>
                <p>포트폴리오가 비어 있습니다.</p>
            </div>`;
        renderPortfolioAllocation([]);
        updatePortfolioSummary(0, 0);
        return;
    }

    container.innerHTML = '';
    const allStocks = getAllStocks();
    let totalValueKRW = 0;
    let totalInvestedKRW = 0;

    // 테이블 형태 리스트
    const table = document.createElement('div');
    table.className = 'pf-table';

    // 헤더
    table.innerHTML = `
        <div class="pf-table-header">
            <span class="pf-col-name">종목</span>
            <span class="pf-col-price">현재가</span>
            <span class="pf-col-qty">수량</span>
            <span class="pf-col-eval">평가금 (KRW)</span>
            <span class="pf-col-buy">매입가</span>
            <span class="pf-col-gain">손익</span>
            <span class="pf-col-action"></span>
        </div>`;

    const visiblePortfolioItems = state.portfolio.filter(item => {
        const portfolioItem = calculatePortfolioItem(item, allStocks);
        return matchesPortfolioAllocationFilter(portfolioItem);
    });

    if (!visiblePortfolioItems.length) {
        container.innerHTML = `
            <div class="portfolio-empty">
                <span class="portfolio-empty-icon">🧩</span>
                <p>선택한 구성 비율에 해당하는 종목이 없습니다.</p>
            </div>`;
        renderPortfolioAllocation(buildPortfolioAllocation(allStocks));
        updatePortfolioSummary(totalValueKRW, totalInvestedKRW);
        return;
    }

    visiblePortfolioItems.forEach(item => {
        const portfolioItem = calculatePortfolioItem(item, allStocks);
        const {
            qty,
            buyPrice,
            isUsdCash,
            isKRW,
            currentPrice,
            evalTotalKRW,
            investedKRW,
            gainKRW,
            gainPct,
            includeInSummary,
            liveData
        } = portfolioItem;
        const currencySymbol = isKRW ? '₩' : '$';

        const dailyPct = isUsdCash ? 0 : (liveData ? (liveData.dailyChangePercent ?? liveData.changePercent ?? 0) : 0);
        const dailyDirection = dailyPct === 0 ? 'neutral' : (dailyPct > 0 ? 'up' : 'down');
        const dailyArrow = dailyPct === 0 ? '' : (dailyPct > 0 ? '▲' : '▼');

        if (includeInSummary) {
            totalValueKRW += evalTotalKRW;
            totalInvestedKRW += investedKRW;
        }

        const gainDir = gainKRW >= 0 ? 'up' : 'down';
        const gainArrow = gainKRW >= 0 ? '▲' : '▼';

        const row = document.createElement('div');
        row.className = `pf-table-row ${dailyDirection}`;
        row.dataset.symbol = item.symbol;

        row.innerHTML = `
            <div class="pf-col-name">
                <div class="pf-stock-info">
                    <span class="pf-stock-name">${item.name || liveData?.name || item.symbol}</span>
                    <span class="pf-stock-symbol">${isUsdCash ? 'USD 현금' : item.symbol.replace('.KS', '').replace('.KQ', '')}</span>
                </div>
            </div>
            <div class="pf-col-price">
                <span class="pf-current-price">${isUsdCash ? `₩${Math.round(exchangeRate).toLocaleString()}` : (currentPrice ? `${currencySymbol}${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-')}</span>
                <span class="pf-daily-change ${dailyDirection}">${isUsdCash ? '환율 기준 평가' : `${dailyArrow ? `${dailyArrow} ` : ''}${Math.abs(dailyPct).toFixed(2)}%`}</span>
            </div>
            <div class="pf-col-qty">${qty.toLocaleString()}</div>
            <div class="pf-col-eval">
                <span class="pf-eval-krw">₩${Math.round(evalTotalKRW).toLocaleString()}</span>
                ${!isKRW ? `<span class="pf-eval-usd">$${(isUsdCash ? qty : currentPrice * qty).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>` : ''}
            </div>
            <div class="pf-col-buy">
                ${buyPrice > 0 ? `${isUsdCash ? '₩' : currencySymbol}${buyPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '<span class="pf-no-data">-</span>'}
            </div>
            <div class="pf-col-gain ${gainDir}">
                ${buyPrice > 0 ? `
                    <span class="pf-gain-amount ${gainDir}">${gainArrow} ₩${Math.abs(Math.round(gainKRW)).toLocaleString()}</span>
                    <span class="pf-gain-pct ${gainDir}">${gainArrow} ${Math.abs(gainPct).toFixed(2)}%</span>
                ` : '<span class="pf-no-data">-</span>'}
            </div>
            <div class="pf-col-action">
                <button class="btn-edit-stock" data-symbol="${item.symbol}" title="수정">수정</button>
                <button class="btn-remove-stock" data-symbol="${item.symbol}" title="삭제">×</button>
            </div>
        `;

        table.appendChild(row);
    });

    container.appendChild(table);
    renderPortfolioAllocation(buildPortfolioAllocation(allStocks));
    updatePortfolioSummary(totalValueKRW, totalInvestedKRW);

    // 삭제 버튼 이벤트
    container.querySelectorAll('.btn-edit-stock').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openPortfolioEditForm(btn.dataset.symbol);
        });
    });

    container.querySelectorAll('.btn-remove-stock').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const sym = btn.dataset.symbol;
            if (confirm(`${sym}을(를) 포트폴리오에서 삭제하시겠습니까?`)) {
                removeFromPortfolio(sym);
            }
        });
    });

    // 행 클릭 → 모달
    container.querySelectorAll('.pf-table-row').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.closest('.btn-remove-stock') || e.target.closest('.btn-edit-stock')) return;
            const symbol = row.dataset.symbol;
            const portfolioItem = state.portfolio.find(item => item.symbol === symbol);
            if (portfolioItem?.market === 'cash_usd' || symbol === 'USD-CASH') return;
            const stock = allStocks.find(s => s.symbol === symbol);
            if (stock) showModal(stock);
        });
    });
}

function calculatePortfolioItem(item, allStocks) {
    const liveData = allStocks.find(stock => stock.symbol === item.symbol);
    const qty = item.qty || 1;
    const buyPrice = item.buyPrice || 0;
    const isUsdCash = item.market === 'cash_usd' || item.symbol === 'USD-CASH';
    const isKrwCash = item.market === 'cash_krw' || item.symbol === 'KRW-CASH';
    const isKRW = isKrwCash || item.currency === 'KRW' || item.market === 'korean';
    const categoryKey = getPortfolioCategoryKey(item, liveData, isUsdCash, isKrwCash);
    const currentPrice = liveData?.price || 0;
    const evalUnitKRW = isUsdCash ? exchangeRate : (isKRW ? (isKrwCash ? 1 : currentPrice) : currentPrice * exchangeRate);
    const evalTotalKRW = evalUnitKRW * qty;
    const buyUnitKRW = isUsdCash ? buyPrice : (isKRW ? buyPrice : buyPrice * exchangeRate);
    const investedKRW = buyUnitKRW * qty;
    const gainKRW = buyPrice > 0 ? evalTotalKRW - investedKRW : 0;
    const gainPct = buyPrice > 0
        ? (isUsdCash
            ? ((exchangeRate - buyPrice) / buyPrice) * 100
            : ((currentPrice - buyPrice) / buyPrice) * 100)
        : 0;
    const includeInSummary = includeCashInAllocation || (!isUsdCash && !isKrwCash);

    return {
        liveData,
        qty,
        buyPrice,
        isUsdCash,
        isKrwCash,
        isKRW,
        categoryKey,
        currentPrice,
        evalTotalKRW,
        investedKRW,
        gainKRW,
        gainPct,
        includeInSummary
    };
}

function getPortfolioCategoryKey(item, liveData, isUsdCash, isKrwCash) {
    const isETF = ['etf_us', 'etf_kr'].includes(liveData?.theme) || item.market === 'etf';
    const isCrypto = liveData?.theme === 'crypto' || item.market === 'crypto';
    const isKorean = !isETF && !isCrypto && (item.market === 'korean' || liveData?.currency === 'KRW');

    if (isUsdCash || isKrwCash) return 'cash';
    if (isCrypto) return 'crypto';
    if (isETF) return 'etf';
    if (isKorean) return 'korean';
    return 'overseas';
}

function matchesPortfolioAllocationFilter(portfolioItem) {
    if (currentPortfolioAllocationFilter === 'all') return true;
    return portfolioItem.categoryKey === currentPortfolioAllocationFilter;
}

function buildPortfolioAllocation(allStocks) {
    const allocationMap = new Map([
        ['korean', { key: 'korean', label: '국내주식', color: '#10b981', value: 0, invested: 0 }],
        ['overseas', { key: 'overseas', label: '해외주식', color: '#f59e0b', value: 0, invested: 0 }],
        ['etf', { key: 'etf', label: 'ETF', color: '#14b8a6', value: 0, invested: 0 }],
        ['crypto', { key: 'crypto', label: '코인', color: '#ef4444', value: 0, invested: 0 }],
        ['cash', { key: 'cash', label: '원화/현금', color: '#6366f1', value: 0, invested: 0 }]
    ]);

    state.portfolio.forEach(item => {
        const { categoryKey, evalTotalKRW, investedKRW } = calculatePortfolioItem(item, allStocks);

        if (categoryKey === 'cash') {
            allocationMap.get('cash').value += evalTotalKRW;
            allocationMap.get('cash').invested += investedKRW;
        } else if (categoryKey === 'crypto') {
            allocationMap.get('crypto').value += evalTotalKRW;
            allocationMap.get('crypto').invested += investedKRW;
        } else if (categoryKey === 'etf') {
            allocationMap.get('etf').value += evalTotalKRW;
            allocationMap.get('etf').invested += investedKRW;
        } else if (categoryKey === 'korean') {
            allocationMap.get('korean').value += evalTotalKRW;
            allocationMap.get('korean').invested += investedKRW;
        } else {
            allocationMap.get('overseas').value += evalTotalKRW;
            allocationMap.get('overseas').invested += investedKRW;
        }
    });

    const items = Array.from(allocationMap.entries())
        .filter(([key, item]) => item.value > 0 && (includeCashInAllocation || key !== 'cash'))
        .map(([, item]) => ({
            ...item,
            gain: item.value - item.invested
        }))
        .sort((a, b) => b.value - a.value);

    return items;
}

function renderPortfolioAllocation(items) {
    const legend = document.getElementById('pfAllocationLegend');
    if (!legend) return;

    const total = items.reduce((sum, item) => sum + item.value, 0) || 1;

    renderPortfolioAllocationChart('pfAllocationChart', items, {
        activeKey: currentPortfolioAllocationFilter,
        onSliceClick: togglePortfolioAllocationFilter
    });

    if (!items.length) {
        legend.innerHTML = '<div class="custom-empty">구성 비율을 표시할 자산이 없습니다.</div>';
        return;
    }

    legend.innerHTML = items.map(item => {
        const pct = (item.value / total) * 100;
        const gainDir = item.gain >= 0 ? 'up' : 'down';
        const gainArrow = item.gain >= 0 ? '▲' : '▼';
        const isActive = currentPortfolioAllocationFilter === item.key;
        return `
            <button class="pf-allocation-item ${isActive ? 'active' : ''}" type="button" data-allocation-key="${item.key}">
                <span class="pf-allocation-dot" style="background:${item.color}"></span>
                <span class="pf-allocation-name">${item.label}</span>
                <div class="pf-allocation-meta">
                    <span class="pf-allocation-value">₩${Math.round(item.value).toLocaleString()}</span>
                    <span class="pf-allocation-pct">${pct.toFixed(1)}%</span>
                    <span class="pf-allocation-gain ${gainDir}">${gainArrow} ₩${Math.abs(Math.round(item.gain)).toLocaleString()}</span>
                </div>
            </button>
        `;
    }).join('');

    legend.querySelectorAll('[data-allocation-key]').forEach(button => {
        button.addEventListener('click', () => {
            togglePortfolioAllocationFilter(button.dataset.allocationKey);
        });
    });
}

function updatePortfolioSummary(totalValueKRW, totalInvestedKRW) {
    const totalKRWEl = document.getElementById('pfTotalKRW');
    const investedEl = document.getElementById('pfTotalInvested');
    const gainEl = document.getElementById('pfTotalGain');
    const gainPctEl = document.getElementById('pfTotalGainPct');

    if (totalKRWEl) totalKRWEl.textContent = `₩${Math.round(totalValueKRW).toLocaleString()}`;
    if (investedEl) investedEl.textContent = `₩${Math.round(totalInvestedKRW).toLocaleString()}`;

    const totalGain = totalValueKRW - totalInvestedKRW;
    const totalGainPct = totalInvestedKRW > 0 ? (totalGain / totalInvestedKRW) * 100 : 0;
    const dir = totalGain >= 0 ? 'up' : 'down';
    const arrow = totalGain >= 0 ? '▲' : '▼';

    if (gainEl) {
        gainEl.textContent = `${arrow} ₩${Math.abs(Math.round(totalGain)).toLocaleString()}`;
        gainEl.className = `pf-summary-value ${dir}`;
    }
    if (gainPctEl) {
        gainPctEl.textContent = `${arrow} ${Math.abs(totalGainPct).toFixed(2)}%`;
        gainPctEl.className = `pf-summary-sub ${dir}`;
    }
}

function syncPortfolioCashToggle() {
    document.querySelectorAll('[data-cash-toggle]').forEach(button => {
        const isActive = (button.dataset.cashToggle === 'include') === includeCashInAllocation;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
}

function togglePortfolioAllocationFilter(nextKey) {
    currentPortfolioAllocationFilter = currentPortfolioAllocationFilter === nextKey ? 'all' : nextKey;
    renderPortfolio();
}
