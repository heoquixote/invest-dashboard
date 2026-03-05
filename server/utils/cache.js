/**
 * 인메모리 캐시 유틸리티
 * TTL 기반 캐시로 API 호출 횟수 제한
 */
class Cache {
    constructor(defaultTTL = 15 * 60 * 1000) {
        this.store = new Map();
        this.defaultTTL = defaultTTL;
    }

    get(key) {
        const item = this.store.get(key);
        if (!item) return null;
        if (Date.now() > item.expiry) {
            this.store.delete(key);
            return null;
        }
        return item.value;
    }

    set(key, value, ttl = this.defaultTTL) {
        this.store.set(key, {
            value,
            expiry: Date.now() + ttl
        });
    }

    clear() {
        this.store.clear();
    }

    has(key) {
        return this.get(key) !== null;
    }
}

export default new Cache();
