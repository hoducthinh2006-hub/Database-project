const router = require('express').Router();
const pool = require('../config/db');
const { auth, adminOnly, invalidateAccount } = require('../middleware/auth');
const { insertWithCode } = require('../utils/id');
const { withTx } = require('../utils/tx');
const { notFound, conflict, fail } = require('../utils/http');
const v = require('../utils/validate');
const pw = require('../utils/password');

router.use(auth, adminOnly);

// Ghi nhật ký các thao tác nhạy cảm của quản trị viên (ra console của server — xem được bằng log của hosting)
const audit = (req, msg) => console.info(`[N9][audit] admin ${req.user.ma}: ${msg}`);
// Doanh thu RÒNG = tổng giao dịch 'thanh_toan' thành công TRỪ tổng 'hoan_tien' thành công — cùng định nghĩa với báo cáo #11 của nhóm.
// Dùng tt.SoTien (không dùng dk.HocPhi) vì 1 khoản hoàn tiền có thể khác học phí gốc.
const PAID = `tt.TrangThaiTT = 'success' AND tt.LoaiGiaoDich = 'thanh_toan'`; // 1 giao dịch MUA thành công (lọc theo JOIN, không cộng tiền)
const NET_SOTIEN = `CASE WHEN tt.TrangThaiTT = 'success' AND tt.LoaiGiaoDich = 'thanh_toan' THEN tt.SoTien
                         WHEN tt.TrangThaiTT = 'success' AND tt.LoaiGiaoDich = 'hoan_tien'  THEN -tt.SoTien
                         ELSE 0 END`;

// ─────────────────────────────────────────────
// GET /api/admin/overview — số liệu tổng quan cho dashboard
// (đúng tinh thần các câu truy vấn báo cáo #1, #9, #11 trong 04_queries.sql)
// ─────────────────────────────────────────────
router.get('/overview', async (req, res) => {
  try {
    const [[tong]] = await pool.query(`SELECT
      (SELECT COUNT(*) FROM HOC_VIEN)   AS SoHocVien,
      (SELECT COUNT(*) FROM GIANG_VIEN) AS SoGiangVien,
      (SELECT COUNT(*) FROM KHOA_HOC)   AS SoKhoaHoc,
      (SELECT COUNT(*) FROM KHOA_HOC WHERE TrangThai='published') AS SoKhoaHocCongKhai,
      (SELECT COUNT(*) FROM DANG_KY)    AS SoDangKy`);

    // Doanh thu ròng 6 tháng gần nhất (trừ hoàn tiền) — câu #11
    const [doanhThu6Thang] = await pool.query(`
      SELECT DATE_FORMAT(tt.ThoiGian,'%Y-%m') AS Thang, SUM(${NET_SOTIEN}) AS DoanhThu
      FROM THANH_TOAN tt
      WHERE tt.TrangThaiTT = 'success'
        AND tt.ThoiGian >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY Thang ORDER BY Thang`);

    const [[thangNay]] = await pool.query(`
      SELECT COALESCE(SUM(${NET_SOTIEN}),0) AS DoanhThuThangNay
      FROM THANH_TOAN tt
      WHERE tt.TrangThaiTT = 'success'
        AND YEAR(tt.ThoiGian)=YEAR(CURDATE()) AND MONTH(tt.ThoiGian)=MONTH(CURDATE())`);

    // Top 5 khóa doanh thu ròng cao nhất — câu #9
    const [topKhoaHoc] = await pool.query(`
      SELECT kh.MaKH, kh.TenKH, gv.HoTen AS TenGV, SUM(${NET_SOTIEN}) AS DoanhThu, COUNT(DISTINCT dk.MaDK) AS SoLuotDangKy
      FROM KHOA_HOC kh
      JOIN GIANG_VIEN gv ON gv.MaGV = kh.MaGV
      JOIN DANG_KY dk ON dk.MaKH = kh.MaKH
      JOIN THANH_TOAN tt ON tt.MaDK = dk.MaDK AND tt.TrangThaiTT = 'success'
      GROUP BY kh.MaKH, kh.TenKH, gv.HoTen
      HAVING DoanhThu > 0
      ORDER BY DoanhThu DESC LIMIT 5`);

    // Khóa học đang chờ xử lý (draft) — cần admin chú ý
    const [[cho]] = await pool.query(`SELECT COUNT(*) AS SoKhoaChoDuyet FROM KHOA_HOC WHERE TrangThai='draft'`);
    // Giao dịch "pending" — học viên đã gửi yêu cầu (chuyển khoản/thẻ/ví), đang chờ admin đối soát và duyệt
    const [[ttCho]] = await pool.query(`SELECT COUNT(*) AS SoThanhToanChoDuyet FROM THANH_TOAN WHERE TrangThaiTT='pending'`);

    res.json({ ...tong, ...thangNay, doanhThu6Thang, topKhoaHoc, soKhoaChoDuyet: cho.SoKhoaChoDuyet, soThanhToanChoDuyet: ttCho.SoThanhToanChoDuyet });
  } catch (e) { fail(res, e); }
});

// ─────────────────────────────────────────────
// GIẢNG VIÊN — admin trực tiếp cấp tài khoản (đúng mô hình: admin thuê GV)
// ─────────────────────────────────────────────

// GET /api/admin/teachers
router.get('/teachers', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT gv.MaGV, gv.HoTen, gv.Email, gv.ChuyenMon, gv.TrinhDo, gv.TrangThaiTK,
             COUNT(DISTINCT kh.MaKH) AS SoKhoaHoc,
             COUNT(DISTINCT dk.MaHV) AS SoHocVien,
             COALESCE(SUM(${NET_SOTIEN}),0) AS TongDoanhThu
      FROM GIANG_VIEN gv
      LEFT JOIN KHOA_HOC kh ON kh.MaGV = gv.MaGV
      LEFT JOIN DANG_KY dk ON dk.MaKH = kh.MaKH
      LEFT JOIN THANH_TOAN tt ON tt.MaDK = dk.MaDK
      GROUP BY gv.MaGV, gv.HoTen, gv.Email, gv.ChuyenMon, gv.TrinhDo, gv.TrangThaiTK
      ORDER BY gv.MaGV`);
    res.json(rows);
  } catch (e) { fail(res, e); }
});

// POST /api/admin/teachers — tạo tài khoản giảng viên mới, trả mật khẩu tạm 1 lần
router.post('/teachers', async (req, res) => {
  try {
    const hoTen = v.text(req.body.hoTen, { name: 'Họ tên', min: 2, max: 100 });
    const mail = v.email(req.body.email);
    const chuyenMon = v.text(req.body.chuyenMon, { name: 'Chuyên môn', max: 100, required: false });
    const trinhDo = v.text(req.body.trinhDo, { name: 'Trình độ', max: 50, required: false });
    const sdt = v.phone(req.body.sdt);

    const [[dup]] = await pool.query(
      `SELECT (SELECT COUNT(*) FROM HOC_VIEN WHERE Email=?) + (SELECT COUNT(*) FROM GIANG_VIEN WHERE Email=?) + (SELECT COUNT(*) FROM ADMIN WHERE Email=?) AS n`,
      [mail, mail, mail]);
    if (dup.n) throw conflict('Email này đã được đăng ký', 'DUPLICATE');

    const tempPassword = pw.tempPassword();
    const hash = await pw.hash(tempPassword);
    const MaGV = await insertWithCode(pool, 'GIANG_VIEN', 'MaGV', 'GV', (code) => pool.query(
      'INSERT INTO GIANG_VIEN(MaGV,HoTen,Email,MatKhauHash,SDT,ChuyenMon,TrinhDo) VALUES(?,?,?,?,?,?,?)',
      [code, hoTen, mail, hash, sdt, chuyenMon, trinhDo]));
    audit(req, `cấp tài khoản giảng viên ${MaGV} (${mail})`);
    // mật khẩu tạm chỉ trả về đúng 1 lần tại đây — admin có trách nhiệm gửi cho GV (GV nên đổi ngay trong "Hồ sơ")
    res.json({ MaGV, email: mail, tempPassword });
  } catch (e) { fail(res, e); }
});

// Khóa / mở tài khoản — có hiệu lực NGAY (middleware auth tra lại trạng thái ở mỗi yêu cầu)
async function setStatus(req, res, role, table, col) {
  try {
    const ma = v.code(req.params.id, 'Mã tài khoản');
    const status = v.oneOf(req.body.status, ['active', 'suspended'], 'Trạng thái');
    const [r] = await pool.query(`UPDATE ${table} SET TrangThaiTK=? WHERE ${col}=?`, [status, ma]);
    if (!r.affectedRows) throw notFound('Không tìm thấy tài khoản');
    invalidateAccount(role, ma);
    audit(req, `${status === 'suspended' ? 'khóa' : 'mở khóa'} ${role} ${ma}`);
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
}
// Cấp lại mật khẩu (không có email để "quên mật khẩu" tự động → admin đặt lại và đưa mật khẩu tạm cho người dùng, hiện 1 lần)
async function resetPassword(req, res, role, table, col) {
  try {
    const ma = v.code(req.params.id, 'Mã tài khoản');
    const [[row]] = await pool.query(`SELECT Email, HoTen FROM ${table} WHERE ${col}=?`, [ma]);
    if (!row) throw notFound('Không tìm thấy tài khoản');
    const tempPassword = pw.tempPassword();
    await pool.query(`UPDATE ${table} SET MatKhauHash=? WHERE ${col}=?`, [await pw.hash(tempPassword), ma]);
    invalidateAccount(role, ma); // mọi phiên đang đăng nhập bằng mật khẩu cũ hết hiệu lực
    audit(req, `cấp lại mật khẩu cho ${role} ${ma}`);
    res.json({ ma, email: row.Email, hoTen: row.HoTen, tempPassword });
  } catch (e) { fail(res, e); }
}

// PUT /api/admin/teachers/:id/status — khóa / mở tài khoản giảng viên
router.put('/teachers/:id/status', (req, res) => setStatus(req, res, 'teacher', 'GIANG_VIEN', 'MaGV'));
router.post('/teachers/:id/reset-password', (req, res) => resetPassword(req, res, 'teacher', 'GIANG_VIEN', 'MaGV'));

// ─────────────────────────────────────────────
// HỌC VIÊN
// ─────────────────────────────────────────────
router.get('/students', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT hv.MaHV, hv.HoTen, hv.Email, hv.NgayDK, hv.TrangThaiTK,
             COUNT(DISTINCT dk.MaDK) AS SoLuotDangKy,
             COALESCE(SUM(${NET_SOTIEN}),0) AS TongChiTieu
      FROM HOC_VIEN hv
      LEFT JOIN DANG_KY dk ON dk.MaHV = hv.MaHV
      LEFT JOIN THANH_TOAN tt ON tt.MaDK = dk.MaDK
      GROUP BY hv.MaHV, hv.HoTen, hv.Email, hv.NgayDK, hv.TrangThaiTK
      ORDER BY hv.MaHV`);
    res.json(rows);
  } catch (e) { fail(res, e); }
});

router.put('/students/:id/status', (req, res) => setStatus(req, res, 'student', 'HOC_VIEN', 'MaHV'));
router.post('/students/:id/reset-password', (req, res) => resetPassword(req, res, 'student', 'HOC_VIEN', 'MaHV'));

// ─────────────────────────────────────────────
// KHÓA HỌC — admin kiểm duyệt (đổi trạng thái draft/published/archived)
// ─────────────────────────────────────────────
router.get('/courses', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT kh.MaKH, kh.TenKH, kh.TrangThai, kh.HocPhi, kh.NgayTao,
             gv.HoTen AS TenGV, gv.MaGV,
             (SELECT COUNT(*) FROM BAI_HOC bh WHERE bh.MaKH=kh.MaKH) AS SoBaiHoc,
             COUNT(DISTINCT dk.MaDK) AS SoLuotDangKy,
             COALESCE(SUM(${NET_SOTIEN}),0) AS DoanhThu
      FROM KHOA_HOC kh
      JOIN GIANG_VIEN gv ON gv.MaGV = kh.MaGV
      LEFT JOIN DANG_KY dk ON dk.MaKH = kh.MaKH
      LEFT JOIN THANH_TOAN tt ON tt.MaDK = dk.MaDK
      GROUP BY kh.MaKH, kh.TenKH, kh.TrangThai, kh.HocPhi, kh.NgayTao, gv.HoTen, gv.MaGV
      ORDER BY kh.NgayTao DESC`);
    res.json(rows);
  } catch (e) { fail(res, e); }
});

router.put('/courses/:id/status', async (req, res) => {
  try {
    const ma = v.code(req.params.id, 'Mã khóa học');
    const status = v.oneOf(req.body.status, ['draft', 'published', 'archived'], 'Trạng thái');
    const [r] = await pool.query('UPDATE KHOA_HOC SET TrangThai=? WHERE MaKH=?', [status, ma]);
    if (!r.affectedRows) throw notFound('Không tìm thấy khóa học');
    audit(req, `đổi trạng thái khóa ${ma} → ${status}`);
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

// ─────────────────────────────────────────────
// TRÌNH DUYỆT DỮ LIỆU THÔ — chỉ xem, KHÔNG sửa (CRUD trên các bảng này đã
// thuộc nghiệp vụ của GV/HV thông qua hành động thật: tạo bài học, đăng ký
// học, nộp bài, đánh giá... admin xem để đối chiếu dữ liệu khi bảo vệ đồ án,
// không gõ tay chỉnh sửa trực tiếp vào các bảng do hệ thống tự sinh ra).
// ─────────────────────────────────────────────
const browse = (path, sql) => router.get(path, async (req, res) => {
  try { const [rows] = await pool.query(sql); res.json(rows); } catch (e) { fail(res, e); }
});

browse('/lessons', `
  SELECT bh.MaBH, bh.TenBH, bh.ThuTu, bh.ThoiLuong, bh.VideoBaiGiang, kh.MaKH, kh.TenKH, gv.HoTen AS TenGV
  FROM BAI_HOC bh JOIN KHOA_HOC kh ON kh.MaKH = bh.MaKH JOIN GIANG_VIEN gv ON gv.MaGV = kh.MaGV
  ORDER BY kh.MaKH, bh.ThuTu`);

browse('/enrollments', `
  SELECT dk.MaDK, hv.HoTen AS TenHV, kh.TenKH, dk.HocPhi, dk.NgayDangKy, dk.NgayHuy, dk.TTDangKy
  FROM DANG_KY dk JOIN HOC_VIEN hv ON hv.MaHV = dk.MaHV JOIN KHOA_HOC kh ON kh.MaKH = dk.MaKH
  ORDER BY dk.NgayDangKy DESC LIMIT 500`);

browse('/quizzes', `
  SELECT bkt.MaBKT, bkt.TenBKT, bh.TenBH, kh.TenKH, bkt.ThoiGian, bkt.TrangThai, bkt.SoLanLamToiDa, bkt.DiemToiDa
  FROM BAI_KIEM_TRA bkt JOIN BAI_HOC bh ON bh.MaBH = bkt.MaBH JOIN KHOA_HOC kh ON kh.MaKH = bh.MaKH
  ORDER BY kh.MaKH, bh.ThuTu`);

browse('/results', `
  SELECT kq.MaKQ, hv.HoTen AS TenHV, kh.TenKH, bkt.TenBKT, kq.LanLam, kq.DiemSo, bkt.DiemToiDa, kq.ThoiGianLam
  FROM KET_QUA kq
  JOIN DANG_KY dk ON dk.MaDK = kq.MaDK
  JOIN HOC_VIEN hv ON hv.MaHV = dk.MaHV
  JOIN KHOA_HOC kh ON kh.MaKH = dk.MaKH
  JOIN BAI_KIEM_TRA bkt ON bkt.MaBKT = kq.MaBKT
  ORDER BY kq.ThoiGianLam DESC LIMIT 500`);

browse('/payments', `
  SELECT tt.MaTT, dk.MaDK, hv.HoTen AS TenHV, kh.TenKH, tt.SoTien, tt.PhuongThucTT, tt.LoaiGiaoDich, tt.ThoiGian, tt.TrangThaiTT
  FROM THANH_TOAN tt
  JOIN DANG_KY dk ON dk.MaDK = tt.MaDK
  JOIN HOC_VIEN hv ON hv.MaHV = dk.MaHV
  JOIN KHOA_HOC kh ON kh.MaKH = dk.MaKH
  ORDER BY tt.ThoiGian DESC LIMIT 500`);

// ─────────────────────────────────────────────
// DUYỆT THANH TOÁN — học viên gửi 'pending' (đã chuyển khoản/trả qua thẻ/ví), admin đối soát
// rồi duyệt ('success', mở khóa nội dung) hoặc từ chối ('failed', học viên gửi lại được).
// ─────────────────────────────────────────────
router.post('/payments/:maTT/approve', async (req, res) => {
  try {
    const maTT = v.code(req.params.maTT, 'Mã giao dịch');
    await withTx(pool, async (conn) => {
      const [[tt]] = await conn.query('SELECT MaTT, MaDK, TrangThaiTT FROM THANH_TOAN WHERE MaTT = ? FOR UPDATE', [maTT]);
      if (!tt) throw notFound('Không tìm thấy giao dịch');
      if (tt.TrangThaiTT !== 'pending') throw conflict('Giao dịch không ở trạng thái chờ duyệt', 'NOT_PENDING');
      const [[already]] = await conn.query(`SELECT 1 AS x FROM THANH_TOAN WHERE MaDK = ? AND TrangThaiTT = 'success' AND LoaiGiaoDich = 'thanh_toan'`, [tt.MaDK]);
      if (already) throw conflict('Lượt đăng ký này đã có giao dịch thành công khác', 'ALREADY_PAID');
      await conn.query(`UPDATE THANH_TOAN SET TrangThaiTT = 'success' WHERE MaTT = ?`, [maTT]);
      // học viên lỡ gửi yêu cầu nhiều lần cho cùng 1 lượt đăng ký → các dòng 'pending' còn lại tự hủy, tránh duyệt nhầm lần 2
      await conn.query(`UPDATE THANH_TOAN SET TrangThaiTT = 'cancelled' WHERE MaDK = ? AND MaTT <> ? AND TrangThaiTT = 'pending'`, [tt.MaDK, maTT]);
    });
    audit(req, `duyệt thanh toán ${maTT}`);
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});
router.post('/payments/:maTT/reject', async (req, res) => {
  try {
    const maTT = v.code(req.params.maTT, 'Mã giao dịch');
    const lyDo = v.text(req.body.lyDo, { name: 'Lý do', required: false, max: 300 });
    const [[tt]] = await pool.query('SELECT MaTT, TrangThaiTT FROM THANH_TOAN WHERE MaTT = ?', [maTT]);
    if (!tt) throw notFound('Không tìm thấy giao dịch');
    if (tt.TrangThaiTT !== 'pending') throw conflict('Giao dịch không ở trạng thái chờ duyệt', 'NOT_PENDING');
    await pool.query(`UPDATE THANH_TOAN SET TrangThaiTT = 'failed' WHERE MaTT = ?`, [maTT]);
    audit(req, `từ chối thanh toán ${maTT}${lyDo ? ' — ' + lyDo : ''}`);
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

// ─────────────────────────────────────────────
// HỦY ĐĂNG KÝ (+ HOÀN TIỀN) — nếu lượt đăng ký đã có giao dịch 'thanh_toan' thành công, tự
// tạo 1 giao dịch 'hoan_tien' thành công bằng đúng số tiền đã thu, KHÔNG xóa giao dịch cũ
// (đúng quy tắc doanh thu #11: điều chỉnh bằng dòng hoàn tiền, không xóa khoản thu đã ghi nhận).
// ─────────────────────────────────────────────
router.post('/enrollments/:maDK/cancel', async (req, res) => {
  try {
    const maDK = v.code(req.params.maDK, 'Mã đăng ký');
    const out = await withTx(pool, async (conn) => {
      const [[dk]] = await conn.query('SELECT MaDK, TTDangKy FROM DANG_KY WHERE MaDK = ? FOR UPDATE', [maDK]);
      if (!dk) throw notFound('Không tìm thấy lượt đăng ký');
      if (dk.TTDangKy === 'da_huy') throw conflict('Lượt đăng ký này đã hủy rồi', 'ALREADY_CANCELLED');
      const [[paid]] = await conn.query(
        `SELECT COALESCE(SUM(SoTien),0) AS da_tra FROM THANH_TOAN WHERE MaDK = ? AND TrangThaiTT = 'success' AND LoaiGiaoDich = 'thanh_toan'`, [maDK]);
      const daTra = Number(paid.da_tra);
      await conn.query(`UPDATE DANG_KY SET TTDangKy = 'da_huy', NgayHuy = CURRENT_DATE WHERE MaDK = ?`, [maDK]);
      let MaTT = null;
      if (daTra > 0) {
        MaTT = await insertWithCode(pool, 'THANH_TOAN', 'MaTT', 'TT', (code) => conn.query(
          `INSERT INTO THANH_TOAN(MaTT, MaDK, SoTien, PhuongThucTT, LoaiGiaoDich, TrangThaiTT) VALUES(?,?,?,?,'hoan_tien','success')`,
          [code, maDK, daTra, 'Hoàn tiền']));
      }
      return { daTra, MaTT };
    });
    audit(req, `hủy đăng ký ${maDK}${out.MaTT ? ` — hoàn ${out.daTra}đ (giao dịch ${out.MaTT})` : ''}`);
    res.json({ ok: true, ...out });
  } catch (e) { fail(res, e); }
});

browse('/certificates', `
  SELECT cc.MaCC, hv.HoTen AS TenHV, kh.TenKH, cc.NgayCap, cc.HieuLuc
  FROM CHUNG_CHI cc
  JOIN DANG_KY dk ON dk.MaDK = cc.MaDK
  JOIN HOC_VIEN hv ON hv.MaHV = dk.MaHV
  JOIN KHOA_HOC kh ON kh.MaKH = dk.MaKH
  ORDER BY cc.NgayCap DESC`);

browse('/reviews', `
  SELECT dg.MaDG, hv.HoTen AS TenHV, kh.TenKH, dg.DiemDanhGia, dg.NhanXet, dg.NgayDG
  FROM DANH_GIA dg
  JOIN DANG_KY dk ON dk.MaDK = dg.MaDK
  JOIN HOC_VIEN hv ON hv.MaHV = dk.MaHV
  JOIN KHOA_HOC kh ON kh.MaKH = dk.MaKH
  ORDER BY dg.NgayDG DESC LIMIT 500`);

module.exports = router;
