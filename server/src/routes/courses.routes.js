const router = require('express').Router();
const pool = require('../config/db');
const { auth, optionalAuth, teacherOnly } = require('../middleware/auth');
const { insertWithCode } = require('../utils/id');
const { withTx } = require('../utils/tx');
const { studentEntitlement, canViewCourse, isOwner, isAdmin } = require('../utils/access');
const { AppError, forbidden, notFound, fail } = require('../utils/http');
const v = require('../utils/validate');

const LEVELS = ['co_ban', 'trung_cap', 'nang_cao'];

function courseFields(b) {
  return {
    TenKH: v.text(b.TenKH, { name: 'Tên khóa học', min: 3, max: 150 }),
    MoTa: v.paragraph(b.MoTa, { name: 'Mô tả', max: 2000 }),
    LinhVuc: v.text(b.LinhVuc, { name: 'Lĩnh vực', max: 100, required: false }) || 'Khác',
    TrinhDo: b.TrinhDo === undefined || b.TrinhDo === '' ? 'co_ban' : v.oneOf(b.TrinhDo, LEVELS, 'Trình độ'),
    ThoiLuong: v.int(b.ThoiLuong === undefined || b.ThoiLuong === '' ? 1 : b.ThoiLuong, { name: 'Thời lượng', min: 1, max: 10000 }),
    HocPhi: v.int(b.HocPhi === undefined || b.HocPhi === '' ? 0 : b.HocPhi, { name: 'Học phí', min: 0, max: 100000000 }),
    ThoiHanTruyCap: v.duration(b.ThoiHanTruyCap), // 90/180/365 ngày, hoặc null = vĩnh viễn
  };
}

// Danh sách công khai ('published') + khóa 'draft'/'archived' của chính giảng viên đang xem
router.get('/', optionalAuth, async (req, res) => {
  try {
    const maGV = (req.user && req.user.role === 'teacher') ? req.user.ma : null;
    const [rows] = await pool.query(`
      SELECT kh.MaKH, kh.TenKH, kh.MoTa, kh.LinhVuc, kh.TrinhDo, kh.ThoiLuong, kh.HocPhi, kh.TrangThai, kh.ThoiHanTruyCap,
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

// Link video là nội dung trả phí: chỉ trả cho admin/chủ khóa/học viên đủ điều kiện, người khác chỉ thấy coVideo
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const maKH = v.code(req.params.id, 'Mã khóa học');
    const [[kh]] = await pool.query(
      `SELECT kh.*, gv.HoTen AS TenGV, gv.ChuyenMon, gv.TrinhDo AS GV_TrinhDo
         FROM KHOA_HOC kh JOIN GIANG_VIEN gv ON gv.MaGV = kh.MaGV WHERE kh.MaKH=?`, [maKH]);
    if (!kh || !canViewCourse(req.user, kh)) throw notFound('Không tìm thấy khóa học');

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
      'SELECT MaBH,TenBH,ThuTu,ThoiLuong,VideoBaiGiang,GiaoTrinh,ThucHanh FROM BAI_HOC WHERE MaKH=? ORDER BY ThuTu', [maKH]);
    // video, giáo trình, thực hành đều là nội dung khóa học: chưa đủ quyền thì KHÔNG gửi nội dung, chỉ gửi cờ co*
    const lessons = rows.map((l) => ({
      MaBH: l.MaBH, TenBH: l.TenBH, ThuTu: l.ThuTu, ThoiLuong: l.ThoiLuong,
      coVideo: !!l.VideoBaiGiang,
      VideoBaiGiang: quyen.xem ? l.VideoBaiGiang : null,
      coGiaoTrinh: !!(l.GiaoTrinh && l.GiaoTrinh.trim()),
      GiaoTrinh: quyen.xem ? l.GiaoTrinh : null,
      coThucHanh: !!(l.ThucHanh && l.ThucHanh.trim()),
      ThucHanh: quyen.xem ? l.ThucHanh : null,
    }));
    res.json({ ...kh, lessons, quyen });
  } catch (e) { fail(res, e); }
});

// Mặc định 'draft' — admin duyệt rồi mới chuyển 'published' để lên trang công khai
router.post('/', auth, teacherOnly, async (req, res) => {
  try {
    const f = courseFields(req.body);
    const MaKH = await insertWithCode(pool, 'KHOA_HOC', 'MaKH', 'KH', (code) => pool.query(
      `INSERT INTO KHOA_HOC(MaKH,MaGV,TenKH,MoTa,LinhVuc,TrinhDo,ThoiLuong,HocPhi,TrangThai,ThoiHanTruyCap)
       VALUES(?,?,?,?,?,?,?,?, 'draft', ?)`,
      [code, req.user.ma, f.TenKH, f.MoTa, f.LinhVuc, f.TrinhDo, f.ThoiLuong, f.HocPhi, f.ThoiHanTruyCap]));
    res.json({ MaKH });
  } catch (e) { fail(res, e); }
});

router.put('/:id', auth, teacherOnly, async (req, res) => {
  try {
    const maKH = v.code(req.params.id, 'Mã khóa học');
    const f = courseFields(req.body);
    const [r] = await pool.query(
      `UPDATE KHOA_HOC SET TenKH=?,MoTa=?,LinhVuc=?,TrinhDo=?,ThoiLuong=?,HocPhi=?,ThoiHanTruyCap=?
        WHERE MaKH=? AND MaGV=?`,
      [f.TenKH, f.MoTa, f.LinhVuc, f.TrinhDo, f.ThoiLuong, f.HocPhi, f.ThoiHanTruyCap, maKH, req.user.ma]);
    if (!r.affectedRows) throw forbidden('Bạn không có quyền sửa khóa học này');
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

// Khóa đã có học viên/kết quả sẽ bị CSDL chặn → trả 409 dễ hiểu (xem utils/http.js)
router.delete('/:id', auth, teacherOnly, async (req, res) => {
  try {
    const maKH = v.code(req.params.id, 'Mã khóa học');
    const [r] = await pool.query('DELETE FROM KHOA_HOC WHERE MaKH=? AND MaGV=?', [maKH, req.user.ma]);
    if (!r.affectedRows) throw forbidden('Bạn không có quyền xóa khóa học này');
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

// --- Đăng ký khóa học (học viên) ---
router.get('/:id/enrollment', auth, async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.json({ enrolled: false });
    const maKH = v.code(req.params.id, 'Mã khóa học');
    const ent = await studentEntitlement(pool, req.user.ma, maKH);
    if (!ent.dk) return res.json({ enrolled: false });
    const [done] = await pool.query(
      `SELECT DISTINCT MaBH FROM LICH_SU_HOC_TAP WHERE MaDK=? AND TrangThaiHoanThanh='hoan_thanh'`, [ent.dk.MaDK]);
    // Lịch sử học tập theo từng bài (thời điểm bắt đầu, phần trăm đóng góp cho khóa) và lịch sử làm bài kiểm tra của lượt đăng ký này
    const [lichSu] = await pool.query(
      `SELECT MaBH, ThoiDiemHoc, TienDoTangThem, TrangThaiHoanThanh FROM LICH_SU_HOC_TAP WHERE MaDK=? ORDER BY ThoiDiemHoc`, [ent.dk.MaDK]);
    const [ketQua] = await pool.query(
      `SELECT MaBKT, LanLam, DiemSo, ThoiGianLam FROM KET_QUA WHERE MaDK=? ORDER BY MaBKT, LanLam`, [ent.dk.MaDK]);
    const [[td]] = await pool.query(
      `SELECT TongSoBai, SoBaiHoanThanh, COALESCE(TienDoPhanTram, 0) AS TienDoPhanTram FROM V_TIEN_DO WHERE MaDK=?`, [ent.dk.MaDK]);
    res.json({
      enrolled: true, MaDK: ent.dk.MaDK, NgayDangKy: ent.dk.NgayDangKy, TTDangKy: ent.dk.TTDangKy,
      NgayHetHan: ent.dk.NgayHetHan, hetHan: ent.reason === 'het_han',
      HocPhi: Number(ent.dk.HocPhi), daThanhToan: ent.paid, entitled: ent.entitled, dangCho: ent.dangCho,
      daHoc: done.map((r) => r.MaBH),
      lichSu: lichSu.map((r) => ({ ...r, TienDoTangThem: Number(r.TienDoTangThem) })),
      ketQua: ketQua.map((r) => ({ ...r, DiemSo: Number(r.DiemSo) })),
      tienDo: td ? { tong: td.TongSoBai, xong: td.SoBaiHoanThanh, phanTram: Number(td.TienDoPhanTram) } : { tong: 0, xong: 0, phanTram: 0 },
    });
  } catch (e) { fail(res, e); }
});

// Idempotent (đã đăng ký thì trả lại MaDK cũ); khóa dòng học viên trong transaction để bấm đúp không tạo 2 lượt
router.post('/:id/enroll', auth, async (req, res) => {
  try {
    if (req.user.role !== 'student') throw forbidden('Chỉ học viên mới đăng ký khóa học');
    const maKH = v.code(req.params.id, 'Mã khóa học');
    const out = await withTx(pool, async (conn) => {
      await conn.query('SELECT MaHV FROM HOC_VIEN WHERE MaHV=? FOR UPDATE', [req.user.ma]);
      const [[kh]] = await conn.query('SELECT MaKH, HocPhi, TrangThai, ThoiHanTruyCap FROM KHOA_HOC WHERE MaKH=?', [maKH]);
      if (!kh || kh.TrangThai !== 'published') throw notFound('Không tìm thấy khóa học');
      const [[cur]] = await conn.query('SELECT MaDK FROM DANG_KY WHERE MaHV=? AND MaKH=? AND NgayHuy IS NULL LIMIT 1', [req.user.ma, maKH]);
      if (cur) return { MaDK: cur.MaDK, already: true };
      const MaDK = await insertWithCode(pool, 'DANG_KY', 'MaDK', 'DK', (code) => conn.query(
        `INSERT INTO DANG_KY(MaDK,MaHV,MaKH,HocPhi,TTDangKy,NgayHetHan)
         VALUES(?,?,?,?,'da_xac_nhan', ${kh.ThoiHanTruyCap ? 'DATE_ADD(CURRENT_DATE, INTERVAL ? DAY)' : 'NULL'})`,
        kh.ThoiHanTruyCap
          ? [code, req.user.ma, maKH, Number(kh.HocPhi) || 0, kh.ThoiHanTruyCap]
          : [code, req.user.ma, maKH, Number(kh.HocPhi) || 0]));
      return { MaDK, already: false };
    });
    res.json(out);
  } catch (e) { fail(res, e); }
});

// Đăng ký lại: CHỈ áp dụng khi lượt đăng ký hiện tại ĐÃ HẾT HẠN (còn hạn thì học viên cứ vào học/ôn tập
// bình thường, không cần thao tác gì). Hủy lượt cũ (giữ nguyên chứng chỉ, lịch sử học tập, kết quả của
// lượt đó), tạo một lượt đăng ký mới với HỌC PHÍ HIỆN TẠI — luôn phải thanh toán lại như mua mới.
router.post('/:id/retake', auth, async (req, res) => {
  try {
    if (req.user.role !== 'student') throw forbidden('Chỉ học viên mới đăng ký lại được khóa học');
    const maKH = v.code(req.params.id, 'Mã khóa học');
    const out = await withTx(pool, async (conn) => {
      await conn.query('SELECT MaHV FROM HOC_VIEN WHERE MaHV=? FOR UPDATE', [req.user.ma]);
      const [[kh]] = await conn.query('SELECT MaKH, HocPhi, TrangThai, ThoiHanTruyCap FROM KHOA_HOC WHERE MaKH=?', [maKH]);
      if (!kh || kh.TrangThai !== 'published') throw notFound('Không tìm thấy khóa học');
      const [[cur]] = await conn.query(
        'SELECT MaDK, NgayHetHan FROM DANG_KY WHERE MaHV=? AND MaKH=? AND NgayHuy IS NULL LIMIT 1',
        [req.user.ma, maKH]);
      if (!cur) throw notFound('Bạn chưa đăng ký khóa học này');
      const hetHan = cur.NgayHetHan && new Date(cur.NgayHetHan) < new Date(new Date().toDateString());
      if (!hetHan) throw new AppError(409, 'Khóa học vẫn còn hạn, bạn vào học/ôn tập bình thường, không cần đăng ký lại', 'STILL_VALID');

      await conn.query(`UPDATE DANG_KY SET TTDangKy='da_huy', NgayHuy=CURRENT_DATE WHERE MaDK=?`, [cur.MaDK]);
      const hocPhiMoi = Number(kh.HocPhi) || 0;
      const MaDK = await insertWithCode(pool, 'DANG_KY', 'MaDK', 'DK', (code) => conn.query(
        `INSERT INTO DANG_KY(MaDK,MaHV,MaKH,HocPhi,TTDangKy,NgayHetHan)
         VALUES(?,?,?,?,'da_xac_nhan', ${kh.ThoiHanTruyCap ? 'DATE_ADD(CURRENT_DATE, INTERVAL ? DAY)' : 'NULL'})`,
        kh.ThoiHanTruyCap
          ? [code, req.user.ma, maKH, hocPhiMoi, kh.ThoiHanTruyCap]
          : [code, req.user.ma, maKH, hocPhiMoi]));
      return { MaDK, oldMaDK: cur.MaDK, hocPhi: hocPhiMoi };
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
    GiaoTrinh: v.paragraph(b.GiaoTrinh, { name: 'Giáo trình', max: 20000 }),   // nội dung/tài liệu của bài (văn bản nhiều dòng)
    ThucHanh: v.paragraph(b.ThucHanh, { name: 'Bài thực hành', max: 20000 }),  // yêu cầu bài thực hành của bài
  };
}

// Khóa dòng khóa học để 2 yêu cầu không cùng lấy 1 số thứ tự
router.post('/:id/lessons', auth, teacherOnly, async (req, res) => {
  try {
    const maKH = v.code(req.params.id, 'Mã khóa học');
    const f = lessonFields(req.body);
    const MaBH = await withTx(pool, async (conn) => {
      const [[kh]] = await conn.query('SELECT MaGV FROM KHOA_HOC WHERE MaKH=? FOR UPDATE', [maKH]);
      if (!kh || kh.MaGV !== req.user.ma) throw forbidden('Bạn không có quyền');
      const [[mx]] = await conn.query('SELECT COALESCE(MAX(ThuTu),0)+1 AS t FROM BAI_HOC WHERE MaKH=?', [maKH]);
      return insertWithCode(pool, 'BAI_HOC', 'MaBH', 'BH', (code) => conn.query(
        'INSERT INTO BAI_HOC(MaBH,MaKH,TenBH,ThuTu,ThoiLuong,VideoBaiGiang,GiaoTrinh,ThucHanh) VALUES(?,?,?,?,?,?,?,?)',
        [code, maKH, f.TenBH, mx.t, f.ThoiLuong, f.VideoBaiGiang, f.GiaoTrinh, f.ThucHanh]));
    });
    res.json({ MaBH });
  } catch (e) { fail(res, e); }
});

router.put('/lessons/:maBH', auth, teacherOnly, async (req, res) => {
  try {
    const maBH = v.code(req.params.maBH, 'Mã bài học');
    const f = lessonFields(req.body);
    const bh = await ownerOfLesson(maBH);
    if (!bh || bh.MaGV !== req.user.ma) throw forbidden('Bạn không có quyền');
    await pool.query('UPDATE BAI_HOC SET TenBH=?,ThoiLuong=?,VideoBaiGiang=?,GiaoTrinh=?,ThucHanh=? WHERE MaBH=?',
      [f.TenBH, f.ThoiLuong, f.VideoBaiGiang, f.GiaoTrinh, f.ThucHanh, maBH]);
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

// Bài đã có học viên học/làm bài sẽ bị CSDL chặn → 409 dễ hiểu
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
