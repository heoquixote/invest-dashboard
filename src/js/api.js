/**
 * API 호출 모듈 (n8n 백엔드)
 * - 로그인: 면담 로그와 같은 dl/login 세션 토큰 사용
 * - 시세: dl/invest action=market (매일 09:00 수집 스냅샷)
 * - 개인 데이터: dl/invest action=private_get / private_save (소유자 이메일 기준 DB 저장)
 */
const API = 'https://hote.app.n8n.cloud/webhook/dl/';
const TOKEN_KEY = 'dl_token';
const NAME_KEY = 'dl_name';
const MARKET_TTL = 60 * 1000;

export class AuthError extends Error {
    constructor(message, status) {
        super(message);
        this.name = 'AuthError';
        this.status = status;
    }
}

function store(key, value) {
    try {
        if (value === null) sessionStorage.removeItem(key);
        else sessionStorage.setItem(key, value);
    } catch { /* ignore */ }
}

function load(key) {
    try { return sessionStorage.getItem(key); } catch { return null; }
}

export const session = {
    token: load(TOKEN_KEY),
    name: load(NAME_KEY) || ''
};

let authErrorHandler = null;
export function onAuthError(handler) {
    authErrorHandler = handler;
}

async function postForm(path, fields) {
    const fd = new FormData();
    Object.entries(fields).forEach(([key, value]) => {
        if (value !== undefined && value !== null) fd.append(key, value);
    });
    const res = await fetch(API + path, { method: 'POST', body: fd });
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    return { res, data };
}

async function call(action, payload) {
    if (!session.token) {
        const err = new AuthError('로그인이 필요합니다.', 401);
        authErrorHandler?.(err);
        throw err;
    }
    const { res, data } = await postForm('invest', {
        token: session.token,
        action,
        payload: payload ? JSON.stringify(payload) : undefined
    });
    if (res.status === 401 || res.status === 403) {
        const err = new AuthError(data?.error || '접근 권한이 없습니다.', res.status);
        if (res.status === 401) logout();
        authErrorHandler?.(err);
        throw err;
    }
    if (!res.ok || !data || data.ok === false) {
        throw new Error(data?.error || `요청 실패 (HTTP ${res.status})`);
    }
    return data;
}

// =============================================
// 인증
// =============================================

export async function login(email, password) {
    const { data } = await postForm('login', { email, password });
    if (!data?.ok || !data.token) {
        throw new Error(data?.error || '이메일 또는 비밀번호를 확인해 주세요.');
    }
    session.token = data.token;
    session.name = data.name || email;
    store(TOKEN_KEY, session.token);
    store(NAME_KEY, session.name);
    return session;
}

export function logout() {
    session.token = null;
    session.name = '';
    store(TOKEN_KEY, null);
    store(NAME_KEY, null);
    marketCache = null;
    privateData = {};
}

// =============================================
// 시세 스냅샷
// =============================================

let marketCache = null; // { at, promise }

function getMarket(force = false) {
    const fresh = marketCache && Date.now() - marketCache.at < MARKET_TTL;
    if (!force && fresh) return marketCache.promise;
    const promise = call('market').catch(error => {
        marketCache = null;
        throw error;
    });
    marketCache = { at: Date.now(), promise };
    return promise;
}

export function invalidateMarket() {
    marketCache = null;
}

const wrap = data => ({ success: true, data });

export async function fetchOverseasStocks() {
    return wrap((await getMarket()).overseas || []);
}

export async function fetchKoreanStocks() {
    return wrap((await getMarket()).korean || []);
}

export async function fetchGold() {
    return wrap((await getMarket()).commodities || []);
}

export async function fetchCrypto() {
    return wrap((await getMarket()).crypto || []);
}

export async function fetchIndices() {
    return wrap((await getMarket()).indices || []);
}

export async function fetchMacroIndicators() {
    return wrap((await getMarket()).macros || []);
}

export async function fetchNews() {
    return wrap((await getMarket()).news || { updatedAt: null, categories: [], items: {} });
}

export async function fetchCollectionInfo() {
    return wrap((await getMarket()).meta || {});
}

export async function fetchExchangeRate() {
    const meta = (await getMarket()).meta || {};
    return wrap({ usdKrw: meta.usdKrw || null, updatedAt: meta.lastCollectedAt || null });
}

export async function fetchHistory(symbol, period = '3mo') {
    const data = await call('history', { symbol, period });
    return wrap(data.data || []);
}

export async function checkHealth() {
    return wrap({ status: 'ok' });
}

/**
 * 수집 실행: 백엔드가 즉시 202를 돌려주고 백그라운드로 수집하므로
 * 수집 시각이 바뀔 때까지 스냅샷을 다시 확인한다 (최대 약 2분)
 */
export async function triggerCollect() {
    const before = (await getMarket().catch(() => ({})))?.meta?.lastCollectedAt || null;
    await call('collect');
    for (let i = 0; i < 24; i += 1) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        const market = await getMarket(true).catch(() => null);
        const after = market?.meta?.lastCollectedAt || null;
        if (after && after !== before) return wrap(market.meta);
    }
    throw new Error('수집이 아직 끝나지 않았습니다. 잠시 후 새로고침해 주세요.');
}

// =============================================
// 개인 데이터 (DB 저장)
// =============================================

let privateData = {};
const saveTimers = {};
const pendingSaves = {};
let saveListener = null;

export function onPrivateSave(listener) {
    saveListener = listener;
}

export async function loadPrivate() {
    const data = await call('private_get');
    privateData = data.data || {};
    return privateData;
}

export function getPrivate(key, fallback) {
    const value = privateData[key];
    return value === undefined || value === null ? fallback : value;
}

async function persist(key) {
    const value = privateData[key];
    saveListener?.({ key, state: 'saving' });
    try {
        await call('private_save', { key, value });
        saveListener?.({ key, state: 'saved' });
    } catch (error) {
        saveListener?.({ key, state: 'error', error });
        throw error;
    } finally {
        delete pendingSaves[key];
    }
}

export function setPrivate(key, value, { immediate = false } = {}) {
    privateData[key] = value;
    clearTimeout(saveTimers[key]);
    saveTimers[key] = null;
    if (immediate) {
        pendingSaves[key] = persist(key);
        return pendingSaves[key];
    }
    saveTimers[key] = setTimeout(() => {
        saveTimers[key] = null;
        pendingSaves[key] = persist(key).catch(error => console.error(`${key} 저장 실패:`, error));
    }, 800);
    return Promise.resolve();
}

export function hasPendingSaves() {
    return Object.keys(saveTimers).some(key => saveTimers[key]) || Object.keys(pendingSaves).length > 0;
}

export async function fetchPrivateHistory() {
    return wrap(getPrivate('privateHistory', []));
}

// =============================================
// 내가 추가한 종목 (목록은 DB, 시세는 실시간 조회)
// =============================================

function getCustomList() {
    return getPrivate('customStocks', []);
}

export async function fetchCustomStocks() {
    const list = getCustomList();
    if (!list.length) return wrap([]);
    const data = await call('quotes', { symbols: list.map(item => item.symbol) });
    const quotes = new Map((data.data || []).map(q => [q.symbol, q]));
    const merged = list
        .map(item => {
            const quote = quotes.get(item.symbol);
            if (!quote) return null;
            const market = item.market || 'overseas';
            const korCode = /^\d{6}\.(KS|KQ)$/.test(item.symbol) ? item.symbol.slice(0, 6) : undefined;
            return {
                ...quote,
                name: item.name || quote.name || item.symbol,
                theme: 'custom',
                themeName: '⭐ 내가 추가한 종목',
                market,
                isCustom: true,
                ...(korCode ? {
                    korCode,
                    externalProvider: 'naver',
                    externalUrl: `https://finance.naver.com/item/main.naver?code=${korCode}`
                } : {})
            };
        })
        .filter(Boolean);
    return wrap(merged);
}

export async function addCustomStock(symbol, name, market) {
    const normalized = String(symbol || '').trim().toUpperCase();
    if (!normalized) return { success: false, error: '심볼을 입력해주세요' };
    const list = getCustomList();
    if (list.some(item => item.symbol === normalized)) {
        return { success: false, error: '이미 추가된 종목입니다' };
    }
    const newStock = {
        symbol: normalized,
        name: name || normalized,
        market: market || 'overseas',
        addedAt: new Date().toISOString()
    };
    await setPrivate('customStocks', [...list, newStock], { immediate: true });
    return { success: true, data: newStock, message: `${newStock.name} 추가 완료` };
}

export async function deleteCustomStock(symbol) {
    const list = getCustomList();
    const next = list.filter(item => item.symbol !== String(symbol).toUpperCase());
    if (next.length === list.length) {
        return { success: false, error: '해당 종목을 찾을 수 없습니다' };
    }
    await setPrivate('customStocks', next, { immediate: true });
    return { success: true, message: `${symbol} 삭제 완료` };
}
