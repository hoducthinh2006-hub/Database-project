const router = require('express').Router();
const pool = require('../config/db');
const { auth, adminOnly } = require('../middleware/auth');
const { fail } = require('../utils/http');

/* =====================================================================
 * BÁO CÁO — 15 truy vấn chính thức của nhóm (nguồn: sql/04_queries.sql).
 * Chỉ admin được chạy — trang "Báo cáo" trong bảng điều khiển quản trị
 * gọi trực tiếp các endpoint này để minh hoạ truy vấn chạy thật trên
 * dữ liệu thật, phục vụ bảo vệ đồ án.
 *
 * Tham số ngày/tháng mặc định về khoảng có dữ liệu mẫu (8-9/2026) nếu
 * người dùng chưa chọn, để bấm "Chạy truy vấn" lần đầu luôn có kết quả.
 * ===================================================================== */
router.use(auth, adminOnly);

async function run(res, sql, params) {
  try {
    const [rows] = await pool.query(sql, params || []);
    res.json(rows);
  } catch (e) {
    fail(res, e);
  }
}

// Tham số lọc lấy từ query string: chỉ nhận số/ngày hợp lệ, sai thì dùng mặc định (SQL vẫn luôn dùng dấu ? nên không có SQL injection)
const num = (v, d, lo, hi) => { const n = Number(v); return Number.isInteger(n) && n >= lo && n <= hi ? n : d; };
const day = (v, d) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : d);

// ───────────────────────── 🟦 TRÀ — khóa học / đăng ký / giảng viên ─────────────────────────

// 1 ⭐ Danh sách khóa học được đăng ký trong 1 tháng, sắp theo số lượt đăng ký giảm dần
router.get('/khoahoc-theo-thang', (req, res) => {
  const nam = num(req.query.nam, 2026, 2000, 2100), thang = num(req.query.thang, 8, 1, 12);
  run(res, `
    SELECT kh.MaKH, kh.TenKH, COUNT(dk.MaDK) AS SoLuotDangKy
    FROM   KHOA_HOC kh
    JOIN   DANG_KY dk ON dk.MaKH = kh.MaKH
    WHERE  YEAR(dk.NgayDangKy) = ? AND MONTH(dk.NgayDangKy) = ?
    GROUP BY kh.MaKH, kh.TenKH
    ORDER BY SoLuotDangKy DESC`, [nam, thang]);
});

// 2 ⭐ Tỷ lệ hoàn thành của các khóa học trong 1 khoảng thời gian
router.get('/ty-le-hoan-thanh', (req, res) => {
  const tuNgay = day(req.query.tuNgay, '2026-08-01'), denNgay = day(req.query.denNgay, '2026-09-30');
  run(res, `
    SELECT kh.MaKH, kh.TenKH,
           COUNT(dk.MaDK) AS TongLuotDangKy,
           SUM(CASE WHEN dk.TTDangKy = 'hoan_thanh' THEN 1 ELSE 0 END) AS SoLuotHoanThanh,
           ROUND(100.0 * SUM(CASE WHEN dk.TTDangKy = 'hoan_thanh' THEN 1 ELSE 0 END)
                 / COUNT(dk.MaDK), 1) AS TyLeHoanThanh
    FROM   KHOA_HOC kh
    JOIN   DANG_KY dk ON dk.MaKH = kh.MaKH
    WHERE  dk.NgayDangKy BETWEEN ? AND ?
    GROUP BY kh.MaKH, kh.TenKH
    ORDER BY TyLeHoanThanh DESC`, [tuNgay, denNgay]);
});

// 3. Khóa học có học phí cao hơn học phí trung bình toàn hệ thống
router.get('/hocphi-tren-tb', (req, res) => {
  run(res, `
    SELECT MaKH, TenKH, HocPhi
    FROM   KHOA_HOC
    WHERE  HocPhi > (SELECT AVG(HocPhi) FROM KHOA_HOC)
    ORDER BY HocPhi DESC`);
});

// 4. Giảng viên đang dạy từ 2 khóa học trở lên
router.get('/giangvien-da-khoa', (req, res) => {
  run(res, `
    SELECT gv.MaGV, gv.HoTen, COUNT(kh.MaKH) AS SoKhoaDay
    FROM   GIANG_VIEN gv
    JOIN   KHOA_HOC kh ON kh.MaGV = gv.MaGV
    GROUP BY gv.MaGV, gv.HoTen
    HAVING COUNT(kh.MaKH) >= 2`);
});

// 5 🔴 Điểm trung bình của mỗi học viên trong từng khóa học (điểm cao nhất mỗi bài KT)
router.get('/diem-tb-hocvien', (req, res) => {
  run(res, `
    SELECT dk.MaKH, hv.MaHV, hv.HoTen, dk.MaDK, vdt.DiemTrungBinh
    FROM   DANG_KY dk
    JOIN   HOC_VIEN hv   ON hv.MaHV = dk.MaHV
    JOIN   V_DIEM_TB vdt ON vdt.MaDK = dk.MaDK
    ORDER BY dk.MaKH, vdt.DiemTrungBinh DESC`);
});

// ───────────────────────── 🟩 LỘC — bài học / kiểm tra / tiến độ ─────────────────────────

// 6 ⭐ Thống kê số lượt đã hoàn thành / đang học / chưa hoàn thành theo khóa, trong khoảng thời gian
router.get('/thong-ke-tiendo', (req, res) => {
  const tuNgay = day(req.query.tuNgay, '2026-08-01'), denNgay = day(req.query.denNgay, '2026-09-30');
  run(res, `
    SELECT kh.MaKH, kh.TenKH,
           SUM(CASE WHEN dk.TTDangKy = 'hoan_thanh' THEN 1 ELSE 0 END) AS DaHoanThanh,
           SUM(CASE WHEN dk.TTDangKy = 'dang_hoc'   THEN 1 ELSE 0 END) AS DangHoc,
           SUM(CASE WHEN dk.TTDangKy NOT IN ('hoan_thanh','dang_hoc') THEN 1 ELSE 0 END) AS ChuaHoanThanh
    FROM   KHOA_HOC kh
    JOIN   DANG_KY dk ON dk.MaKH = kh.MaKH
    WHERE  dk.NgayDangKy BETWEEN ? AND ?
    GROUP BY kh.MaKH, kh.TenKH`, [tuNgay, denNgay]);
});

// 7. Bài học kèm tên khóa học + tên giảng viên phụ trách
router.get('/baihoc-chi-tiet', (req, res) => {
  run(res, `
    SELECT bh.MaBH, bh.TenBH, bh.ThuTu, kh.TenKH, gv.HoTen AS TenGiangVien
    FROM   BAI_HOC bh
    JOIN   KHOA_HOC kh   ON kh.MaKH = bh.MaKH
    JOIN   GIANG_VIEN gv ON gv.MaGV = kh.MaGV
    ORDER BY kh.TenKH, bh.ThuTu`);
});

// 8. Khóa học chưa có học viên nào đăng ký
router.get('/khoahoc-chua-dangky', (req, res) => {
  run(res, `
    SELECT kh.MaKH, kh.TenKH
    FROM   KHOA_HOC kh
    LEFT JOIN DANG_KY dk ON dk.MaKH = kh.MaKH
    WHERE  dk.MaDK IS NULL`);
});

// 9. Top 3 khóa học doanh thu cao nhất (chỉ tính giao dịch success)
router.get('/top-doanhthu', (req, res) => {
  run(res, `
    SELECT kh.MaKH, kh.TenKH, SUM(dk.HocPhi) AS DoanhThu
    FROM   KHOA_HOC kh
    JOIN   DANG_KY dk    ON dk.MaKH = kh.MaKH
    JOIN   THANH_TOAN tt ON tt.MaDK = dk.MaDK AND tt.TrangThaiTT = 'success'
    GROUP BY kh.MaKH, kh.TenKH
    ORDER BY DoanhThu DESC
    LIMIT 3`);
});

// 10 🔴 Xếp hạng học viên theo điểm trung bình trong từng khóa học (window function)
router.get('/xephang-hocvien', (req, res) => {
  run(res, `
    SELECT dk.MaKH, hv.HoTen, dk.MaDK, vdt.DiemTrungBinh,
           RANK() OVER (PARTITION BY dk.MaKH ORDER BY vdt.DiemTrungBinh DESC) AS XepHang
    FROM   DANG_KY dk
    JOIN   HOC_VIEN hv   ON hv.MaHV = dk.MaHV
    JOIN   V_DIEM_TB vdt ON vdt.MaDK = dk.MaDK
    ORDER BY dk.MaKH, XepHang`);
});

// ───────────────────────── 🟧 THỊNH — học viên / thanh toán / chứng chỉ / đánh giá ─────────────────────────

// 11 ⭐ Doanh thu hệ thống trong 1 tháng (chỉ giao dịch success, loại thanh_toan)
router.get('/doanhthu-theo-thang', (req, res) => {
  const nam = num(req.query.nam, 2026, 2000, 2100), thang = num(req.query.thang, 8, 1, 12);
  run(res, `
    SELECT DATE_FORMAT(tt.ThoiGian, '%Y-%m') AS Thang,
           SUM(dk.HocPhi) AS DoanhThu
    FROM   THANH_TOAN tt
    JOIN   DANG_KY dk ON dk.MaDK = tt.MaDK
    WHERE  tt.TrangThaiTT  = 'success'
      AND  tt.LoaiGiaoDich = 'thanh_toan'
      AND  YEAR(tt.ThoiGian) = ? AND MONTH(tt.ThoiGian) = ?
    GROUP BY DATE_FORMAT(tt.ThoiGian, '%Y-%m')`, [nam, thang]);
});

// 12 ⭐ Đánh giá / nhận xét của học viên theo từng khóa học, trong khoảng thời gian
router.get('/danhgia-theo-khoang', (req, res) => {
  const tuNgay = day(req.query.tuNgay, '2026-08-01'), denNgay = day(req.query.denNgay, '2026-09-30');
  run(res, `
    SELECT kh.MaKH, kh.TenKH, hv.HoTen, dg.DiemDanhGia, dg.NhanXet, dg.NgayDG
    FROM   DANH_GIA dg
    JOIN   DANG_KY dk  ON dk.MaDK = dg.MaDK
    JOIN   KHOA_HOC kh ON kh.MaKH = dk.MaKH
    JOIN   HOC_VIEN hv ON hv.MaHV = dk.MaHV
    WHERE  dg.NgayDG BETWEEN ? AND ?
    ORDER BY kh.MaKH, dg.NgayDG`, [tuNgay, denNgay]);
});

// 13. Tỷ lệ học viên có chứng chỉ trên mỗi khóa học
router.get('/ty-le-chungchi', (req, res) => {
  run(res, `
    SELECT kh.MaKH, kh.TenKH,
           COUNT(DISTINCT dk.MaDK) AS TongLuotDangKy,
           COUNT(DISTINCT cc.MaDK) AS SoChungChi,
           ROUND(100.0 * COUNT(DISTINCT cc.MaDK) / COUNT(DISTINCT dk.MaDK), 1) AS TyLeCoChungChi
    FROM   KHOA_HOC kh
    JOIN   DANG_KY dk ON dk.MaKH = kh.MaKH
    LEFT JOIN CHUNG_CHI cc ON cc.MaDK = dk.MaDK
    GROUP BY kh.MaKH, kh.TenKH`);
});

// 14. Học viên chưa từng thanh toán thành công lần nào
router.get('/hocvien-chua-thanhtoan', (req, res) => {
  run(res, `
    SELECT hv.MaHV, hv.HoTen, hv.Email
    FROM   HOC_VIEN hv
    WHERE  hv.MaHV NOT IN (
      SELECT dk.MaHV
      FROM   DANG_KY dk
      JOIN   THANH_TOAN tt ON tt.MaDK = dk.MaDK
      WHERE  tt.TrangThaiTT = 'success'
    )`);
});

// 15. Gộp danh sách email của giảng viên và học viên thành 1 danh sách (UNION)
router.get('/email-gop', (req, res) => {
  run(res, `
    SELECT MaGV AS Ma, HoTen, Email, 'giang_vien' AS VaiTro FROM GIANG_VIEN
    UNION
    SELECT MaHV AS Ma, HoTen, Email, 'hoc_vien'   AS VaiTro FROM HOC_VIEN
    ORDER BY VaiTro, HoTen`);
});

module.exports = router;
