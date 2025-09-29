// imageCache.js
const PROXY_BASE = "https://pexels-proxy.onrender.com";

// Key lưu cache trong localStorage
const IMAGE_MAP_CACHE_KEY = "pexels_image_map";
const IMAGE_MAP_CACHE_TIME = "pexels_image_map_time";

// TTL cho cache (6 giờ)
const TTL_MS = 6 * 60 * 60 * 1000;

let imageMap = {};

// ===== Load cache từ localStorage =====
function loadImageMapCache() {
  const cached = localStorage.getItem(IMAGE_MAP_CACHE_KEY);
  const cachedTime = parseInt(localStorage.getItem(IMAGE_MAP_CACHE_TIME) || "0");

  // Nếu chưa có cache hoặc cache đã hết hạn → bỏ qua
  if (!cached || Date.now() - cachedTime > TTL_MS) return;

  try {
    const parsed = JSON.parse(cached);
    if (parsed && typeof parsed === "object") {
      imageMap = parsed;
    }
  } catch {
    console.warn("❌ Lỗi khi parse cache ảnh");
  }
}

// ===== Lưu cache vào localStorage =====
function saveImageMapCache() {
  try {
    localStorage.setItem(IMAGE_MAP_CACHE_KEY, JSON.stringify(imageMap));
    localStorage.setItem(IMAGE_MAP_CACHE_TIME, Date.now().toString());
  } catch {
    console.warn("❌ Không thể lưu cache ảnh");
  }
}

// ===== Prefetch ảnh cho các từ khóa còn thiếu =====
async function prefetchImagesBatch(keywords) {
  loadImageMapCache();

  // Lọc ra các từ khóa chưa có trong cache
  const missing = keywords.filter(k => !imageMap[k]);
  if (missing.length === 0) return;

  const CHUNK_SIZE = 150; // chia nhỏ request nếu quá dài
  for (let i = 0; i < missing.length; i += CHUNK_SIZE) {
    const chunk = missing.slice(i, i + CHUNK_SIZE);
    const qs = encodeURIComponent(chunk.join(","));
    const url = `${PROXY_BASE}/api/pexels/batch?keywords=${qs}`;

    try {
      const resp = await fetch(url);
      const data = await resp.json();
      if (data?.images && typeof data.images === "object") {
        imageMap = { ...imageMap, ...data.images };
        saveImageMapCache();
      }
    } catch (e) {
      console.warn("⚠️ Batch fetch failed:", e);
    }
  }
}

// ===== Lấy ảnh từ cache =====
function getImageFromMap(keyword) {
  const k = (keyword || "").toLowerCase();
  // Nếu không có ảnh → fallback online
  return imageMap[k] || "https://via.placeholder.com/400x300?text=No+Image";
}

export { prefetchImagesBatch, getImageFromMap };
