const router = require('express').Router();
const pool = require('../config/db');
const { auth, optionalAuth, teacherOnly } = require('../middleware/auth');
const { insertWithCode } = require('../utils/id');
const { withTx } = require('../utils/tx');
const { studentEntitlement, canViewCourse, isOwner, isAdmin } = require('../utils/access');
const { AppError, forbidden, notFound, fail } = require('../utils/http');
const v = require('../utils/validate');

const LEVELS = ['co_ban', 'trung_cap', 'nang_cao'];

// Dữ liệu khóa học hợp lệ từ body (dùng chung cho tạo mới / sửa)
function courseFields(b) {
  return {
    TenKH: v.text(b.TenKH, { name: 'Tên khóa học', min: 3, max: 150 }),
    MoTa: v.paragraph(b.MoTa, { name: 'Mô tả', max: 2000 }),
    LinhVuc: v.text(b.LinhVuc, { name: 'Lĩnh vực', max: 100, required: false }) || 'Khác',
    TrinhDo: b.TrinhDo === undefined || b.TrinhDo === '' ? 'co_ban' : v.oneOf(b.TrinhDo, LEVELS, 'Trình độ'),
    ThoiLuong: v.int(b.ThoiLuong === undefined || b.ThoiLuong === '' ? 1 : b.ThoiLuong, { name: 'Thời lượng', min: 1, max: 10000 }),
    HocPhi: v.int(b.HocPhi === undefined || b.HocPhi === '' ? 0 : b.HocPhi, { name: 'Học phí', min: 0, max: 100000000 }),
  };
}

// GET /api/courses — danh sách khóa học công khai (chỉ 'published'),
// CỘNG THÊM khóa 'draft'/'archived' của CHÍNH giảng viên đang xem (nếu có đăng nhập)
// để trang "Quản lý giảng dạy" thấy được khóa của mình dù chưa được duyệt.
router.get('/', optionalAuth, async (req, res) => {
  try {
    const maGV = (req.user && req.user.role === 'teacher') ? req.user.ma : null;
    const [rows] = await pool.query(`
      SELECT kh.MaKH, kh.TenKH, kh.MoTa, kh.LinhVuc, kh.TrinhDo, kh.ThoiLuong, kh.HocPhi, kh.TrangThai,
             gv.MaGV, gv.HoTen AS TenGV,
             (SELECT COUNT(*) FROM BAI_HOC bh WHERE bh.MaKH = kh.MaKH) AS SoBaiHoc,
             (SELECT ROUND(AVG(dg.DiemDanhGia),1)
                FROM DANH_GIA dg JOIN DANG_KY dk ON dk.MaDK = dg.MaDK
               WHERE dk.MaKH = kh.MaKH) AS DiemTB,
             (SELECT COUNT(*) FROM DANH_GIA dg2 JOIN DANG_KY dk2 ON dk2.MaDK = dg2.MaDK WHERE dk2.MaKH = kh.MaKH) AS SoDanhGia,
             (SELECT COUNT(DISTINCT dk.MaHV) FROM DANG_KY dk WHERE dk.MaKH = kh.MaKH AND dk.TTDangKy <> 'da_huy') AS SoHocVien
      FROM KHOA_HOC kh JOIN GIANG_VIEN gv ON gv.MaGV = kh.MaGV
      WHERE kh.TrangThai = 'published' OR kh.MaGV = ?
      ORDER BY kh.NgayTao DESC, kh.MaKH DESC`, [maGV]);
    res.json(rows);
  } catch (e) { fail(res, e); }
});

// GET /api/courses/:id — chi tiết + danh sách bài học
// Khóa nháp/lưu trữ: chỉ chủ khóa + admin thấy (người khác nhận 404 như thể không tồn tại).
// Link video là NỘI DUNG TRẢ PHÍ: chỉ trả cho admin, chủ khóa, hoặc học viên đã đăng ký và (khóa miễn phí hoặc đã thanh toán).
// Người khác vẫn thấy danh sách bài (tên/thời lượng) nhưng `VideoBaiGiang` = null và `coVideo` cho biết bài có video hay không.
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const maKH = v.code(req.params.id, 'Mã khóa học');
    const [[kh]] = await pool.query(
      `SELECT kh.*, gv.HoTen AS TenGV, gv.ChuyenMon, gv.TrinhDo AS GV_TrinhDo
         FROM KHOA_HOC kh JOIN GIANG_VIEN gv ON gv.MaGV = kh.MaGV WHERE kh.MaKH=?`, [maKH]);
    if (!kh || !canViewCourse(req.user, kh)) throw notFound('Không tìm thấy khóa học');

    // quyền xem nội dung: { xem, lyDo, maDK? }
    let quyen = { xem: false, lyDo: 'khach' };
    const u = req.user;
    if (isAdmin(u)) quyen = { xem: true, lyDo: 'admin' };
    else if (isOwner(u, kh)) quyen = { xem: true, lyDo: 'chu_khoa' };
    else if (u && u.role === 'student') {
      const ent = await studentEntitlement(pool, u.ma, maKH);
      quyen = ent.entitled ? { xem: true, lyDo: 'ok', maDK: ent.dk.MaDK }
        : { xem: false, lyDo: ent.reason, maDK: ent.dk ? ent.dk.MaDK : undefined };
    } else if (u) quyen = { xem: false, lyDo: 'khong_phai_hoc_vien' };

    const [rows] = await pool.query(
      'SELECT MaBH,TenBH,ThuTu,ThoiLuong,VideoBaiGiang FROM BAI_HOC WHERE MaKH=? ORDER BY ThuTu', [maKH]);
    const lessons = rows.map((l) => ({
      MaBH: l.MaBH, TenBH: l.TenBH, ThuTu: l.ThuTu, ThoiLuong: l.ThoiLuong,
      coVideo: !!l.VideoBaiGiang,
      VideoBaiGiang: quyen.xem ? l.VideoBaiGiang : null,
    }));
    res.json({ ...kh, lessons, quyen });
  } catch (e) { fail(res, e); }
});

// POST /api/courses — tạo khóa học (giảng viên)
// Mặc định 'draft' (nháp) — admin duyệt rồi mới chuyển 'published' để lên trang công khai.
router.post('/', auth, teacherOnly, async (req, res) => {
  try {
    const f = courseFields(req.body);
    const MaKH = await insertWithCode(pool, 'KHOA_HOC', 'MaKH', 'KH', (code) => pool.query(
      `INSERT INTO KHOA_HOC(MaKH,MaGV,TenKH,MoTa,LinhVuc,TrinhDo,ThoiLuong,HocPhi,TrangThai)
       VALUES(?,?,?,?,?,?,?,?, 'draft')`,
      [code, req.user.ma, f.TenKH, f.MoTa, f.LinhVuc, f.TrinhDo, f.ThoiLuong, f.HocPhi]));
    res.json({ MaKH });
  } catch (e) { fail(res, e); }
});

// PUT /api/courses/:id — sửa (chỉ chủ sở hữu)
router.put('/:id', auth, teacherOnly, async (req, res) => {
  try {
    const maKH = v.code(req.params.id, 'Mã khóa học');
    const f = courseFields(req.body);
    const [r] = await pool.query(
      `UPDATE KHOA_HOC SET TenKH=?,MoTa=?,LinhVuc=?,TrinhDo=?,ThoiLuong=?,HocPhi=?
        WHERE MaKH=? AND MaGV=?`,
      [f.TenKH, f.MoTa, f.LinhVuc, f.TrinhDo, f.ThoiLuong, f.HocPhi, maKH, req.user.ma]);
    if (!r.affectedRows) throw forbidden('Bạn không có quyền sửa khóa học này');
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

// DELETE /api/courses/:id — xóa (chỉ chủ sở hữu). Khóa đã có học viên/kết quả sẽ bị CSDL chặn → trả 409 dễ hiểu (xem utils/http.js).
router.delete('/:id', auth, teacherOnly, async (req, res) => {
  try {
    const maKH = v.code(req.params.id, 'Mã khóa học');
    const [r] = await pool.query('DELETE FROM KHOA_HOC WHERE MaKH=? AND MaGV=?', [maKH, req.user.ma]);
    if (!r.affectedRows) throw forbidden('Bạn không có quyền xóa khóa học này');
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

// --- Đăng ký khóa học (học viên) ---

// GET /api/courses/:id/enrollment — trạng thái đăng ký của người đang đăng nhập
router.get('/:id/enrollment', auth, async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.json({ enrolled: false });
    const maKH = v.code(req.params.id, 'Mã khóa học');
    const ent = await studentEntitlement(pool, req.user.ma, maKH);
    if (!ent.dk) return res.json({ enrolled: false });
    // bài đã học xong trong lượt đăng ký hiện tại → hiển thị dấu ✓ + thanh tiến độ trang chi tiết
    const [done] = await pool.query(
      `SELECT DISTINCT MaBH FROM LICH_SU_HOC_TAP WHERE MaDK=? AND TrangThaiHoanThanh='hoan_thanh'`, [ent.dk.MaDK]);
    res.json({
      enrolled: true, MaDK: ent.dk.MaDK, NgayDangKy: ent.dk.NgayDangKy, TTDangKy: ent.dk.TTDangKy,
      HocPhi: Number(ent.dk.HocPhi), daThanhToan: ent.paid, entitled: ent.entitled, dangCho: ent.dangCho,
      daHoc: done.map((r) => r.MaBH),
    });
  } catch (e) { fail(res, e); }
});

// POST /api/courses/:id/enroll — đăng ký (idempotent: đã đăng ký thì trả lại MaDK cũ). Chỉ khóa đã công khai.
// Khóa dòng học viên trong transaction → bấm đúp / 2 tab cùng lúc cũng chỉ tạo 1 lượt đăng ký.
router.post('/:id/enroll', auth, async (req, res) => {
  try {
    if (req.user.role !== 'student') throw forbidden('Chỉ học viên mới đăng ký khóa học');
    const maKH = v.code(req.params.id, 'Mã khóa học');
    const out = await withTx(pool, async (conn) => {
      await conn.query('SELECT MaHV FROM HOC_VIEN WHERE MaHV=? FOR UPDATE', [req.user.ma]);
      const [[kh]] = await conn.query('SELECT MaKH, HocPhi, TrangThai FROM KHOA_HOC WHERE MaKH=?', [maKH]);
      if (!kh || kh.TrangThai !== 'published') throw notFound('Không tìm thấy khóa học');
      const [[cur]] = await conn.query('SELECT MaDK FROM DANG_KY WHERE MaHV=? AND MaKH=? AND NgayHuy IS NULL LIMIT 1', [req.user.ma, maKH]);
      if (cur) return { MaDK: cur.MaDK, already: true };
      const MaDK = await insertWithCode(pool, 'DANG_KY', 'MaDK', 'DK', (code) => conn.query(
        'INSERT INTO DANG_KY(MaDK,MaHV,MaKH,HocPhi,TTDangKy) VALUES(?,?,?,?,?)',
        [code, req.user.ma, maKH, Number(kh.HocPhi) || 0, 'da_xac_nhan']));
      return { MaDK, already: false };
    });
    res.json(out);
  } catch (e) { fail(res, e); }
});

// --- Bài học ---
async function ownerOfLesson(maBH) {
  const [[r]] = await pool.query(
    'SELECT bh.MaBH, bh.MaKH, kh.MaGV FROM BAI_HOC bh JOIN KHOA_HOC kh ON kh.MaKH=bh.MaKH WHERE bh.MaBH=?', [maBH]);
  return r || null;
}
function lessonFields(b) {
  return {
    TenBH: v.text(b.TenBH, { name: 'Tên bài học', min: 1, max: 150 }),
    ThoiLuong: v.int(b.ThoiLuong === undefined || b.ThoiLuong === '' ? 0 : b.ThoiLuong, { name: 'Thời lượng', min: 0, max: 2000 }),
    VideoBaiGiang: v.youtube(b.VideoBaiGiang),
  };
}

// POST /api/courses/:id/lessons — thêm bài học (khóa dòng khóa học để 2 yêu cầu không cùng lấy 1 số thứ tự)
router.post('/:id/lessons', auth, teacherOnly, async (req, res) => {
  try {
    const maKH = v.code(req.params.id, 'Mã khóa học');
    const f = lessonFields(req.body);
    const MaBH = await withTx(pool, async (conn) => {
      const [[kh]] = await conn.query('SELECT MaGV FROM KHOA_HOC WHERE MaKH=? FOR UPDATE', [maKH]);
      if (!kh || kh.MaGV !== req.user.ma) throw forbidden('Bạn không có quyền');
      const [[mx]] = await conn.query('SELECT COALESCE(MAX(ThuTu),0)+1 AS t FROM BAI_HOC WHERE MaKH=?', [maKH]);
      return insertWithCode(pool, 'BAI_HOC', 'MaBH', 'BH', (code) => conn.query(
        'INSERT INTO BAI_HOC(MaBH,MaKH,TenBH,ThuTu,ThoiLuong,VideoBaiGiang) VALUES(?,?,?,?,?,?)',
        [code, maKH, f.TenBH, mx.t, f.ThoiLuong, f.VideoBaiGiang]));
    });
    res.json({ MaBH });
  } catch (e) { fail(res, e); }
});

// PUT /api/courses/lessons/:maBH — sửa bài học
router.put('/lessons/:maBH', auth, teacherOnly, async (req, res) => {
  try {
    const maBH = v.code(req.params.maBH, 'Mã bài học');
    const f = lessonFields(req.body);
    const bh = await ownerOfLesson(maBH);
    if (!bh || bh.MaGV !== req.user.ma) throw forbidden('Bạn không có quyền');
    await pool.query('UPDATE BAI_HOC SET TenBH=?,ThoiLuong=?,VideoBaiGiang=? WHERE MaBH=?', [f.TenBH, f.ThoiLuong, f.VideoBaiGiang, maBH]);
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

// DELETE /api/courses/lessons/:maBH — xóa bài học (bài đã có học viên học/làm bài sẽ bị CSDL chặn → 409 dễ hiểu)
router.delete('/lessons/:maBH', auth, teacherOnly, async (req, res) => {
  try {
    const maBH = v.code(req.params.maBH, 'Mã bài học');
    const bh = await ownerOfLesson(maBH);
    if (!bh || bh.MaGV !== req.user.ma) throw forbidden('Bạn không có quyền');
    await pool.query('DELETE FROM BAI_HOC WHERE MaBH=?', [maBH]);
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

module.exports = router;
