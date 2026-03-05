/**
 * 투자 분석 대시보드 - 메인 엔트리 포인트
 */
import { initDashboard, refreshData } from './dashboard.js';

// 앱 초기화
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📊 Investment Dashboard 시작...');

    // 대시보드 초기화 (이벤트 바인딩 + 데이터 로드)
    await initDashboard();

    // 5분마다 자동 갱신
    setInterval(async () => {
        console.log('🔄 자동 데이터 갱신...');
        await refreshData();
    }, 5 * 60 * 1000);

    console.log('✅ Dashboard 초기화 완료');
});
