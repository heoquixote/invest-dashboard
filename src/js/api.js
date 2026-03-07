/**
 * API 호출 모듈
 */
const API_BASE = '/api';

async function fetchJSON(url, options = {}) {
    try {
        const res = await fetch(`${API_BASE}${url}`, {
            headers: { 'Content-Type': 'application/json' },
            ...options
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'API 요청 실패');
        return data;
    } catch (error) {
        console.error(`API Error (${url}):`, error);
        throw error;
    }
}

export async function fetchOverseasStocks() {
    return fetchJSON('/stocks/overseas');
}

export async function fetchKoreanStocks() {
    return fetchJSON('/stocks/korean');
}

export async function fetchGold() {
    return fetchJSON('/gold');
}

export async function fetchCrypto() {
    return fetchJSON('/crypto');
}

export async function fetchHistory(symbol, period = '3mo') {
    return fetchJSON(`/stocks/${encodeURIComponent(symbol)}/history?period=${period}`);
}

export async function requestAnalysis(symbol) {
    return fetchJSON(`/analysis/${encodeURIComponent(symbol)}`, { method: 'POST' });
}

export async function requestPortfolioAnalysis() {
    return fetchJSON('/analysis/portfolio/all', { method: 'POST' });
}

export async function checkHealth() {
    return fetchJSON('/health');
}

export async function checkAnalysisStatus() {
    return fetchJSON('/analysis/status');
}

export async function triggerCollect() {
    return fetchJSON('/collect', { method: 'POST' });
}

export async function fetchCollectionInfo() {
    return fetchJSON('/collection-info');
}

export async function fetchIndices() {
    return fetchJSON('/indices');
}

export async function fetchExchangeRate() {
    return fetchJSON('/exchange-rate');
}

export async function fetchCustomStocks() {
    return fetchJSON('/stocks/custom');
}

export async function addCustomStock(symbol, name, market) {
    return fetchJSON('/stocks/custom', {
        method: 'POST',
        body: JSON.stringify({ symbol, name, market })
    });
}

export async function deleteCustomStock(symbol) {
    return fetchJSON(`/stocks/custom/${encodeURIComponent(symbol)}`, { method: 'DELETE' });
}
