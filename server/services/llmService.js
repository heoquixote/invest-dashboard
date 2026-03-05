import { GoogleGenerativeAI } from '@google/generative-ai';
import storage from './localStorage.js';

let genAI = null;
let model = null;

/**
 * Gemini API 초기화
 */
function initLLM() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
        console.warn('⚠️  GEMINI_API_KEY가 설정되지 않았습니다. AI 분석 기능이 비활성화됩니다.');
        return false;
    }

    try {
        genAI = new GoogleGenerativeAI(apiKey);
        model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        console.log('✅ Gemini LLM 연결 성공');
        return true;
    } catch (error) {
        console.error('❌ Gemini 초기화 실패:', error.message);
        return false;
    }
}

/**
 * 개별 종목 분석
 */
async function analyzeStock(stockData, historyData = []) {
    if (!model) {
        return {
            recommendation: 'N/A',
            confidence: 0,
            reasoning: 'Gemini API 키가 설정되지 않았습니다. .env 파일에 GEMINI_API_KEY를 설정해주세요.',
            riskLevel: 'N/A',
            targetPrice: null
        };
    }

    const prompt = buildAnalysisPrompt(stockData, historyData);

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        return parseAnalysisResponse(text, stockData);
    } catch (error) {
        console.error(`❌ LLM 분석 실패 (${stockData.symbol}):`, error.message);
        return {
            recommendation: 'ERROR',
            confidence: 0,
            reasoning: `분석 중 오류 발생: ${error.message}`,
            riskLevel: 'N/A',
            targetPrice: null
        };
    }
}

/**
 * 분석 프롬프트 생성
 */
function buildAnalysisPrompt(stock, history) {
    let historyText = '';
    if (history.length > 0) {
        const recentHistory = history.slice(-10).map(h =>
            `  ${h.date}: 종가 ${h.close}, 거래량 ${h.volume}`
        ).join('\n');
        historyText = `\n최근 가격 추이:\n${recentHistory}`;
    }

    return `당신은 전문 투자 분석가입니다. 다음 종목 데이터를 분석하여 투자 의견을 제시해주세요.

종목 정보:
- 종목코드: ${stock.symbol}
- 종목명: ${stock.name}
- 현재가: ${stock.price} ${stock.currency || ''}
- 변동률: ${stock.changePercent?.toFixed(2)}%
- 거래량: ${stock.volume?.toLocaleString()}
- 52주 최고: ${stock.high52}
- 52주 최저: ${stock.low52}
- 시가총액: ${stock.marketCap?.toLocaleString()}
${historyText}

다음 JSON 형식으로만 응답해주세요 (다른 텍스트 없이):
{
  "recommendation": "매수" 또는 "매도" 또는 "보유",
  "confidence": 0~100 사이의 숫자,
  "reasoning": "분석 근거 (2-3문장)",
  "riskLevel": "낮음" 또는 "보통" 또는 "높음",
  "targetPrice": 목표가 숫자
}

주의: 반드시 위 JSON 형식으로만 응답하세요. 마크다운 코드블록 없이 순수 JSON만 응답하세요.`;
}

/**
 * LLM 응답 파싱
 */
function parseAnalysisResponse(text, stock) {
    try {
        // 코드블록 제거
        let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);

        return {
            recommendation: parsed.recommendation || '보유',
            confidence: Math.min(100, Math.max(0, parsed.confidence || 50)),
            reasoning: parsed.reasoning || '분석 결과를 파싱할 수 없습니다.',
            riskLevel: parsed.riskLevel || '보통',
            targetPrice: parsed.targetPrice || null
        };
    } catch (error) {
        console.warn(`⚠️  LLM 응답 파싱 실패, 텍스트에서 추출 시도...`);
        // 텍스트에서 추천 키워드 추출
        let recommendation = '보유';
        if (text.includes('매수')) recommendation = '매수';
        else if (text.includes('매도')) recommendation = '매도';

        return {
            recommendation,
            confidence: 50,
            reasoning: text.slice(0, 200),
            riskLevel: '보통',
            targetPrice: null
        };
    }
}

/**
 * 전체 포트폴리오 분석
 */
async function analyzePortfolio(allStocks) {
    if (!model) {
        return {
            summary: 'Gemini API 키가 설정되지 않았습니다.',
            recommendations: [],
            marketOutlook: 'N/A'
        };
    }

    const stockSummary = allStocks.map(s =>
        `${s.name}(${s.symbol}): ${s.price} ${s.currency || ''}, 변동률 ${s.changePercent?.toFixed(2)}%`
    ).join('\n');

    const prompt = `당신은 전문 투자 분석가입니다. 다음 포트폴리오를 종합 분석해주세요.

보유 종목:
${stockSummary}

다음 JSON 형식으로만 응답해주세요 (다른 텍스트 없이):
{
  "summary": "전체 포트폴리오 요약 분석 (2-3문장)",
  "marketOutlook": "긍정적" 또는 "중립" 또는 "부정적",
  "topPick": "가장 추천하는 종목코드",
  "topPickReason": "추천 이유 (1-2문장)",
  "riskWarning": "주의해야 할 종목과 이유 (1-2문장)"
}

주의: 반드시 위 JSON 형식으로만 응답하세요. 마크다운 코드블록 없이 순수 JSON만 응답하세요.`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleaned);
    } catch (error) {
        console.error('❌ 포트폴리오 분석 실패:', error.message);
        return {
            summary: `분석 중 오류 발생: ${error.message}`,
            marketOutlook: 'N/A',
            topPick: null,
            topPickReason: null,
            riskWarning: null
        };
    }
}

/**
 * 분석 결과를 스프레드시트에 기록
 */
async function saveAnalysisToSheet(symbol, name, analysis) {
    const date = new Date().toISOString().split('T')[0];
    storage.appendRows('LLM분석', [[
        date, symbol, name,
        analysis.recommendation,
        analysis.confidence,
        analysis.riskLevel,
        analysis.reasoning,
        analysis.targetPrice || ''
    ]]);
}

export default {
    initLLM,
    analyzeStock,
    analyzePortfolio,
    saveAnalysisToSheet
};
