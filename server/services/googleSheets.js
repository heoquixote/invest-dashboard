import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

let sheetsApi = null;
let spreadsheetId = null;

/**
 * Google Sheets API 초기화
 */
async function initSheets() {
    if (sheetsApi) return sheetsApi;

    const credPath = process.env.GOOGLE_CREDENTIALS_PATH || './credentials/service-account.json';
    spreadsheetId = process.env.GOOGLE_SHEETS_ID;

    if (!spreadsheetId) {
        console.warn('⚠️  GOOGLE_SHEETS_ID가 설정되지 않았습니다. 스프레드시트 기능이 비활성화됩니다.');
        return null;
    }

    try {
        const absolutePath = path.resolve(credPath);
        if (!fs.existsSync(absolutePath)) {
            console.warn(`⚠️  서비스 계정 키 파일을 찾을 수 없습니다: ${absolutePath}`);
            console.warn('   Google Sheets 기능이 비활성화됩니다.');
            return null;
        }

        const auth = new google.auth.GoogleAuth({
            keyFile: absolutePath,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        sheetsApi = google.sheets({ version: 'v4', auth });
        console.log('✅ Google Sheets API 연결 성공');
        return sheetsApi;
    } catch (error) {
        console.error('❌ Google Sheets 초기화 실패:', error.message);
        return null;
    }
}

/**
 * 스프레드시트에 시트가 존재하는지 확인하고, 없으면 생성
 */
async function ensureSheet(sheetName, headers) {
    const sheets = await initSheets();
    if (!sheets) return false;

    try {
        const res = await sheets.spreadsheets.get({ spreadsheetId });
        const existing = res.data.sheets.map(s => s.properties.title);

        if (!existing.includes(sheetName)) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                    requests: [{
                        addSheet: { properties: { title: sheetName } }
                    }]
                }
            });

            // 헤더 행 추가
            if (headers) {
                await sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: `${sheetName}!A1`,
                    valueInputOption: 'RAW',
                    requestBody: { values: [headers] }
                });
            }
            console.log(`📋 시트 생성: ${sheetName}`);
        }
        return true;
    } catch (error) {
        console.error(`❌ 시트 확인/생성 실패 (${sheetName}):`, error.message);
        return false;
    }
}

/**
 * 스프레드시트에 행 추가
 */
async function appendRows(sheetName, rows) {
    const sheets = await initSheets();
    if (!sheets) return false;

    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${sheetName}!A:Z`,
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values: rows }
        });
        return true;
    } catch (error) {
        console.error(`❌ 데이터 추가 실패 (${sheetName}):`, error.message);
        return false;
    }
}

/**
 * 스프레드시트의 모든 데이터 읽기
 */
async function readSheet(sheetName) {
    const sheets = await initSheets();
    if (!sheets) return [];

    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A:Z`
        });
        return res.data.values || [];
    } catch (error) {
        console.error(`❌ 데이터 읽기 실패 (${sheetName}):`, error.message);
        return [];
    }
}

/**
 * 각 종목의 최신 데이터 조회
 */
async function getLatestData(sheetName) {
    const rows = await readSheet(sheetName);
    if (rows.length < 2) return [];

    const headers = rows[0];
    const dataRows = rows.slice(1);

    // 종목별 최신 데이터만 추출 (마지막 행이 최신)
    const latestBySymbol = new Map();
    for (const row of dataRows) {
        const symbol = row[2]; // 종목코드 컬럼
        latestBySymbol.set(symbol, row);
    }

    return Array.from(latestBySymbol.values()).map(row => {
        const obj = {};
        headers.forEach((header, i) => {
            obj[header] = row[i] || '';
        });
        return obj;
    });
}

/**
 * 특정 종목의 히스토리 데이터 조회
 */
async function getHistoryData(sheetName, symbol, limit = 30) {
    const rows = await readSheet(sheetName);
    if (rows.length < 2) return [];

    const headers = rows[0];
    const dataRows = rows.slice(1)
        .filter(row => row[2] === symbol) // 종목코드 필터
        .slice(-limit);

    return dataRows.map(row => {
        const obj = {};
        headers.forEach((header, i) => {
            obj[header] = row[i] || '';
        });
        return obj;
    });
}

/**
 * 스프레드시트 초기 세팅 (시트 + 헤더 생성)
 */
async function setupSpreadsheet() {
    const sheets = await initSheets();
    if (!sheets) {
        console.log('ℹ️  Google Sheets 미연결 - 로컬 모드로 동작합니다.');
        return false;
    }

    await ensureSheet('해외주식', ['날짜', '시간', '종목코드', '종목명', '현재가(USD)', '변동률(%)', '거래량', '52주최고', '52주최저', '시가총액']);
    await ensureSheet('국내주식', ['날짜', '시간', '종목코드', '종목명', '현재가(KRW)', '변동률(%)', '거래량', '52주최고', '52주최저', '시가총액']);
    await ensureSheet('금_원자재', ['날짜', '시간', '종목코드', '종목명', '현재가(USD)', '변동률(%)', 'KRW환산가']);
    await ensureSheet('LLM분석', ['날짜', '종목코드', '종목명', '추천', '신뢰도(%)', '리스크', '분석근거', '목표가']);

    console.log('✅ 스프레드시트 초기 설정 완료');
    return true;
}

export default {
    initSheets,
    ensureSheet,
    appendRows,
    readSheet,
    getLatestData,
    getHistoryData,
    setupSpreadsheet
};
