const router = require('express').Router();
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const cfg = require('../config/env');
const { auth, optionalAuth, teacherOnly } = require('../middleware/auth');
const { insertWithCode } = require('../utils/id');
const { withTx } = require('../utils/tx');
const { syncEnrollment } = require('../utils/enrollment');
const { studentEntitlement, canViewCourse, isOwner, isAdmin } = require('../utils/access');
const { AppError, forbidden, notFound, fail } = require('../utils/http');
const v = require('../utils/validate');

/* =====================================================================
 * BÀI KIỂM TRA (BAI_KIEM_TRA) + KẾT QUẢ (KET_QUA)
 * Câu hỏi lưu dạng JSON trong cột NoiDungBKT (giữ nguyên 11 bảng):
 *   [ { "q": "Nội dung câu hỏi", "opt": ["A","B","C","D"], "dap": 1 }, ... ]
 *   dap = chỉ số (0-based) của đáp án đúng.
 * Điểm = (số câu đúng / tổng câu) * DiemToiDa của bài đó, lưu vào KET_QUA.DiemSo.
 * Mỗi bài kiểm tra có thể có điểm tối đa khác nhau (mặc định 10) — đạt/không đạt luôn
 * so theo TỶ LỆ % trên điểm tối đa của CHÍNH bài đó (PASS_RATIO), không so số điểm thô.
 *
 * CHỐNG GIAN LẬN (đều do SERVER quyết định, không tin trình duyệt):
 *  - Mở bài (GET) cấp "token phiên làm bài" ký bằng JWT_SECRET, ghi giờ bắt đầu + số lần làm dự kiến.
 *    Nộp bài phải kèm token: quá giờ (ThoiGian + dung sai) → không ghi nhận; token dùng lại/cũ → từ chối.
 *  - Nộp quá nhanh (vài giây) bị từ chối; làm lại phải chờ QUIZ_COOLDOWN_SECONDS.
 *  - Đáp án đúng chỉ được tiết lộ khi ĐẠT (>= 70% điểm tối đa) hoặc HẾT LƯỢT — nếu không, nộp thử một lần rồi đọc đáp án để làm lại sẽ lấy điểm tuyệt đối.
 *  - Chỉ học viên đã đăng ký (và đã thanh toán nếu khóa có phí) mới xem câu hỏi / nộp bài.
 * ===================================================================== */
const PASS_RATIO = 0.7; // ngưỡng đạt: cùng quy tắc với điều kiện hoàn thành khóa (V_DIEM_TB, utils/enrollment.js)
const passOf = (diemToiDa) => Math.round(PASS_RATIO * diemToiDa * 100) / 100;
const COOLDOWN_S = Number(process.env.QUIZ_COOLDOWN_SECONDS ?? 15);
const MIN_S_PER_Q = Number(process.env.QUIZ_MIN_SECONDS_PER_QUESTION ?? 2);

function parseQ(s) {
  try { const a = JSON.parse(s || '[]'); return Array.isArray(a) ? a : []; }
  catch (e) { return []; }
}

// Thông tin bài kiểm tra + khóa học + chủ khóa
async function bktInfo(maBKT) {
  const [[r]] = await pool.query(
    `SELECT bkt.MaBKT, bkt.MaBH, bkt.NoiDungBKT, bkt.TenBKT, bkt.ThoiGian,
            bkt.TrangThai, bkt.SoLanLamToiDa, bkt.DiemToiDa, bh.MaKH, kh.MaGV, kh.TrangThai AS TrangThaiKH
       FROM BAI_KIEM_TRA bkt
       JOIN BAI_HOC bh ON bh.MaBH = bkt.MaBH
       JOIN KHOA_HOC kh ON kh.MaKH = bh.MaKH
      WHERE bkt.MaBKT = ?`, [maBKT]);
  return r || null;
}

const attemptToken = (maHV, maBKT, lan) => jwt.sign({ typ: 'quiz', sub: maHV, b: maBKT, l: lan }, cfg.jwtSecret, { algorithm: 'HS256' });

// GET /api/quizzes/course/:maKH — danh sách bài kiểm tra của 1 khóa học (chỉ thông tin chung, không có nội dung câu hỏi)
router.get('/course/:maKH', optionalAuth, async (req, res) => {
  try {
    const maKH = v.code(req.params.maKH, 'Mã khóa học');
    const [[kh]] = await pool.query('SELECT MaKH, MaGV, TrangThai FROM KHOA_HOC WHERE MaKH=?', [maKH]);
    if (!kh || !canViewCourse(req.user, kh)) throw notFound('Không tìm thấy khóa học');
    const canSeeAll = isOwner(req.user, kh) || isAdmin(req.user);
    const [rows] = await pool.query(
      `SELECT bkt.MaBKT, bkt.MaBH, bkt.TenBKT, bkt.ThoiGian, bkt.TrangThai,
              bkt.SoLanLamToiDa, bkt.DiemToiDa, bkt.NoiDungBKT, bh.TenBH, bh.ThuTu
         FROM BAI_KIEM_TRA bkt
         JOIN BAI_HOC bh ON bh.MaBH = bkt.MaBH
        WHERE bh.MaKH = ? ${canSeeAll ? '' : "AND bkt.TrangThai = 'active'"}
        ORDER BY bh.ThuTu, bkt.MaBKT`, [maKH]);
    res.json(rows.map((r) => ({
      MaBKT: r.MaBKT, MaBH: r.MaBH, TenBKT: r.TenBKT, ThoiGian: r.ThoiGian,
      TrangThai: r.TrangThai, SoLanLamToiDa: r.SoLanLamToiDa, DiemToiDa: Number(r.DiemToiDa),
      TenBH: r.TenBH, ThuTu: r.ThuTu, SoCauHoi: parseQ(r.NoiDungBKT).length,
    })));
  } catch (e) { fail(res, e); }
});

// GET /api/quizzes/:maBKT — chi tiết bài kiểm tra (để làm bài hoặc để sửa)
// Học viên: phải đủ quyền học; ẩn đáp án đúng; kèm số lần đã làm, điểm cao nhất và TOKEN bắt đầu làm bài.
// Giảng viên sở hữu: trả đầy đủ cả đáp án.
router.get('/:maBKT', auth, async (req, res) => {
  try {
    const maBKT = v.code(req.params.maBKT, 'Mã bài kiểm tra');
    const bkt = await bktInfo(maBKT);
    if (!bkt) throw notFound('Không tìm thấy bài kiểm tra');
    const kh = { MaGV: bkt.MaGV, TrangThai: bkt.TrangThaiKH };
    if (!canViewCourse(req.user, kh)) throw notFound('Không tìm thấy bài kiểm tra');
    const questions = parseQ(bkt.NoiDungBKT);
    const owner = isOwner(req.user, kh);

    const out = {
      MaBKT: bkt.MaBKT, MaBH: bkt.MaBH, MaKH: bkt.MaKH, TenBKT: bkt.TenBKT,
      ThoiGian: bkt.ThoiGian, TrangThai: bkt.TrangThai, SoLanLamToiDa: bkt.SoLanLamToiDa, DiemToiDa: Number(bkt.DiemToiDa),
      isOwner: owner, daLam: 0, diemCao: null, dat: false, conLuot: true,
      cauHoi: owner ? questions : questions.map((q) => ({ q: q.q, opt: q.opt })),
    };

    if (req.user.role === 'student') {
      if (bkt.TrangThai !== 'active') throw forbidden('Bài kiểm tra này đang tạm ngừng', 'QUIZ_INACTIVE');
      const ent = await studentEntitlement(pool, req.user.ma, bkt.MaKH);
      if (!ent.dk) throw forbidden('Bạn cần đăng ký khóa học này để làm bài kiểm tra', 'NOT_ENROLLED');
      if (!ent.entitled) throw forbidden('Vui lòng thanh toán học phí để mở khóa bài kiểm tra', 'UNPAID');
      const [[s]] = await pool.query(
        `SELECT COUNT(*) AS n, MAX(DiemSo) AS hi, COALESCE(MAX(LanLam),0) AS maxLan, MAX(ThoiGianLam) AS cuoi,
                TIMESTAMPDIFF(SECOND, MAX(ThoiGianLam), NOW()) AS truoc
           FROM KET_QUA WHERE MaDK=? AND MaBKT=?`, [ent.dk.MaDK, bkt.MaBKT]);
      out.daLam = s.n; out.diemCao = s.hi != null ? Number(s.hi) : null; out.dat = out.diemCao != null && out.diemCao >= passOf(bkt.DiemToiDa);
      if (bkt.SoLanLamToiDa && s.n >= bkt.SoLanLamToiDa) out.conLuot = false;
      if (out.conLuot) {
        if (s.truoc != null && s.truoc < COOLDOWN_S) {
          const wait = COOLDOWN_S - s.truoc;
          res.setHeader('Retry-After', String(wait));
          throw new AppError(429, `Hãy xem lại bài học và thử lại sau ${wait} giây.`, 'QUIZ_COOLDOWN', { retryAfter: wait });
        }
        out.startToken = attemptToken(req.user.ma, bkt.MaBKT, s.maxLan + 1);
      }
    } else if (!owner && !isAdmin(req.user)) {
      throw forbidden('Bạn không có quyền xem bài kiểm tra này');
    }
    res.json(out);
  } catch (e) { fail(res, e); }
});

// POST /api/quizzes/:maBKT/submit — học viên nộp bài, hệ thống tự chấm
router.post('/:maBKT/submit', auth, async (req, res) => {
  try {
    if (req.user.role !== 'student') throw forbidden('Chỉ học viên mới làm bài kiểm tra');
    const maBKT = v.code(req.params.maBKT, 'Mã bài kiểm tra');
    const answers = Array.isArray(req.body.answers) ? req.body.answers.slice(0, 60) : [];
    const bkt = await bktInfo(maBKT);
    if (!bkt || bkt.TrangThai !== 'active' || bkt.TrangThaiKH !== 'published') throw notFound('Không tìm thấy bài kiểm tra');
    const ent = await studentEntitlement(pool, req.user.ma, bkt.MaKH);
    if (!ent.dk) throw forbidden('Bạn chưa đăng ký khóa học này', 'NOT_ENROLLED');
    if (!ent.entitled) throw forbidden('Vui lòng thanh toán học phí để mở khóa bài kiểm tra', 'UNPAID');

    // token phiên làm bài
    let tk;
    try { tk = jwt.verify(String(req.body.startToken || ''), cfg.jwtSecret, { algorithms: ['HS256'] }); }
    catch (e) { throw new AppError(400, 'Phiên làm bài không hợp lệ. Hãy mở lại bài kiểm tra rồi làm lại.', 'BAD_ATTEMPT'); }
    if (tk.typ !== 'quiz' || tk.sub !== req.user.ma || tk.b !== maBKT)
      throw new AppError(400, 'Phiên làm bài không hợp lệ. Hãy mở lại bài kiểm tra rồi làm lại.', 'BAD_ATTEMPT');
    const elapsed = Math.floor(Date.now() / 1000) - tk.iat;
    if (elapsed > bkt.ThoiGian * 60 + cfg.quizGraceSeconds)
      throw new AppError(400, 'Đã quá thời gian làm bài nên kết quả không được ghi nhận. Hãy mở lại bài kiểm tra để làm lại.', 'QUIZ_TIMEOUT');

    const questions = parseQ(bkt.NoiDungBKT);
    if (!questions.length) throw new AppError(400, 'Bài kiểm tra chưa có câu hỏi', 'EMPTY_QUIZ');
    if (elapsed < MIN_S_PER_Q * questions.length)
      throw new AppError(400, 'Bạn nộp bài quá nhanh. Hãy đọc kỹ câu hỏi rồi trả lời.', 'QUIZ_TOO_FAST');

    let correct = 0;
    const dung = questions.map((q, i) => {
      const a = answers[i];
      const ok = Number.isInteger(a) && a === Number(q.dap);
      if (ok) correct++;
      return ok;
    });
    const diemToiDa = Number(bkt.DiemToiDa);
    const diemSo = Math.round((correct / questions.length) * diemToiDa * 100) / 100;

    const out = await withTx(pool, async (conn) => {
      await conn.query('SELECT MaDK FROM DANG_KY WHERE MaDK=? FOR UPDATE', [ent.dk.MaDK]); // tuần tự hóa các lần nộp của cùng 1 lượt đăng ký
      const [[cnt]] = await conn.query(
        'SELECT COUNT(*) AS n, COALESCE(MAX(LanLam),0) AS maxLan FROM KET_QUA WHERE MaDK=? AND MaBKT=?', [ent.dk.MaDK, maBKT]);
      if (bkt.SoLanLamToiDa && cnt.n >= bkt.SoLanLamToiDa)
        throw new AppError(400, `Bạn đã dùng hết ${bkt.SoLanLamToiDa} lượt làm bài`, 'NO_ATTEMPTS_LEFT');
      if (tk.l !== cnt.maxLan + 1)
        throw new AppError(400, 'Bài làm này đã được nộp hoặc phiên đã cũ. Hãy mở lại bài kiểm tra.', 'STALE_ATTEMPT');
      const lanLam = cnt.maxLan + 1;
      const MaKQ = await insertWithCode(pool, 'KET_QUA', 'MaKQ', 'KQ', (code) =>
        conn.query('INSERT INTO KET_QUA(MaKQ,MaDK,MaBKT,LanLam,DiemSo) VALUES(?,?,?,?,?)', [code, ent.dk.MaDK, maBKT, lanLam, diemSo]));
      return { MaKQ, lanLam, daLam: cnt.n + 1 };
    });

    // làm bài xong có thể đủ điều kiện hoàn thành khóa (tiến độ 100% + điểm TB >= 7) → đồng bộ + cấp chứng chỉ
    const st = await syncEnrollment(pool, ent.dk.MaDK);

    const conLuot = !bkt.SoLanLamToiDa || out.daLam < bkt.SoLanLamToiDa;
    const dat = diemSo >= passOf(diemToiDa);
    const mo = dat || !conLuot; // chỉ tiết lộ đáp án khi đã đạt hoặc hết lượt
    res.json({
      MaKQ: out.MaKQ, DiemSo: diemSo, DiemToiDa: diemToiDa, SoCauDung: correct, TongCau: questions.length, LanLam: out.lanLam,
      conLuot, dat,
      daMoDapAn: mo,
      ketQua: mo ? dung : null,
      dapAnDung: mo ? questions.map((q) => Number(q.dap)) : null,
      trangThaiDangKy: st.trangThai, capChungChi: st.capChungChi,
    });
  } catch (e) { fail(res, e); }
});

// POST /api/quizzes/lesson/:maBH — giảng viên tạo bài kiểm tra cho 1 bài học
router.post('/lesson/:maBH', auth, teacherOnly, async (req, res) => {
  try {
    const maBH = v.code(req.params.maBH, 'Mã bài học');
    const [[bh]] = await pool.query(
      'SELECT bh.MaBH, kh.MaGV FROM BAI_HOC bh JOIN KHOA_HOC kh ON kh.MaKH=bh.MaKH WHERE bh.MaBH=?', [maBH]);
    if (!bh || bh.MaGV !== req.user.ma) throw forbidden('Bạn không có quyền');

    const ten = v.text(req.body.TenBKT, { name: 'Tên bài kiểm tra', min: 1, max: 150 });
    const qs = v.questions(req.body.cauHoi);
    const tg = v.int(req.body.ThoiGian === undefined || req.body.ThoiGian === '' ? 10 : req.body.ThoiGian, { name: 'Thời gian', min: 1, max: 300 });
    const max = v.int(req.body.SoLanLamToiDa, { name: 'Số lượt tối đa', min: 1, max: 100, required: false });
    const diemToiDa = v.int(req.body.DiemToiDa === undefined || req.body.DiemToiDa === '' ? 10 : req.body.DiemToiDa, { name: 'Điểm tối đa', min: 1, max: 1000 });

    const MaBKT = await insertWithCode(pool, 'BAI_KIEM_TRA', 'MaBKT', 'BKT', (code) => pool.query(
      `INSERT INTO BAI_KIEM_TRA(MaBKT,MaBH,TenBKT,NoiDungBKT,ThoiGian,TrangThai,SoLanLamToiDa,DiemToiDa)
       VALUES(?,?,?,?,?,?,?,?)`, [code, maBH, ten, JSON.stringify(qs), tg, 'active', max, diemToiDa]));
    res.json({ MaBKT });
  } catch (e) { fail(res, e); }
});

// PUT /api/quizzes/:maBKT — giảng viên sửa bài kiểm tra
router.put('/:maBKT', auth, teacherOnly, async (req, res) => {
  try {
    const maBKT = v.code(req.params.maBKT, 'Mã bài kiểm tra');
    const bkt = await bktInfo(maBKT);
    if (!bkt || bkt.MaGV !== req.user.ma) throw forbidden('Bạn không có quyền');
    const b = req.body;
    const ten = b.TenBKT === undefined ? bkt.TenBKT : v.text(b.TenBKT, { name: 'Tên bài kiểm tra', min: 1, max: 150 });
    const qs = b.cauHoi === undefined ? v.questions(parseQ(bkt.NoiDungBKT)) : v.questions(b.cauHoi);
    const tg = b.ThoiGian === undefined || b.ThoiGian === '' ? bkt.ThoiGian : v.int(b.ThoiGian, { name: 'Thời gian', min: 1, max: 300 });
    const max = b.SoLanLamToiDa === undefined ? bkt.SoLanLamToiDa : v.int(b.SoLanLamToiDa, { name: 'Số lượt tối đa', min: 1, max: 100, required: false });
    const diemToiDa = b.DiemToiDa === undefined || b.DiemToiDa === '' ? bkt.DiemToiDa : v.int(b.DiemToiDa, { name: 'Điểm tối đa', min: 1, max: 1000 });
    const st = b.TrangThai === undefined ? bkt.TrangThai : v.oneOf(b.TrangThai, ['active', 'inactive'], 'Trạng thái');
    await pool.query(
      'UPDATE BAI_KIEM_TRA SET TenBKT=?,NoiDungBKT=?,ThoiGian=?,SoLanLamToiDa=?,DiemToiDa=?,TrangThai=? WHERE MaBKT=?',
      [ten, JSON.stringify(qs), tg, max, diemToiDa, st, maBKT]);
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

// DELETE /api/quizzes/:maBKT — giảng viên xóa bài kiểm tra (kèm toàn bộ kết quả — UI đã cảnh báo). Trong 1 transaction.
router.delete('/:maBKT', auth, teacherOnly, async (req, res) => {
  try {
    const maBKT = v.code(req.params.maBKT, 'Mã bài kiểm tra');
    const bkt = await bktInfo(maBKT);
    if (!bkt || bkt.MaGV !== req.user.ma) throw forbidden('Bạn không có quyền');
    const n = await withTx(pool, async (conn) => {
      const [d] = await conn.query('DELETE FROM KET_QUA WHERE MaBKT = ?', [maBKT]);
      await conn.query('DELETE FROM BAI_KIEM_TRA WHERE MaBKT = ?', [maBKT]);
      return d.affectedRows;
    });
    console.info(`[N9][audit] giảng viên ${req.user.ma} xóa bài kiểm tra ${maBKT} (kèm ${n} kết quả)`);
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

module.exports = router;
