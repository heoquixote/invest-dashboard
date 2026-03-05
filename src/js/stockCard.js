/**
 * 종목 카드 컴포넌트
 */

export function createStockCard(stock, onAnalyze) {
  // 전일비 기반 상승/하락 판단
  const dailyPct = stock.dailyChangePercent ?? stock.changePercent ?? 0;
  const monthlyPct = stock.monthlyChangePercent ?? null;
  const isDailyUp = dailyPct >= 0;
  const direction = isDailyUp ? 'up' : 'down';

  const currency = stock.currency === 'KRW' ? '₩' : '$';
  const priceFormatted = formatPrice(stock.price, stock.currency);
  const dailyArrow = isDailyUp ? '▲' : '▼';
  const dailyFormatted = `${dailyArrow} ${Math.abs(dailyPct).toFixed(2)}%`;

  // 전월비 포맷
  let monthlyHtml = '';
  if (monthlyPct !== null && monthlyPct !== undefined) {
    const isMonthlyUp = monthlyPct >= 0;
    const monthlyArrow = isMonthlyUp ? '▲' : '▼';
    const monthlyClass = isMonthlyUp ? 'up' : 'down';
    monthlyHtml = `
          <div class="stock-monthly ${monthlyClass}">
            <span class="monthly-label">전월비</span>
            <span class="monthly-value">${monthlyArrow} ${Math.abs(monthlyPct).toFixed(2)}%</span>
          </div>`;
  }

  const prevCloseFormatted = stock.previousClose ? `${currency}${formatPrice(stock.previousClose, stock.currency)}` : '-';

  const card = document.createElement('div');
  card.className = `stock-card ${direction}`;
  card.dataset.symbol = stock.symbol;
  const isKorean = stock.symbol.includes('.KS') || stock.symbol.includes('.KQ');
  const displaySymbol = stock.symbol.replace('.KS', '').replace('.KQ', '');
  const primaryLabel = stock.name || displaySymbol;
  const secondaryLabel = displaySymbol;

  card.innerHTML = `
    <div class="stock-card-header">
      <div>
        <div class="stock-symbol">${primaryLabel}</div>
        <div class="stock-name">${secondaryLabel}</div>
      </div>
      ${stock.recommendation ? `
        <span class="stock-badge ${getRecClass(stock.recommendation)}">${stock.recommendation}</span>
      ` : ''}
    </div>
    <div class="stock-card-body">
      <div class="stock-price">${currency}${priceFormatted}</div>
      <div class="stock-change">
        <div class="stock-daily">
          <span class="daily-label">전일비</span>
          <span class="stock-change-percent">${dailyFormatted}</span>
        </div>
        ${monthlyHtml}
      </div>
    </div>
    <canvas class="stock-sparkline" id="sparkline-${stock.symbol.replace(/[^a-zA-Z0-9]/g, '_')}"></canvas>
    <div class="stock-card-footer">
      <span class="stock-prev-close">전일 ${prevCloseFormatted}</span>
      <button class="btn-ai-analyze" data-symbol="${stock.symbol}">🤖 AI 분석</button>
    </div>
  `;

  // AI 분석 버튼 이벤트
  const analyzeBtn = card.querySelector('.btn-ai-analyze');
  analyzeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (onAnalyze) onAnalyze(stock);
  });

  return card;
}

function getRecClass(recommendation) {
  if (!recommendation) return '';
  if (recommendation.includes('매수') || recommendation === 'BUY') return 'buy';
  if (recommendation.includes('매도') || recommendation === 'SELL') return 'sell';
  return 'hold';
}

function formatPrice(price, currency) {
  if (!price) return '0';
  if (currency === 'KRW') {
    return Math.round(price).toLocaleString();
  }
  return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatVolume(volume) {
  if (!volume) return '-';
  if (volume >= 1e9) return (volume / 1e9).toFixed(1) + 'B';
  if (volume >= 1e6) return (volume / 1e6).toFixed(1) + 'M';
  if (volume >= 1e3) return (volume / 1e3).toFixed(1) + 'K';
  return volume.toLocaleString();
}

/**
 * 스파크라인 차트 (미니 차트)
 */
export function drawSparkline(canvasId, data, isUp) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !data.length) return;

  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * 2;
  canvas.height = rect.height * 2;
  ctx.scale(2, 2);

  const w = rect.width;
  const h = rect.height;
  const padding = 4;

  const prices = data.map(d => d.close || d.price || 0).filter(p => p > 0);
  if (prices.length < 2) return;

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const style = getComputedStyle(document.documentElement);
  const color = isUp ? style.getPropertyValue('--color-up').trim() || '#ef4444' : style.getPropertyValue('--color-down').trim() || '#3b82f6';
  const points = prices.map((p, i) => ({
    x: padding + (i / (prices.length - 1)) * (w - padding * 2),
    y: padding + (1 - (p - min) / range) * (h - padding * 2)
  }));

  // 그라데이션 영역
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, isUp ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.lineTo(points[points.length - 1].x, h);
  ctx.lineTo(points[0].x, h);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // 라인
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
