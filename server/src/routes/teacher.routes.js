const router = require('express').Router();
const pool = require('../config/db');
const { auth, teacherOnly } = require('../middleware/auth');
const { forbidden, fail } = require('../utils/http');
const v = require('../utils/validate');

router.use(auth, teacherOnly);

// Doanh thu chỉ tính giao dịch THANH TOÁN thành công (không tính hoàn tiền / thất bại / đang chờ) — cùng định nghĩa với báo cáo #11 của nhóm
const PAID = `tt.TrangThaiTT = 'success' AND tt.LoaiGiaoDich = 'thanh_toan'`;

// ─────────────────────────────────────────────
// GET /api/teacher/overview — dashboard tổng quan cho giảng viên đang đăng nhập
// ─────────────────────────────────────────────
router.get('/overview', async (req, res) => {
  try {
    const maGV = req.user.ma;
    const [[tong]] = await pool.query(`
      SELECT COUNT(DISTINCT kh.MaKH) AS SoKhoaHoc,
             COUNT(DISTINCT CASE WHEN dk.TTDangKy <> 'da_huy' THEN dk.MaHV END) AS SoHocVien,
             COUNT(DISTINCT dk.MaDK) AS SoLuotDangKy
      FROM KHOA_HOC kh
      LEFT JOIN DANG_KY dk ON dk.MaKH = kh.MaKH
      WHERE kh.MaGV = ?`, [maGV]);

    const [[doanhThu]] = await pool.query(`
      SELECT COALESCE(SUM(dk.HocPhi),0) AS TongDoanhThu
      FROM KHOA_HOC kh
      JOIN DANG_KY dk ON dk.MaKH = kh.MaKH
      JOIN THANH_TOAN tt ON tt.MaDK = dk.MaDK AND ${PAID}
      WHERE kh.MaGV = ?`, [maGV]);

    const [doanhThu6Thang] = await pool.query(`
      SELECT DATE_FORMAT(tt.ThoiGian,'%Y-%m') AS Thang, SUM(dk.HocPhi) AS DoanhThu
      FROM KHOA_HOC kh
      JOIN DANG_KY dk ON dk.MaKH = kh.MaKH
      JOIN THANH_TOAN tt ON tt.MaDK = dk.MaDK AND ${PAID}
      WHERE kh.MaGV = ? AND tt.ThoiGian >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY Thang ORDER BY Thang`, [maGV]);

    const [[danhGia]] = await pool.query(`
      SELECT ROUND(AVG(dg.DiemDanhGia),1) AS DiemTB, COUNT(*) AS SoDanhGia
      FROM DANH_GIA dg JOIN DANG_KY dk ON dk.MaDK = dg.MaDK
      JOIN KHOA_HOC kh ON kh.MaKH = dk.MaKH WHERE kh.MaGV = ?`, [maGV]);

    // doanh thu theo từng khóa — để vẽ bảng xếp hạng khóa của riêng GV này
    const [theoKhoa] = await pool.query(`
      SELECT kh.MaKH, kh.TenKH, kh.TrangThai,
             COUNT(DISTINCT dk.MaDK) AS SoLuotDangKy,
             COALESCE(SUM(CASE WHEN ${PAID} THEN dk.HocPhi END),0) AS DoanhThu
      FROM KHOA_HOC kh
      LEFT JOIN DANG_KY dk ON dk.MaKH = kh.MaKH
      LEFT JOIN THANH_TOAN tt ON tt.MaDK = dk.MaDK
      WHERE kh.MaGV = ?
      GROUP BY kh.MaKH, kh.TenKH, kh.TrangThai
      ORDER BY DoanhThu DESC`, [maGV]);

    res.json({ ...tong, ...doanhThu, doanhThu6Thang, ...danhGia, theoKhoa });
  } catch (e) { fail(res, e); }
});

// ─────────────────────────────────────────────
// GET /api/teacher/courses/:id/students — học viên của 1 khóa (chỉ chủ khóa học)
// ─────────────────────────────────────────────
router.get('/courses/:id/students', async (req, res) => {
  try {
    const maKH = v.code(req.params.id, 'Mã khóa học');
    const [[own]] = await pool.query('SELECT MaGV FROM KHOA_HOC WHERE MaKH=?', [maKH]);
    if (!own || own.MaGV !== req.user.ma) throw forbidden('Bạn không có quyền xem khóa học này');

    const [[tongBai]] = await pool.query('SELECT COUNT(*) AS n FROM BAI_HOC WHERE MaKH=?', [maKH]);
    const total = tongBai.n || 0;

    const [rows] = await pool.query(`
      SELECT dk.MaDK, hv.MaHV, hv.HoTen, hv.Email, dk.NgayDangKy, dk.TTDangKy,
             COUNT(DISTINCT CASE WHEN ls.TrangThaiHoanThanh='hoan_thanh' THEN ls.MaBH END) AS SoBaiHoanThanh,
             (SELECT ROUND(AVG(best.Diem),1) FROM (
                SELECT MAX(DiemSo) AS Diem FROM KET_QUA WHERE MaDK=dk.MaDK GROUP BY MaBKT
              ) best) AS DiemTB,
             EXISTS(SELECT 1 FROM THANH_TOAN tt WHERE tt.MaDK=dk.MaDK AND tt.TrangThaiTT='success') AS DaThanhToan
      FROM DANG_KY dk
      JOIN HOC_VIEN hv ON hv.MaHV = dk.MaHV
      LEFT JOIN LICH_SU_HOC_TAP ls ON ls.MaDK = dk.MaDK
      WHERE dk.MaKH = ?
      GROUP BY dk.MaDK, hv.MaHV, hv.HoTen, hv.Email, dk.NgayDangKy, dk.TTDangKy
      ORDER BY dk.NgayDangKy DESC`, [maKH]);

    const list = rows.map(r => ({
      ...r,
      DaThanhToan: !!r.DaThanhToan,
      TienDoPhanTram: total ? Math.round((r.SoBaiHoanThanh / total) * 1000) / 10 : 0,
    }));
    res.json({ tongSoBai: total, hocVien: list });
  } catch (e) { fail(res, e); }
});

// ─────────────────────────────────────────────
// GET /api/teacher/reviews — toàn bộ đánh giá của học viên trên các khóa của GV
// ─────────────────────────────────────────────
router.get('/reviews', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT dg.MaDG, kh.MaKH, kh.TenKH, hv.HoTen, dg.DiemDanhGia, dg.NhanXet, dg.NgayDG
      FROM DANH_GIA dg
      JOIN DANG_KY dk ON dk.MaDK = dg.MaDK
      JOIN KHOA_HOC kh ON kh.MaKH = dk.MaKH
      JOIN HOC_VIEN hv ON hv.MaHV = dk.MaHV
      WHERE kh.MaGV = ?
      ORDER BY dg.NgayDG DESC`, [req.user.ma]);
    res.json(rows);
  } catch (e) { fail(res, e); }
});

module.exports = router;
