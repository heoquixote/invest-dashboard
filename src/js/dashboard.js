/**
 * 대시보드 모듈 - 테마별 그룹 렌더링 + 해외/국내 필터
 */
import * as api from './api.js';
import { createStockCard, drawSparkline } from './stockCard.js';
import { renderPriceChart, renderModalChart } from './charts.js';
import { createAnalysisCard, createPortfolioAnalysis } from './analysisPanel.js';

let currentView = 'all'; // all, overseas, korean, commodity, portfolio, analysis
let currentMarketFilter = 'all'; // all, overseas, korean
let currentCategoryFilter = 'all'; // all, tech, defense, energy, consumer, finance, ai_data, kr_major, kr_theme, commodity
let currentMovementFilter = 'all'; // all, up, down, spike, crash

const state = {
    overseas: [],
    korean: [],
    gold: [],
    crypto: [],
    custom: [],
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
    setupModalEvents();
    setupHeaderButtons();
    setupPortfolio();
    setupCustomStockModal();
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
        const [overseas, korean, gold, crypto, custom] = await Promise.all([
            api.fetchOverseasStocks().catch(() => ({ data: [] })),
            api.fetchKoreanStocks().catch(() => ({ data: [] })),
            api.fetchGold().catch(() => ({ data: [] })),
            api.fetchCrypto().catch(() => ({ data: [] })),
            api.fetchCustomStocks().catch(() => ({ data: [] }))
        ]);

        state.overseas = overseas.data || [];
        state.korean = korean.data || [];
        state.gold = gold.data || [];
        state.crypto = crypto.data || [];
        state.custom = custom.data || [];

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
    const withPrice = all.filter(s => s.price > 0).length;

    const totalEl = document.getElementById('totalCount');
    const upEl = document.getElementById('upCount');
    const downEl = document.getElementById('downCount');
    const coverageEl = document.getElementById('coverageCount');

    if (totalEl) totalEl.textContent = all.length;
    if (upEl) upEl.textContent = upCount;
    if (downEl) downEl.textContent = downCount;
    if (coverageEl) {
        coverageEl.textContent = `${withPrice}/${all.length}`;
        coverageEl.title = `종가 기준 ${withPrice}개 종목 수집 완료`;
    }

    // 2. 시장 지수 업데이트
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

function getAllStocks() {
    return [...state.overseas, ...state.korean, ...state.gold, ...state.crypto, ...state.custom];
}

/**
 * 현재 뷰에 맞게 렌더링
 */
function renderCurrentView() {
    const title = document.getElementById('viewTitle');
    const stocksSection = document.getElementById('stocksSection');
    const chartSection = document.getElementById('chartSection');
    const analysisSection = document.getElementById('analysisSection');
    const portfolioSection = document.getElementById('portfolioSection');
    const filterBar = document.getElementById('marketFilterBar');

    stocksSection.style.display = 'block';
    chartSection.style.display = 'none';
    analysisSection.style.display = 'none';
    if (portfolioSection) portfolioSection.style.display = 'none';

    switch (currentView) {
        case 'all':
            title.textContent = '대시보드';
            filterBar.style.display = 'flex';
            renderThemedStocks(getFilteredStocks());
            break;
        case 'overseas':
            title.textContent = '🌎 해외 주식';
            filterBar.style.display = 'none';
            renderThemedStocks(state.overseas);
            break;
        case 'korean':
            title.textContent = '🇰🇷 국내 주식';
            filterBar.style.display = 'none';
            renderThemedStocks(state.korean);
            break;
        case 'commodity':
            title.textContent = '🥇 금 / 원자재';
            filterBar.style.display = 'none';
            renderThemedStocks(state.gold);
            break;
        case 'crypto':
            title.textContent = '🪙 암호화폐';
            filterBar.style.display = 'none';
            renderThemedStocks(state.crypto);
            break;
        case 'portfolio':
            title.textContent = '💼 내 포트폴리오';
            stocksSection.style.display = 'none';
            if (portfolioSection) portfolioSection.style.display = 'block';
            filterBar.style.display = 'none';
            renderPortfolio();
            break;
        case 'analysis':
            title.textContent = '🤖 AI 분석';
            stocksSection.style.display = 'none';
            analysisSection.style.display = 'block';
            filterBar.style.display = 'none';
            break;
    }
}

/**
 * 해외/국내 + 카테고리 필터 적용
 */
function getFilteredStocks() {
    let stocks = getAllStocks();

    // 시장 필터
    if (currentMarketFilter === 'overseas') stocks = state.overseas;
    else if (currentMarketFilter === 'korean') stocks = [...state.korean, ...state.gold];

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

    return stocks;
}

/**
 * 테마별 그룹 렌더링
 */
function renderThemedStocks(stocks) {
    const grid = document.getElementById('stocksGrid');
    grid.innerHTML = '';

    if (!stocks.length) {
        grid.innerHTML = '<div class="stocks-empty">데이터가 없습니다. \'수집\' 버튼을 클릭해주세요.</div>';
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
            const card = createStockCard(stock, (s) => showAnalysis(s));
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
            const card = createStockCard(stock, (s) => showAnalysis(s));
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

/**
 * 해외/국내 필터 탭 설정
 */
function setupFilterTabs() {
    document.querySelectorAll('.filter-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            currentMarketFilter = btn.dataset.filter;
            document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            // 시장 필터 변경 시 카테고리 필터 리셋
            currentCategoryFilter = 'all';
            document.querySelectorAll('.category-chip').forEach(b => b.classList.remove('active'));
            document.querySelector('.category-chip[data-category="all"]')?.classList.add('active');
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
            document.querySelectorAll('.movement-chip').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderCurrentView();
        });
    });
}

/**
 * 카테고리 필터 칩 설정
 */
function setupCategoryFilters() {
    document.querySelectorAll('.category-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            currentCategoryFilter = btn.dataset.category;
            document.querySelectorAll('.category-chip').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderCurrentView();
        });
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
 * 종목 카드 클릭 → 모달
 */
document.addEventListener('click', (e) => {
    const card = e.target.closest('.stock-card');
    if (!card || e.target.closest('.btn-ai-analyze')) return;
    const symbol = card.dataset.symbol;
    const stock = getAllStocks().find(s => s.symbol === symbol);
    if (stock) showModal(stock);
});

async function showModal(stock) {
    const modal = document.getElementById('stockModal');
    const isKorean = stock.symbol.includes('.KS') || stock.symbol.includes('.KQ');
    const displaySymbol = stock.symbol.replace('.KS', '').replace('.KQ', '');
    const title = `${stock.name} (${displaySymbol})`;
    const currency = stock.currency === 'KRW' ? '₩' : '$';
    const dailyPct = stock.dailyChangePercent ?? stock.changePercent ?? 0;
    const monthlyPct = stock.monthlyChangePercent ?? null;

    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalPrice').textContent = `${currency}${stock.price?.toLocaleString()}`;
    document.getElementById('modalPrice').className = `modal-price ${dailyPct >= 0 ? 'up' : 'down'}`;

    // 변동률 뱃지 (가격 옆)
    const badge = document.getElementById('modalChangeBadge');
    if (badge) {
        badge.textContent = `${dailyPct >= 0 ? '▲' : '▼'} ${Math.abs(dailyPct).toFixed(2)}%`;
        badge.className = `modal-change-badge ${dailyPct >= 0 ? 'up' : 'down'}`;
    }

    document.getElementById('modalChange').innerHTML = `${dailyPct >= 0 ? '▲' : '▼'} ${Math.abs(dailyPct).toFixed(2)}%`;
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
    currentView = 'analysis';
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-view="analysis"]')?.classList.add('active');
    renderCurrentView();

    const content = document.getElementById('analysisContent');
    content.innerHTML = '<div class="analysis-loading"><div class="spinner"></div><p>AI 분석 중...</p></div>';

    try {
        const result = await api.requestAnalysis(stock.symbol, stock);
        if (result.data) {
            content.innerHTML = '';
            content.appendChild(createAnalysisCard(result.data));
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

    // 포트폴리오 분석 버튼
    document.getElementById('btnAnalyzeAll')?.addEventListener('click', async () => {
        const btn = document.getElementById('btnAnalyzeAll');
        btn.disabled = true;
        const content = document.getElementById('analysisContent');
        content.innerHTML = '<div class="analysis-loading"><div class="spinner"></div><p>전체 포트폴리오 분석 중...</p></div>';

        try {
            const result = await api.requestPortfolioAnalysis();
            if (result.data) {
                content.innerHTML = '';
                content.appendChild(createPortfolioAnalysis(result.data));
            }
        } catch (error) {
            content.innerHTML = `<div class="analysis-error"><p>❌ 분석 실패: ${error.message}</p></div>`;
        } finally {
            btn.disabled = false;
        }
    });
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

function setupPortfolio() {
    const btnAdd = document.getElementById('btnAddStock');
    const btnConfirm = document.getElementById('btnConfirmAdd');
    const btnCancel = document.getElementById('btnCancelAdd');
    const form = document.getElementById('portfolioAddForm');
    const stockSelect = document.getElementById('addStockSelect');

    btnAdd?.addEventListener('click', () => {
        const isVisible = form.style.display !== 'none';
        form.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) {
            populateStockSelector();
            document.getElementById('addStockQty')?.focus();
        }
    });

    btnCancel?.addEventListener('click', () => {
        form.style.display = 'none';
        clearAddForm();
    });

    btnConfirm?.addEventListener('click', () => addStockToPortfolio());

    // 셀렉터 변경 시 자동 입력
    stockSelect?.addEventListener('change', () => {
        const val = stockSelect.value;
        if (!val) return;
        const [symbol, market] = val.split('|');
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
}

async function addStockToPortfolio() {
    const symbolInput = document.getElementById('addStockInput');
    const nameInput = document.getElementById('addStockName');
    const qtyInput = document.getElementById('addStockQty');
    const buyPriceInput = document.getElementById('addStockBuyPrice');
    const marketSelect = document.getElementById('addStockMarket');
    const form = document.getElementById('portfolioAddForm');

    const symbol = symbolInput?.value.trim().toUpperCase();
    const name = nameInput?.value.trim() || symbol;
    const qty = parseFloat(qtyInput?.value) || 1;
    const buyPrice = parseFloat(buyPriceInput?.value) || 0;
    const market = marketSelect?.value || 'overseas';

    if (!symbol) {
        symbolInput?.focus();
        return;
    }

    // 중복 체크
    if (state.portfolio.find(s => s.symbol === symbol)) {
        alert(`${symbol}은 이미 포트폴리오에 있습니다.`);
        return;
    }

    const newStock = {
        symbol, name, market, qty, buyPrice,
        currency: market === 'korean' ? 'KRW' : 'USD',
        addedAt: new Date().toISOString()
    };
    state.portfolio.push(newStock);
    savePortfolio();

    form.style.display = 'none';
    clearAddForm();
    renderPortfolio();
}

function removeFromPortfolio(symbol) {
    state.portfolio = state.portfolio.filter(s => s.symbol !== symbol);
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
                <p>포트폴리오가 비어 있습니다.<br>"+ 종목 추가" 버튼으로 관심 종목을 추가해보세요.</p>
            </div>`;
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

    state.portfolio.forEach(item => {
        const liveData = allStocks.find(s => s.symbol === item.symbol);
        const qty = item.qty || 1;
        const buyPrice = item.buyPrice || 0;
        const isKRW = item.currency === 'KRW' || item.market === 'korean';
        const currencySymbol = isKRW ? '₩' : '$';

        const currentPrice = liveData?.price || 0;
        const dailyPct = liveData ? (liveData.dailyChangePercent ?? liveData.changePercent ?? 0) : 0;

        // 평가금 (원화)
        const evalUnitKRW = isKRW ? currentPrice : currentPrice * exchangeRate;
        const evalTotalKRW = evalUnitKRW * qty;
        totalValueKRW += evalTotalKRW;

        // 투자금 (원화)
        const buyUnitKRW = isKRW ? buyPrice : buyPrice * exchangeRate;
        const investedKRW = buyUnitKRW * qty;
        totalInvestedKRW += investedKRW;

        // 손익 계산
        const gainKRW = buyPrice > 0 ? evalTotalKRW - investedKRW : 0;
        const gainPct = buyPrice > 0 ? ((currentPrice - buyPrice) / buyPrice) * 100 : 0;
        const gainDir = gainKRW >= 0 ? 'up' : 'down';
        const gainArrow = gainKRW >= 0 ? '▲' : '▼';

        const row = document.createElement('div');
        row.className = `pf-table-row ${dailyPct >= 0 ? 'up' : 'down'}`;
        row.dataset.symbol = item.symbol;

        row.innerHTML = `
            <div class="pf-col-name">
                <div class="pf-stock-info">
                    <span class="pf-stock-name">${item.name || liveData?.name || item.symbol}</span>
                    <span class="pf-stock-symbol">${item.symbol.replace('.KS', '').replace('.KQ', '')}</span>
                </div>
            </div>
            <div class="pf-col-price">
                <span class="pf-current-price">${currencySymbol}${currentPrice ? currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</span>
                <span class="pf-daily-change ${dailyPct >= 0 ? 'up' : 'down'}">${dailyPct >= 0 ? '▲' : '▼'} ${Math.abs(dailyPct).toFixed(2)}%</span>
            </div>
            <div class="pf-col-qty">${qty.toLocaleString()}</div>
            <div class="pf-col-eval">
                <span class="pf-eval-krw">₩${Math.round(evalTotalKRW).toLocaleString()}</span>
                ${!isKRW ? `<span class="pf-eval-usd">$${(currentPrice * qty).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>` : ''}
            </div>
            <div class="pf-col-buy">
                ${buyPrice > 0 ? `${currencySymbol}${buyPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '<span class="pf-no-data">-</span>'}
            </div>
            <div class="pf-col-gain ${gainDir}">
                ${buyPrice > 0 ? `
                    <span class="pf-gain-amount ${gainDir}">${gainArrow} ₩${Math.abs(Math.round(gainKRW)).toLocaleString()}</span>
                    <span class="pf-gain-pct ${gainDir}">${gainArrow} ${Math.abs(gainPct).toFixed(2)}%</span>
                ` : '<span class="pf-no-data">-</span>'}
            </div>
            <div class="pf-col-action">
                <button class="btn-remove-stock" data-symbol="${item.symbol}" title="삭제">×</button>
            </div>
        `;

        table.appendChild(row);
    });

    container.appendChild(table);
    updatePortfolioSummary(totalValueKRW, totalInvestedKRW);

    // 삭제 버튼 이벤트
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
            if (e.target.closest('.btn-remove-stock')) return;
            const symbol = row.dataset.symbol;
            const stock = allStocks.find(s => s.symbol === symbol);
            if (stock) showModal(stock);
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

