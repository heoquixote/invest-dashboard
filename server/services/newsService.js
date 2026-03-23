const NEWS_CATEGORIES = [
    {
        id: 'sp500',
        name: 'S&P 500',
        query: '"S&P 500" OR "미국 증시" OR "월가"'
    },
    {
        id: 'korean',
        name: '국내주식',
        query: '코스피 OR 코스닥 OR 국내증시 OR 한국 증시'
    },
    {
        id: 'overseas',
        name: '해외주식',
        query: '나스닥 OR 다우지수 OR 미국주식 OR 해외주식'
    },
    {
        id: 'gold',
        name: '금',
        query: '"금 가격" OR "국제 금값" OR 금현물 OR gold price'
    },
    {
        id: 'crypto',
        name: '코인',
        query: '비트코인 OR 이더리움 OR 암호화폐 OR 가상자산 OR crypto'
    }
];

function decodeXmlEntities(text = '') {
    return text
        .replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
}

function stripTags(text = '') {
    return decodeXmlEntities(text.replace(/<[^>]*>/g, ' '));
}

function buildGoogleNewsRssUrl(query) {
    const encoded = encodeURIComponent(query);
    return `https://news.google.com/rss/search?q=${encoded}&hl=ko&gl=KR&ceid=KR:ko`;
}

function getTagValue(item, tagName) {
    const match = item.match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'i'));
    return match ? match[1].trim() : '';
}

function getSource(item) {
    const sourceMatch = item.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
    if (sourceMatch) return stripTags(sourceMatch[1]);

    const title = stripTags(getTagValue(item, 'title'));
    const parts = title.split(' - ');
    return parts.length > 1 ? parts.at(-1) : 'Google News';
}

function summarizeTitle(title) {
    const cleaned = title.replace(/\s-\s[^-]+$/, '').trim();
    if (cleaned.length <= 90) return cleaned;
    return `${cleaned.slice(0, 87)}...`;
}

function parseRssItems(xml, category) {
    const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/gi) || [];

    return itemMatches.slice(0, 12).map(item => {
        const rawTitle = stripTags(getTagValue(item, 'title'));
        const title = rawTitle.replace(/\s-\s[^-]+$/, '').trim() || rawTitle;
        const link = decodeXmlEntities(getTagValue(item, 'link'));
        const pubDate = getTagValue(item, 'pubDate');
        const source = getSource(item);

        return {
            category: category.id,
            categoryName: category.name,
            title,
            link,
            source,
            publishedAt: pubDate ? new Date(pubDate).toISOString() : null,
            summary: summarizeTitle(title)
        };
    });
}

async function fetchCategoryNews(category) {
    const url = buildGoogleNewsRssUrl(category.query);
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const xml = await response.text();
    return parseRssItems(xml, category);
}

async function collectMarketNews() {
    console.log('🗞️ 시장 뉴스 수집 중...');

    const settled = await Promise.allSettled(
        NEWS_CATEGORIES.map(async category => ({
            category,
            items: await fetchCategoryNews(category)
        }))
    );

    const newsByCategory = {};

    settled.forEach(result => {
        if (result.status === 'fulfilled') {
            newsByCategory[result.value.category.id] = result.value.items;
            console.log(`✅ ${result.value.category.name} 뉴스 ${result.value.items.length}건 수집 완료`);
        } else {
            const failedCategory = NEWS_CATEGORIES[settled.indexOf(result)];
            newsByCategory[failedCategory.id] = [];
            console.error(`❌ ${failedCategory.name} 뉴스 수집 실패:`, result.reason?.message || result.reason);
        }
    });

    return {
        updatedAt: new Date().toISOString(),
        categories: NEWS_CATEGORIES,
        items: newsByCategory
    };
}

export default {
    NEWS_CATEGORIES,
    collectMarketNews
};
