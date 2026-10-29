/**
 * 투자 분석 대시보드 - 메인 엔트리 포인트
 * 로그인(데이터 러너즈 계정) → 개인 데이터 로드 → 대시보드 초기화
 */
import * as api from './api.js';

function applySavedTheme() {
    let theme = 'dark';
    try { theme = localStorage.getItem('theme') || 'dark'; } catch { /* ignore */ }
    document.documentElement.setAttribute('data-theme', theme);
}

function showGate(message = '') {
    document.body.classList.add('auth-locked');
    const gate = document.getElementById('authGate');
    const msg = document.getElementById('authMessage');
    if (gate) gate.hidden = false;
    if (msg) {
        msg.textContent = message;
        msg.hidden = !message;
    }
    document.getElementById('authEmail')?.focus();
}

function hideGate() {
    document.body.classList.remove('auth-locked');
    const gate = document.getElementById('authGate');
    if (gate) gate.hidden = true;
}

function setupSaveIndicator() {
    const el = document.getElementById('saveStatus');
    if (!el) return;
    let timer = null;
    api.onPrivateSave(({ state }) => {
        clearTimeout(timer);
        el.dataset.state = state;
        el.textContent = state === 'saving' ? '저장 중…' : state === 'saved' ? 'DB 저장됨' : '저장 실패';
        if (state === 'saved') timer = setTimeout(() => { el.textContent = ''; el.dataset.state = ''; }, 2500);
    });
}

function setupAccountBar() {
    const nameEl = document.getElementById('accountName');
    if (nameEl) nameEl.textContent = api.session.name || '';
    document.getElementById('btnLogout')?.addEventListener('click', () => {
        if (api.hasPendingSaves() && !confirm('저장 중인 변경 사항이 있습니다. 그래도 로그아웃할까요?')) return;
        api.logout();
        location.reload();
    });
    window.addEventListener('beforeunload', event => {
        if (api.hasPendingSaves()) {
            event.preventDefault();
            event.returnValue = '';
        }
    });
}

function setupImport() {
    const modal = document.getElementById('importModal');
    const open = document.getElementById('btnImportData');
    const close = document.getElementById('importModalClose');
    const cancel = document.getElementById('btnCancelImport');
    const submit = document.getElementById('btnSubmitImport');
    const input = document.getElementById('importJson');
    const msg = document.getElementById('importMessage');

    const hide = () => modal?.classList.remove('active');
    open?.addEventListener('click', () => {
        modal?.classList.add('active');
        if (msg) { msg.textContent = ''; msg.className = 'form-message'; }
        input?.focus();
    });
    close?.addEventListener('click', hide);
    cancel?.addEventListener('click', hide);
    modal?.addEventListener('click', e => { if (e.target === modal) hide(); });

    submit?.addEventListener('click', async () => {
        let parsed;
        try {
            parsed = JSON.parse(input.value || '');
        } catch {
            msg.textContent = 'JSON 형식이 올바르지 않습니다.';
            msg.className = 'form-message error';
            return;
        }
        const tasks = [];
        const parseMaybe = value => {
            if (typeof value !== 'string') return value;
            try { return JSON.parse(value); } catch { return value; }
        };
        const portfolio = parseMaybe(parsed.portfolio);
        const favorites = parseMaybe(parsed.favoriteStocks ?? parsed.favorites);
        if (Array.isArray(portfolio)) tasks.push(api.setPrivate('portfolio', portfolio, { immediate: true }));
        if (Array.isArray(favorites)) tasks.push(api.setPrivate('favorites', favorites, { immediate: true }));
        if (typeof parsed.strategyMemo === 'string') {
            tasks.push(api.setPrivate('strategyMemo', {
                text: parsed.strategyMemo,
                savedAt: parsed.strategyMemoSavedAt || new Date().toISOString()
            }, { immediate: true }));
        }
        if (!tasks.length) {
            msg.textContent = '가져올 항목(portfolio, favoriteStocks, strategyMemo)이 없습니다.';
            msg.className = 'form-message error';
            return;
        }
        submit.disabled = true;
        try {
            await Promise.all(tasks);
            msg.textContent = `${tasks.length}개 항목을 DB에 저장했습니다. 화면을 다시 불러옵니다.`;
            msg.className = 'form-message success';
            setTimeout(() => location.reload(), 900);
        } catch (error) {
            msg.textContent = `저장 실패: ${error.message}`;
            msg.className = 'form-message error';
        } finally {
            submit.disabled = false;
        }
    });
}

let started = false;

async function startDashboard() {
    hideGate();
    if (started) return;
    await api.loadPrivate();
    setupSaveIndicator();
    setupAccountBar();
    setupImport();

    const { initDashboard, refreshData } = await import('./dashboard.js');
    started = true;
    await initDashboard();

    setInterval(async () => {
        await refreshData();
    }, 5 * 60 * 1000);
}

function setupLoginForm() {
    const form = document.getElementById('authForm');
    const button = document.getElementById('authSubmit');
    form?.addEventListener('submit', async event => {
        event.preventDefault();
        const email = document.getElementById('authEmail').value.trim();
        const password = document.getElementById('authPassword').value;
        button.disabled = true;
        button.textContent = '확인 중…';
        try {
            await api.login(email, password);
            await startDashboard();
        } catch (error) {
            api.logout();
            showGate(error.message || '로그인에 실패했습니다.');
        } finally {
            button.disabled = false;
            button.textContent = '로그인';
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    applySavedTheme();
    setupLoginForm();
    api.onAuthError(error => {
        if (error.status === 403) {
            api.logout();
            showGate(error.message);
        } else {
            showGate('로그인이 만료되었습니다. 다시 로그인해 주세요.');
        }
    });

    if (!api.session.token) {
        showGate();
        return;
    }
    try {
        await startDashboard();
    } catch (error) {
        if (!(error instanceof api.AuthError)) {
            showGate(error.message || '데이터를 불러오지 못했습니다.');
        }
    }
});
