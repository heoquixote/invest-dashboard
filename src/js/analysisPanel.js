/**
 * AI 분석 패널 모듈
 */

/**
 * 개별 종목 분석 결과 카드 생성
 */
export function createAnalysisCard(analysis) {
    const recClass = getRecClass(analysis.recommendation);
    const recEmoji = getRecEmoji(analysis.recommendation);

    const card = document.createElement('div');
    card.className = 'analysis-result-card';
    card.innerHTML = `
    <div class="analysis-result-header">
      <div class="analysis-stock-info">
        <span class="analysis-stock-name">${analysis.name || analysis.symbol}</span>
        <span style="color: var(--text-muted); font-size: 12px;">${analysis.symbol}</span>
      </div>
      <span class="analysis-recommendation ${recClass}">
        ${recEmoji} ${analysis.recommendation || 'N/A'}
      </span>
    </div>
    <div class="analysis-metrics">
      <div class="analysis-metric">
        <div class="analysis-metric-label">신뢰도</div>
        <div class="analysis-metric-value" style="color: ${getConfidenceColor(analysis.confidence)}">${analysis.confidence || 0}%</div>
      </div>
      <div class="analysis-metric">
        <div class="analysis-metric-label">리스크</div>
        <div class="analysis-metric-value" style="color: ${getRiskColor(analysis.riskLevel)}">${analysis.riskLevel || 'N/A'}</div>
      </div>
      <div class="analysis-metric">
        <div class="analysis-metric-label">목표가</div>
        <div class="analysis-metric-value">${analysis.targetPrice ? analysis.targetPrice.toLocaleString() : '-'}</div>
      </div>
    </div>
    <div class="analysis-reasoning">
      📝 ${analysis.reasoning || '분석 결과 없음'}
    </div>
    ${analysis.analyzedAt ? `<div style="text-align: right; margin-top: 8px; font-size: 11px; color: var(--text-muted);">분석 시각: ${new Date(analysis.analyzedAt).toLocaleString('ko-KR')}</div>` : ''}
  `;

    return card;
}

/**
 * 포트폴리오 분석 결과 렌더링
 */
export function createPortfolioAnalysis(analysis) {
    const outlookClass = getOutlookClass(analysis.marketOutlook);
    const outlookEmoji = getOutlookEmoji(analysis.marketOutlook);

    const container = document.createElement('div');
    container.className = 'portfolio-analysis';
    container.innerHTML = `
    <div class="portfolio-outlook ${outlookClass}">
      ${outlookEmoji} 시장 전망: ${analysis.marketOutlook || 'N/A'}
    </div>
    <div class="portfolio-summary">
      ${analysis.summary || '분석 결과 없음'}
    </div>
    ${analysis.topPick ? `
      <div class="analysis-result-card" style="border-left: 3px solid var(--color-up);">
        <div style="font-size: 13px; color: var(--color-up); font-weight: 600; margin-bottom: 8px;">
          🏆 최우선 추천 종목: ${analysis.topPick}
        </div>
        <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.7;">
          ${analysis.topPickReason || ''}
        </div>
      </div>
    ` : ''}
    ${analysis.riskWarning ? `
      <div class="analysis-result-card" style="border-left: 3px solid var(--color-down);">
        <div style="font-size: 13px; color: var(--color-down); font-weight: 600; margin-bottom: 8px;">
          ⚠️ 주의 종목
        </div>
        <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.7;">
          ${analysis.riskWarning}
        </div>
      </div>
    ` : ''}
    <div style="text-align: right; font-size: 11px; color: var(--text-muted); margin-top: 12px;">
      분석 시각: ${new Date(analysis.analyzedAt || Date.now()).toLocaleString('ko-KR')} | 분석 종목 수: ${analysis.stockCount || 0}
    </div>
  `;

    return container;
}

/**
 * 로딩 상태 표시
 */
export function showAnalysisLoading(container, message = 'AI가 분석 중입니다...') {
    container.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; padding: 40px;">
      <div class="spinner"></div>
      <p style="color: var(--text-muted); margin-top: 16px; font-size: 14px;">${message}</p>
      <p style="color: var(--text-muted); font-size: 12px; margin-top: 4px;">Gemini AI가 데이터를 분석하고 있습니다. 잠시만 기다려주세요.</p>
    </div>
  `;
}

// Helper functions
function getRecClass(rec) {
    if (!rec) return 'hold';
    if (rec.includes('매수') || rec === 'BUY') return 'buy';
    if (rec.includes('매도') || rec === 'SELL') return 'sell';
    return 'hold';
}

function getRecEmoji(rec) {
    if (!rec) return '🟡';
    if (rec.includes('매수') || rec === 'BUY') return '🟢';
    if (rec.includes('매도') || rec === 'SELL') return '🔴';
    return '🟡';
}

function getConfidenceColor(confidence) {
    if (confidence >= 70) return 'var(--color-up)';
    if (confidence >= 40) return 'var(--color-hold)';
    return 'var(--color-down)';
}

function getRiskColor(risk) {
    if (risk === '낮음') return 'var(--color-up)';
    if (risk === '높음') return 'var(--color-down)';
    return 'var(--color-hold)';
}

function getOutlookClass(outlook) {
    if (outlook === '긍정적') return 'positive';
    if (outlook === '부정적') return 'negative';
    return 'neutral';
}

function getOutlookEmoji(outlook) {
    if (outlook === '긍정적') return '📈';
    if (outlook === '부정적') return '📉';
    return '➡️';
}
