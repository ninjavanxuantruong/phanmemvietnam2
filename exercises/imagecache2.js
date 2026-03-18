// ===== imagecache2.js - Quản lý ảnh cho Flashcard =====

// Cấu hình các nguồn ảnh
const IMAGE_SOURCES = {
  // Ưu tiên 1: Unsplash (cần API key)
  unsplash: {
    enabled: true,
    name: 'Unsplash',
    apiKey: 'HGRWhYHSw1G8VOEEEYlknJC-yOkANe3I3eS3NSt_SSg', // Thay bằng key của bạn
    baseUrl: 'https://api.unsplash.com/search/photos',
    async fetch(keyword) {
      const url = `${this.baseUrl}?query=${encodeURIComponent(keyword)}&per_page=5&orientation=squarish&content_filter=high`;
      try {
        const res = await fetch(url, {
          headers: { 'Authorization': `Client-ID ${this.apiKey}` }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          const random = Math.floor(Math.random() * data.results.length);
          return {
            url: data.results[random].urls.regular,
            source: this.name,
            credit: data.results[random].user.name,
            link: data.results[random].links.html
          };
        }
      } catch (e) {
        console.warn(`⚠️ Unsplash error:`, e);
      }
      return null;
    }
  },

  // Ưu tiên 2: DiceBear Avatars (miễn phí, không cần key)
  dicebear: {
    enabled: true,
    name: 'DiceBear',
    baseUrl: 'https://api.dicebear.com/7.x',
    styles: ['adventurer', 'avataaars', 'bottts', 'fun-emoji', 'icons', 'pixel-art'],
    async fetch(keyword) {
      const seed = keyword.toLowerCase().replace(/[^a-z0-9]/g, '') || 'default';
      const style = this.styles[Math.floor(Math.random() * this.styles.length)];
      const colors = ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf', 'c9f4aa'];
      const bgColor = colors[Math.floor(Math.random() * colors.length)];

      return {
        url: `${this.baseUrl}/${style}/svg?seed=${seed}&backgroundColor=${bgColor}&size=300`,
        source: this.name,
        type: 'svg'
      };
    }
  },

  // Ưu tiên 3: Robohash (miễn phí, không cần key)
  robohash: {
    enabled: true,
    name: 'Robohash',
    baseUrl: 'https://robohash.org',
    sets: ['set1', 'set2', 'set3', 'set4'],
    async fetch(keyword) {
      const set = this.sets[Math.floor(Math.random() * this.sets.length)];
      return {
        url: `${this.baseUrl}/${encodeURIComponent(keyword)}.png?size=300x300&set=${set}`,
        source: this.name
      };
    }
  },

  // Ưu tiên 4: Lorem Picsum (miễn phí, ảnh phong cảnh)
  picsum: {
    enabled: true,
    name: 'Picsum',
    baseUrl: 'https://picsum.photos',
    async fetch(keyword) {
      // Tạo seed từ keyword để ảnh nhất quán
      const seed = keyword.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
      const imageId = Math.abs(seed) % 200 + 1; // ảnh từ 1-200

      return {
        url: `${this.baseUrl}/id/${imageId}/300/300`,
        source: this.name
      };
    }
  },

  // Fallback cuối: PlaceKitten (ảnh mèo dễ thương)
  placekitten: {
    enabled: true,
    name: 'PlaceKitten',
    baseUrl: 'https://placekitten.com',
    async fetch(keyword) {
      // Tạo kích thước dựa trên keyword
      const seed = Math.abs(keyword.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0));
      const width = 300 + (seed % 100);
      const height = 300 + ((seed >> 4) % 100);
      const imageId = seed % 16;

      return {
        url: `${this.baseUrl}/${width}/${height}?image=${imageId}`,
        source: this.name
      };
    }
  }
};

// ===== Image Cache Manager =====
class ImageCacheManager {
  constructor() {
    this.cache = new Map(); // word -> { url, source, timestamp }
    this.maxCacheSize = 100; // Giới hạn cache
    this.cacheTime = 24 * 60 * 60 * 1000; // 24 giờ
    this.pendingPromises = new Map(); // Tránh fetch trùng lặp
  }

  // Lấy ảnh cho từ khóa
  async getImage(keyword) {
    if (!keyword) return null;

    // Kiểm tra cache
    const cached = this.cache.get(keyword);
    if (cached) {
      // Kiểm tra cache còn hạn không
      if (Date.now() - cached.timestamp < this.cacheTime) {
        console.log(`📦 Dùng cache cho: ${keyword} (${cached.source})`);
        return cached;
      } else {
        this.cache.delete(keyword); // Xóa cache hết hạn
      }
    }

    // Kiểm tra xem có promise đang pending không
    if (this.pendingPromises.has(keyword)) {
      return this.pendingPromises.get(keyword);
    }

    // Tạo promise mới
    const promise = this.fetchImageWithFallback(keyword);
    this.pendingPromises.set(keyword, promise);

    try {
      const result = await promise;
      this.pendingPromises.delete(keyword);

      if (result) {
        // Thêm vào cache
        result.timestamp = Date.now();
        this.cache.set(keyword, result);

        // Giới hạn kích thước cache
        if (this.cache.size > this.maxCacheSize) {
          const oldestKey = this.cache.keys().next().value;
          this.cache.delete(oldestKey);
        }
      }

      return result;
    } catch (e) {
      this.pendingPromises.delete(keyword);
      throw e;
    }
  }

  // Fetch ảnh với cơ chế fallback
  async fetchImageWithFallback(keyword) {
    console.log(`🔍 Tìm ảnh cho: ${keyword}`);

    // Lấy danh sách nguồn đã bật
    const enabledSources = Object.entries(IMAGE_SOURCES)
      .filter(([_, source]) => source.enabled)
      .map(([key, source]) => ({ key, ...source }));

    // Thử lần lượt từng nguồn
    for (const source of enabledSources) {
      try {
        console.log(`📸 Thử nguồn: ${source.name}`);
        const result = await source.fetch(keyword);

        if (result) {
          console.log(`✅ Thành công từ ${source.name}`);
          return {
            ...result,
            source: source.name,
            keyword: keyword
          };
        }
      } catch (e) {
        console.warn(`⚠️ ${source.name} lỗi:`, e.message);
      }
    }

    // Nếu tất cả đều lỗi, tạo ảnh SVG fallback
    console.log(`⚠️ Tất cả nguồn đều lỗi, dùng fallback cho: ${keyword}`);
    return this.createFallbackImage(keyword);
  }

  // Tạo ảnh SVG fallback
  createFallbackImage(word) {
    const firstChar = word.charAt(0).toUpperCase();
    // Tạo màu dựa trên từ
    const hue = (word.length * 30) % 360;
    const bgColor = `hsl(${hue}, 70%, 85%)`;
    const textColor = `hsl(${hue}, 70%, 30%)`;

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 100 100">
        <rect width="100" height="100" fill="${bgColor}" />
        <text x="50" y="55" font-size="40" text-anchor="middle" fill="${textColor}" 
              font-family="Arial, sans-serif" font-weight="bold">${firstChar}</text>
        <text x="50" y="80" font-size="12" text-anchor="middle" fill="${textColor}" 
              font-family="Arial, sans-serif">${word}</text>
      </svg>
    `;

    // Chuyển SVG thành data URL
    const encodedSvg = encodeURIComponent(svg)
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29');

    return {
      url: `data:image/svg+xml,${encodedSvg}`,
      source: 'Fallback',
      type: 'svg',
      keyword: word
    };
  }

  // Prefetch nhiều ảnh cùng lúc
  async prefetchImages(words, options = {}) {
    const { concurrency = 3, onProgress = null } = options;
    const results = [];
    const chunks = this.chunkArray(words, concurrency);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const promises = chunk.map(word => 
        this.getImage(word).catch(e => {
          console.warn(`❌ Lỗi prefetch ${word}:`, e);
          return null;
        })
      );

      const chunkResults = await Promise.all(promises);
      results.push(...chunkResults);

      if (onProgress) {
        onProgress((i + 1) * concurrency, words.length);
      }

      // Delay giữa các chunk
      if (i < chunks.length - 1) {
        await this.delay(500);
      }
    }

    return results;
  }

  // Utility: chia mảng thành các phần nhỏ
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // Utility: delay
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Xóa cache
  clearCache() {
    this.cache.clear();
    this.pendingPromises.clear();
    console.log('🧹 Đã xóa cache ảnh');
  }

  // Lấy thống kê cache
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      pending: this.pendingPromises.size,
      items: Array.from(this.cache.entries()).map(([key, value]) => ({
        word: key,
        source: value.source,
        timestamp: new Date(value.timestamp).toLocaleString()
      }))
    };
  }
}

// ===== Tạo instance global =====
const imageCache = new ImageCacheManager();

// Export cho các file khác sử dụng
if (typeof module !== 'undefined' && module.exports) {
  module.exports = imageCache;
}
