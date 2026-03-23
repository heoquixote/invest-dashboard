/**
 * Chart.js 차트 렌더링
 */
let currentChart = null;
let modalChartInstance = null;
let portfolioAllocationChartInstance = null;

const chartDefaultConfig = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false },
        tooltip: {
            backgroundColor: 'rgba(17, 24, 39, 0.95)',
            titleColor: '#f1f5f9',
            bodyColor: '#94a3b8',
            borderColor: 'rgba(99, 102, 241, 0.3)',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            titleFont: { size: 13, weight: '600' },
            bodyFont: { size: 12 },
            callbacks: {
                label: function (context) {
                    return ` ${context.parsed.y.toLocaleString()}`;
                }
            }
        }
    },
    scales: {
        x: {
            grid: {
                color: 'rgba(148, 163, 184, 0.06)',
                lineWidth: 1
            },
            ticks: {
                color: '#64748b',
                font: { size: 11 },
                maxRotation: 0,
                autoSkip: true,
                maxTicksLimit: 8
            }
        },
        y: {
            position: 'right',
            grid: {
                color: 'rgba(148, 163, 184, 0.06)',
                lineWidth: 1
            },
            ticks: {
                color: '#64748b',
                font: { size: 11 },
                callback: function (value) {
                    return value.toLocaleString();
                }
            }
        }
    },
    interaction: {
        intersect: false,
        mode: 'index'
    },
    elements: {
        point: { radius: 0, hoverRadius: 5 }
    }
};

/**
 * 메인 차트 렌더링
 */
export function renderPriceChart(canvasId, historyData, label = '가격') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }

    if (!historyData || historyData.length === 0) return;

    const ctx = canvas.getContext('2d');
    const prices = historyData.map(d => d.close || 0);
    const isUp = prices[prices.length - 1] >= prices[0];
    const style = getComputedStyle(document.documentElement);
    const color = isUp ? style.getPropertyValue('--color-up').trim() || '#ef4444' : style.getPropertyValue('--color-down').trim() || '#3b82f6';

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.parentElement.clientHeight);
    gradient.addColorStop(0, isUp ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');

    const labels = historyData.map(d => {
        const date = new Date(d.date);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    });

    currentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label,
                data: prices,
                borderColor: color,
                backgroundColor: gradient,
                borderWidth: 2,
                fill: true,
                tension: 0.3
            }]
        },
        options: { ...chartDefaultConfig }
    });

    return currentChart;
}

/**
 * 모달 차트 렌더링
 */
export function renderModalChart(canvasId, historyData, label = '가격') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (modalChartInstance) {
        modalChartInstance.destroy();
        modalChartInstance = null;
    }

    if (!historyData || historyData.length === 0) return;

    const ctx = canvas.getContext('2d');
    const prices = historyData.map(d => d.close || 0);
    const isUp = prices[prices.length - 1] >= prices[0];
    const style = getComputedStyle(document.documentElement);
    const color = isUp ? style.getPropertyValue('--color-up').trim() || '#ef4444' : style.getPropertyValue('--color-down').trim() || '#3b82f6';

    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, isUp ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');

    const labels = historyData.map(d => {
        const date = new Date(d.date);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    });

    modalChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label,
                data: prices,
                borderColor: color,
                backgroundColor: gradient,
                borderWidth: 2,
                fill: true,
                tension: 0.3
            }]
        },
        options: { ...chartDefaultConfig }
    });

    return modalChartInstance;
}

export function destroyCharts() {
    if (currentChart) { currentChart.destroy(); currentChart = null; }
    if (modalChartInstance) { modalChartInstance.destroy(); modalChartInstance = null; }
    if (portfolioAllocationChartInstance) { portfolioAllocationChartInstance.destroy(); portfolioAllocationChartInstance = null; }
}

export function renderPortfolioAllocationChart(canvasId, items = [], options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    if (portfolioAllocationChartInstance) {
        portfolioAllocationChartInstance.destroy();
        portfolioAllocationChartInstance = null;
    }

    if (!items.length) return null;

    const ctx = canvas.getContext('2d');
    const { activeKey = 'all', onSliceClick } = options;

    portfolioAllocationChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: items.map(item => item.label),
            datasets: [{
                data: items.map(item => item.value),
                backgroundColor: items.map(item => item.color || '#64748b'),
                borderColor: items.map(item => activeKey === 'all' || item.key === activeKey ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)'),
                borderWidth: items.map(item => activeKey === 'all' || item.key === activeKey ? 2 : 1),
                hoverOffset: 8,
                offset: items.map(item => activeKey === 'all' ? 0 : (item.key === activeKey ? 14 : 0))
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%',
            onClick: (_, elements) => {
                if (!elements.length || typeof onSliceClick !== 'function') return;
                const index = elements[0].index;
                const item = items[index];
                if (item) onSliceClick(item.key);
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    titleColor: '#f1f5f9',
                    bodyColor: '#cbd5e1',
                    borderColor: 'rgba(99, 102, 241, 0.2)',
                    borderWidth: 1,
                    callbacks: {
                        label(context) {
                            const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
                            const value = context.parsed || 0;
                            const pct = (value / total) * 100;
                            return ` ₩${Math.round(value).toLocaleString()} (${pct.toFixed(1)}%)`;
                        }
                    }
                }
            }
        }
    });

    return portfolioAllocationChartInstance;
}
