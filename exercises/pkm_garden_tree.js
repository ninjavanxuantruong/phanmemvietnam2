/**
 * ==========================================
 * PKM GARDEN — BẢNG THÔNG SỐ (công cụ, cây trồng, vật nuôi, mốc mở khoá)
 * ==========================================
 * File này CHỈ chứa số liệu / cấu hình, không có logic game.
 * Muốn chỉnh giá, thời gian chín, phần thưởng, tên Pokémon nuôi... chỉ cần
 * sửa ở đây, không cần đụng vào pkm_garden.js.
 *
 * QUY ƯỚC ĐƠN VỊ TIỀN TỆ (giống hệt pkm_score.js):
 *   - DV  = Danh Vọng  (localStorage "pkm_global_dv")  -> dùng MUA HẠT GIỐNG / CON GIỐNG
 *   - EXP = Kinh Nghiệm (localStorage "pkm_global_exp") -> dùng MUA CÔNG CỤ (kho đồ)
 * ==========================================
 */

window.GardenConfig = {
    // ── Firebase (dùng chung DB "lop-hoc-thay-tinh" — giống pkm_map.js /
    // pkm_sync_score.js — để đọc lịch học hôm nay + sheet từ vựng) ──
    LESSON_FIREBASE_CONFIG: {
        apiKey: "AIzaSyBQ1pPmSdBV8M8YdVbpKhw_DOetmzIMwXU",
        authDomain: "lop-hoc-thay-tinh.firebaseapp.com",
        projectId: "lop-hoc-thay-tinh",
        storageBucket: "lop-hoc-thay-tinh.firebasestorage.app",
        messagingSenderId: "391812475288",
        appId: "1:391812475288:web:ca4c275ac776d69deb23ed",
    },

    // Sprite Pokémon động (gif) — dùng chung nguồn với pkm.html
    POKEMON_ANI_URL: (name) =>
        `https://play.pokemonshowdown.com/sprites/ani/${name}.gif`,

    // ── Thời gian ──
    WILT_GRACE_MS: 24 * 60 * 60 * 1000, // chín xong để quá 24h không hái -> héo rũ, mất trắng

    // ── 4 CÔNG CỤ TRONG KHO ĐỒ (mua theo số lượng bằng EXP, dùng dần) ──
    // use: 'plant_care'  -> tưới/bón cho cây (được phép dùng 1 trong 2 loại)
    //      'harvest'     -> cắt thu hoạch CÂY (liềm)
    //      'animal_care' -> tắm rửa cho Pokémon nuôi
    TOOLS: {
        water: { id: "water", name: "Chai Nước", emoji: "💧", costEXP: 1, use: "plant_care" },
        fertilizer: { id: "fertilizer", name: "Phân Bón", emoji: "🌿", costEXP: 1, use: "plant_care" },
        sickle: { id: "sickle", name: "Liềm Cắt", emoji: "🔪", costEXP: 1, use: "harvest" },
        brush: { id: "brush", name: "Chà Tắm", emoji: "🧽", costEXP: 1, use: "animal_care" },
    },

    // ── Mốc mở khoá đất / chuồng theo SỐ BÀI ĐÃ HỌC (pkm_passed_maps.length) ──
    // index 0 = mảnh/chuồng số 1, LUÔN mở sẵn miễn phí (threshold 0).
    // 10 bài -> mảnh 2 · 25 bài -> mảnh 3 · 40 bài -> mảnh 4 · sau đó cứ +15 bài mở thêm 1.
    UNLOCK_THRESHOLDS: [0, 10, 25, 40, 55, 70, 85, 100, 115, 130],

    // ── 5 LOẠI CÂY (chín theo NGÀY THỰC, tính bằng giờ = days*24h) ──
    PLANT_TIERS: [
        { id: "p1", name: "Cỏ Cơ Bản", emoji: "🌱", growEmoji: "🌾", days: 1, seedCostDV: 1, harvestDV: 1.5, harvestEXP: 1.5 },
        { id: "p2", name: "Hoa Oran", emoji: "🌸", growEmoji: "🌷", days: 2, seedCostDV: 2, harvestDV: 3.1, harvestEXP: 3.1 },
        { id: "p3", name: "Berry Chesto", emoji: "🍒", growEmoji: "🍓", days: 3, seedCostDV: 3, harvestDV: 4.8, harvestEXP: 4.8 },
        { id: "p4", name: "Nấm Tinh Linh", emoji: "🍄", growEmoji: "🍄", days: 4, seedCostDV: 4, harvestDV: 6.6, harvestEXP: 6.6 },
        { id: "p5", name: "Cây Thần Kỳ", emoji: "🌳", growEmoji: "🌳", days: 5, seedCostDV: 5, harvestDV: 8.5, harvestEXP: 8.5 },
    ],

    // ── 5 LOẠI POKÉMON NUÔI (nuôi lâu hơn cây, nhưng lãi cao hơn) ──
    // "pokemon" = tên sprite trên play.pokemonshowdown.com/sprites/ani/
    ANIMAL_TIERS: [
        { id: "a1", name: "Gà Con", pokemon: "torchic", days: 2, priceDV: 2, harvestDV: 3.2, harvestEXP: 3.2 },
        { id: "a2", name: "Cừu Non", pokemon: "mareep", days: 4, priceDV: 4, harvestDV: 6.6, harvestEXP: 6.6 },
        { id: "a3", name: "Bò Sữa", pokemon: "miltank", days: 6, priceDV: 6, harvestDV: 10.2, harvestEXP: 10.2 },
        { id: "a4", name: "Ngựa Vằn", pokemon: "ponyta", days: 8, priceDV: 8, harvestDV: 14, harvestEXP: 14 },
        { id: "a5", name: "Rồng Con", pokemon: "dratini", days: 10, priceDV: 10, harvestDV: 18, harvestEXP: 18 },
    ],
};

/**
 * GHI CHÚ THIẾT KẾ (đọc nếu muốn chỉnh luật chơi):
 *
 * 1) CHĂM SÓC CÂY: dùng 💧 Chai Nước HOẶC 🌿 Phân Bón (1 trong 2, tuỳ chọn)
 *    -> mở câu hỏi từ vựng "bài hôm nay", trả lời sai không bị phạt.
 * 2) THU HOẠCH CÂY: bắt buộc cầm 🔪 Liềm Cắt mới cắt được (tốn 1 liềm).
 * 3) CHĂM SÓC POKÉMON NUÔI: dùng 🧽 Chà Tắm -> cũng mở câu hỏi từ vựng.
 * 4) THU HOẠCH POKÉMON NUÔI (thu sản phẩm): KHÔNG cần công cụ, chạm trực
 *    tiếp vào Pokémon khi đã đủ ngày là thu được luôn (không hợp lý khi
 *    dùng "liềm cắt" lên vật nuôi). Nếu bạn muốn thêm công cụ riêng cho
 *    bước này (VD giỏ đựng), báo mình thêm sau.
 * 5) Phải Chăm sóc ÍT NHẤT 1 LẦN trong suốt thời gian nuôi trồng thì mới
 *    được phép Thu hoạch (ràng buộc nhẹ, không bắt buộc đúng mỗi ngày).
 * 6) Héo rũ: kể từ lúc CHÍN mà để quá WILT_GRACE_MS (24h) không thu hoạch
 *    thì mất trắng.
 */