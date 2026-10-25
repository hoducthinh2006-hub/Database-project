const router = require('express').Router();
const pool = require('../config/db');
const cfg = require('../config/env');
const { auth, studentOnly } = require('../middleware/auth');
const { insertWithCode } = require('../utils/id');
const { withTx } = require('../utils/tx');
const { syncEnrollment } = require('../utils/enrollment');
const { studentEntitlement } = require('../utils/access');
const { courseBoards, globalBoard } = require('../utils/ranking');
const { AppError, bad, forbidden, notFound, conflict, fail } = require('../utils/http');
const v = require('../utils/validate');

router.use(auth, studentOnly);

// ─────────────────────────────────────────────
// GET /api/student/overview — toàn bộ dữ liệu cho "Học tập của tôi":
// khóa học của tôi (tiến độ, điểm, hạng, chứng chỉ, thanh toán, đánh giá),
// số liệu tổng hợp và dòng hoạt động gần đây.
// Dùng lại các view V_TIEN_DO / V_DIEM_TB / V_LAN_DANG_KY của nhóm.
// ─────────────────────────────────────────────
router.get('/overview', async (req, res) => {
  try {
    const maHV = req.user.ma;

    const [courses] = await pool.query(`
      SELECT dk.MaDK, dk.MaKH, kh.TenKH, kh.LinhVuc, kh.TrinhDo, kh.ThoiLuong, gv.HoTen AS TenGV,
             dk.HocPhi, dk.NgayDangKy, dk.TTDangKy,
             lan.LanDangKy,
             td.TongSoBai, td.SoBaiHoanThanh, COALESCE(td.TienDoPhanTram, 0) AS TienDoPhanTram,
             dtb.DiemTrungBinh AS DiemTB,
             (SELECT COUNT(*) FROM BAI_KIEM_TRA bkt JOIN BAI_HOC bh ON bh.MaBH = bkt.MaBH
               WHERE bh.MaKH = dk.MaKH AND bkt.TrangThai = 'active') AS SoBaiKT,
             (SELECT COUNT(DISTINCT kq.MaBKT) FROM KET_QUA kq WHERE kq.MaDK = dk.MaDK) AS SoBaiKTDaLam,
             (SELECT MAX(ls.ThoiDiemHoc) FROM LICH_SU_HOC_TAP ls WHERE ls.MaDK = dk.MaDK) AS HoatDongCuoi,
             cc.MaCC, cc.NgayCap, cc.HieuLuc,
             EXISTS(SELECT 1 FROM THANH_TOAN tt WHERE tt.MaDK = dk.MaDK AND tt.TrangThaiTT = 'success') AS DaThanhToan,
             EXISTS(SELECT 1 FROM THANH_TOAN tt WHERE tt.MaDK = dk.MaDK AND tt.TrangThaiTT = 'pending') AS DangChoDuyet,
             dg.DiemDanhGia, dg.NhanXet AS NhanXetCuaToi
      FROM DANG_KY dk
      JOIN KHOA_HOC kh        ON kh.MaKH = dk.MaKH
      JOIN GIANG_VIEN gv      ON gv.MaGV = kh.MaGV
      JOIN V_TIEN_DO td       ON td.MaDK = dk.MaDK
      JOIN V_LAN_DANG_KY lan  ON lan.MaDK = dk.MaDK
      LEFT JOIN V_DIEM_TB dtb ON dtb.MaDK = dk.MaDK
      LEFT JOIN CHUNG_CHI cc  ON cc.MaDK = dk.MaDK
      LEFT JOIN DANH_GIA dg   ON dg.MaDK = dk.MaDK
      WHERE dk.MaHV = ?
      ORDER BY dk.NgayDangKy DESC, dk.MaDK DESC`, [maHV]);

    // hạng của tôi trong từng khóa — cùng quy tắc với bảng xếp hạng (utils/ranking.js): chưa đủ ngưỡng thì chưa có hạng
    const boards = await courseBoards(pool, [...new Set(courses.map((c) => c.MaKH))], maHV);
    const rankOf = {};
    boards.forEach((b, maKH) => { const me = b.bang.find((r) => r.LaToi); if (me && me.Hang != null) rankOf[maKH] = { XepHang: me.Hang, TongSo: b.daXepHang }; });

    // bài học tiếp theo cho từng lượt đăng ký đang học
    const maKHs = [...new Set(courses.map((c) => c.MaKH))];
    const lessonsOf = {};
    if (maKHs.length) {
      const [ls] = await pool.query(
        'SELECT MaBH, MaKH, TenBH, ThuTu FROM BAI_HOC WHERE MaKH IN (?) ORDER BY MaKH, ThuTu', [maKHs]);
      ls.forEach((l) => { (lessonsOf[l.MaKH] = lessonsOf[l.MaKH] || []).push(l); });
    }
    const maDKs = courses.map((c) => c.MaDK);
    const doneOf = {};
    if (maDKs.length) {
      const [done] = await pool.query(
        `SELECT DISTINCT MaDK, MaBH FROM LICH_SU_HOC_TAP WHERE MaDK IN (?) AND TrangThaiHoanThanh = 'hoan_thanh'`, [maDKs]);
      done.forEach((d) => { (doneOf[d.MaDK] = doneOf[d.MaDK] || new Set()).add(d.MaBH); });
    }

    const list = courses.map((c) => {
      const done = doneOf[c.MaDK] || new Set();
      const next = (lessonsOf[c.MaKH] || []).find((l) => !done.has(l.MaBH)) || null;
      const rk = rankOf[c.MaKH];
      return {
        ...c,
        DaThanhToan: !!c.DaThanhToan,
        DangChoDuyet: !c.DaThanhToan && !!c.DangChoDuyet,
        DiemTB: c.DiemTB != null ? Math.round(Number(c.DiemTB) * 100) / 100 : null,
        BaiTiepTheo: next ? { MaBH: next.MaBH, TenBH: next.TenBH, ThuTu: next.ThuTu } : null,
        Hang: rk ? Number(rk.XepHang) : null,
        TongHang: rk ? Number(rk.TongSo) : null,
      };
    });

    const [[att]] = await pool.query(
      `SELECT COUNT(*) AS n FROM KET_QUA kq JOIN DANG_KY dk ON dk.MaDK = kq.MaDK WHERE dk.MaHV = ?`, [maHV]);
    const scored = list.filter((c) => c.DiemTB != null);
    const kpi = {
      DangHoc: list.filter((c) => !['hoan_thanh', 'da_huy'].includes(c.TTDangKy)).length,
      HoanThanh: list.filter((c) => c.TTDangKy === 'hoan_thanh').length,
      ChungChi: list.filter((c) => c.MaCC).length,
      DiemTB: scored.length ? Math.round(scored.reduce((s, c) => s + c.DiemTB, 0) / scored.length * 100) / 100 : null,
      SoBaiDaHoc: list.reduce((s, c) => s + Number(c.SoBaiHoanThanh || 0), 0),
      SoLanLamBai: att.n,
      TongChiTieu: list.filter((c) => c.DaThanhToan).reduce((s, c) => s + Number(c.HocPhi || 0), 0),
      ChoThanhToan: list.filter((c) => !c.DaThanhToan && Number(c.HocPhi) > 0 && c.TTDangKy !== 'da_huy').length,
    };

    // dòng hoạt động gần đây: đăng ký / hoàn thành bài / làm kiểm tra / nhận chứng chỉ
    const [hoatDong] = await pool.query(`
      (SELECT 'dang_ky' AS Loai, CAST(dk.NgayDangKy AS DATETIME) AS ThoiGian, kh.TenKH AS TieuDe, NULL AS PhuDe, kh.MaKH AS MaKH
         FROM DANG_KY dk JOIN KHOA_HOC kh ON kh.MaKH = dk.MaKH WHERE dk.MaHV = ?)
      UNION ALL
      (SELECT 'bai_hoc', ls.ThoiDiemHoc, bh.TenBH, kh.TenKH, kh.MaKH
         FROM LICH_SU_HOC_TAP ls JOIN DANG_KY dk ON dk.MaDK = ls.MaDK
         JOIN BAI_HOC bh ON bh.MaBH = ls.MaBH JOIN KHOA_HOC kh ON kh.MaKH = dk.MaKH
        WHERE dk.MaHV = ? AND ls.TrangThaiHoanThanh = 'hoan_thanh')
      UNION ALL
      (SELECT 'kiem_tra', kq.ThoiGianLam, bkt.TenBKT, CONCAT(kh.TenKH, ' · lần ', kq.LanLam, ' · ', kq.DiemSo, ' điểm'), kh.MaKH
         FROM KET_QUA kq JOIN DANG_KY dk ON dk.MaDK = kq.MaDK
         JOIN BAI_KIEM_TRA bkt ON bkt.MaBKT = kq.MaBKT JOIN BAI_HOC bh ON bh.MaBH = bkt.MaBH
         JOIN KHOA_HOC kh ON kh.MaKH = bh.MaKH
        WHERE dk.MaHV = ?)
      UNION ALL
      (SELECT 'chung_chi', CAST(cc.NgayCap AS DATETIME), kh.TenKH, NULL, kh.MaKH
         FROM CHUNG_CHI cc JOIN DANG_KY dk ON dk.MaDK = cc.MaDK JOIN KHOA_HOC kh ON kh.MaKH = dk.MaKH
        WHERE dk.MaHV = ?)
      ORDER BY ThoiGian DESC LIMIT 12`, [maHV, maHV, maHV, maHV]);

    res.json({ kpi, courses: list, hoatDong });
  } catch (e) { fail(res, e); }
});

// ─────────────────────────────────────────────
// GET /api/student/leaderboard?maKH= — bảng xếp hạng trong 1 khóa (chỉ người đang học khóa đó xem được)
// Tiêu chí (utils/ranking.js): điểm TB các bài kiểm tra (điểm cao nhất mỗi bài); cần làm ≥ 2 bài (khóa chỉ có 1 bài thì 1 bài)
// mới được xếp hạng; hòa điểm → tiến độ cao hơn → làm nhiều bài hơn → làm bài ÍT lượt hơn (đạt cùng điểm mà ít phải làm lại); bằng hết thì đồng hạng.
// ─────────────────────────────────────────────
router.get('/leaderboard', async (req, res) => {
  try {
    const maKH = v.code(req.query.maKH, 'Mã khóa học');
    const [[kh]] = await pool.query('SELECT MaKH FROM KHOA_HOC WHERE MaKH = ?', [maKH]);
    if (!kh) throw notFound('Không tìm thấy khóa học');
    const [[own]] = await pool.query(
      `SELECT 1 AS x FROM DANG_KY WHERE MaHV = ? AND MaKH = ? AND TTDangKy <> 'da_huy' LIMIT 1`, [req.user.ma, maKH]);
    if (!own) throw forbidden('Bạn cần đăng ký khóa học này để xem bảng xếp hạng');
    const board = (await courseBoards(pool, [maKH], req.user.ma)).get(maKH);
    res.json(board);
  } catch (e) { fail(res, e); }
});

// ─────────────────────────────────────────────
// GET /api/student/leaderboard/global?tieuChi=diem|chamchi&khoang=tatca|thang|tuan — bảng vàng toàn nền tảng
//   diem    : điểm TB (≥ 3 bài kiểm tra mọi lúc, ≥ 2 trong tháng, ≥ 1 trong tuần); hòa → nhiều chứng chỉ hơn → nhiều bài KT hơn
//   chamchi : số bài học hoàn thành trong khoảng thời gian
// ─────────────────────────────────────────────
router.get('/leaderboard/global', async (req, res) => {
  try {
    const tieuChi = v.oneOf(req.query.tieuChi || 'diem', ['diem', 'chamchi'], 'Tiêu chí xếp hạng');
    const khoang = v.oneOf(req.query.khoang || 'tatca', ['tatca', 'thang', 'tuan'], 'Khoảng thời gian');
    res.json(await globalBoard(pool, { tieuChi, khoang }, req.user.ma));
  } catch (e) { fail(res, e); }
});

// ─────────────────────────────────────────────
// GET /api/student/results — lịch sử làm bài kiểm tra + bài chưa làm
// ─────────────────────────────────────────────
router.get('/results', async (req, res) => {
  try {
    const maHV = req.user.ma;
    const [lanLam] = await pool.query(`
      SELECT kq.MaKQ, kq.MaDK, kq.MaBKT, bkt.TenBKT, bkt.SoLanLamToiDa, bh.TenBH,
             kh.MaKH, kh.TenKH, kq.LanLam, kq.DiemSo, kq.ThoiGianLam, lan.LanDangKy
      FROM KET_QUA kq
      JOIN DANG_KY dk       ON dk.MaDK = kq.MaDK
      JOIN V_LAN_DANG_KY lan ON lan.MaDK = dk.MaDK
      JOIN BAI_KIEM_TRA bkt ON bkt.MaBKT = kq.MaBKT
      JOIN BAI_HOC bh       ON bh.MaBH = bkt.MaBH
      JOIN KHOA_HOC kh      ON kh.MaKH = bh.MaKH
      WHERE dk.MaHV = ?
      ORDER BY kq.ThoiGianLam DESC`, [maHV]);

    const [chuaLam] = await pool.query(`
      SELECT bkt.MaBKT, bkt.TenBKT, bh.TenBH, kh.MaKH, kh.TenKH, bkt.ThoiGian
      FROM DANG_KY dk
      JOIN KHOA_HOC kh      ON kh.MaKH = dk.MaKH
      JOIN BAI_HOC bh       ON bh.MaKH = kh.MaKH
      JOIN BAI_KIEM_TRA bkt ON bkt.MaBH = bh.MaBH
      WHERE dk.MaHV = ? AND dk.TTDangKy NOT IN ('da_huy','hoan_thanh') AND bkt.TrangThai = 'active'
        AND NOT EXISTS (SELECT 1 FROM KET_QUA kq WHERE kq.MaDK = dk.MaDK AND kq.MaBKT = bkt.MaBKT)
      GROUP BY bkt.MaBKT, bkt.TenBKT, bh.TenBH, kh.MaKH, kh.TenKH, bkt.ThoiGian
      ORDER BY kh.MaKH, bh.ThuTu`, [maHV]);

    res.json({ lanLam: lanLam.map((r) => ({ ...r, DiemSo: Number(r.DiemSo) })), chuaLam });
  } catch (e) { fail(res, e); }
});

// ─────────────────────────────────────────────
// THANH TOÁN (mô phỏng cổng thanh toán — chỉ ghi nhận giao dịch thành công)
// ─────────────────────────────────────────────
router.get('/payments', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT tt.MaTT, tt.MaDK, kh.TenKH, dk.HocPhi, tt.PhuongThucTT, tt.LoaiGiaoDich, tt.ThoiGian, tt.TrangThaiTT
      FROM THANH_TOAN tt
      JOIN DANG_KY dk  ON dk.MaDK = tt.MaDK
      JOIN KHOA_HOC kh ON kh.MaKH = dk.MaKH
      WHERE dk.MaHV = ?
      ORDER BY tt.ThoiGian DESC`, [req.user.ma]);
    res.json(rows);
  } catch (e) { fail(res, e); }
});

const PAY_METHODS = ['Chuyển khoản', 'Thẻ tín dụng', 'Ví điện tử'];
// Học viên gửi yêu cầu thanh toán → ghi 'pending', CHƯA mở khóa nội dung.
// Admin đối soát (nhận được tiền thật qua QR, hoặc theo quy trình riêng) rồi duyệt ở trang quản trị
// (POST /api/admin/payments/:maTT/approve) mới đổi thành 'success' và mở khóa (xem utils/access.js).
// Khóa dòng đăng ký trong transaction → bấm "Gửi yêu cầu" 2 lần cùng lúc cũng chỉ ghi 1 giao dịch
// (CSDL còn có trigger trg_mot_lan_thanh_toan làm lưới an toàn thứ hai cho dòng 'success').
router.post('/payments', async (req, res) => {
  try {
    const maDK = v.code(req.body.maDK, 'Mã đăng ký');
    const phuongThuc = v.oneOf(req.body.phuongThuc, PAY_METHODS, 'Phương thức thanh toán');
    const MaTT = await withTx(pool, async (conn) => {
      const [[dk]] = await conn.query('SELECT MaDK, MaHV, HocPhi, TTDangKy FROM DANG_KY WHERE MaDK = ? FOR UPDATE', [maDK]);
      if (!dk || dk.MaHV !== req.user.ma) throw notFound('Không tìm thấy lượt đăng ký');
      if (dk.TTDangKy === 'da_huy') throw bad('Lượt đăng ký đã bị hủy');
      if (Number(dk.HocPhi) <= 0) throw bad('Khóa học miễn phí, không cần thanh toán');
      const [[paid]] = await conn.query(`SELECT 1 AS x FROM THANH_TOAN WHERE MaDK = ? AND TrangThaiTT = 'success'`, [maDK]);
      if (paid) throw conflict('Lượt đăng ký này đã được thanh toán', 'ALREADY_PAID');
      const [[pending]] = await conn.query(`SELECT 1 AS x FROM THANH_TOAN WHERE MaDK = ? AND TrangThaiTT = 'pending'`, [maDK]);
      if (pending) throw conflict('Bạn đã gửi yêu cầu thanh toán trước đó, đang chờ admin xác nhận', 'ALREADY_PENDING');
      const code = await insertWithCode(pool, 'THANH_TOAN', 'MaTT', 'TT', (c) => conn.query(
        `INSERT INTO THANH_TOAN(MaTT, MaDK, PhuongThucTT, LoaiGiaoDich, TrangThaiTT) VALUES(?,?,?,'thanh_toan','pending')`,
        [c, maDK, phuongThuc]));
      if (dk.TTDangKy === 'cho_xac_nhan') await conn.query(`UPDATE DANG_KY SET TTDangKy = 'da_xac_nhan' WHERE MaDK = ?`, [maDK]);
      return code;
    });
    res.json({ MaTT, trangThai: 'pending' });
  } catch (e) { fail(res, e); }
});

// Mã QR "Chuyển khoản" thật (VietQR) để hiện trong modal thanh toán — chỉ trả URL ảnh, không lưu gì thêm.
// Thiếu cấu hình BANK_* trong .env → configured:false, frontend tự ẩn QR và chỉ còn phương thức mô phỏng.
router.get('/payments/:maDK/qr', async (req, res) => {
  try {
    const maDK = v.code(req.params.maDK, 'Mã đăng ký');
    if (!cfg.bank.bin || !cfg.bank.stk) return res.json({ configured: false });
    const [[dk]] = await pool.query(
      `SELECT dk.MaDK, dk.MaHV, dk.HocPhi, dk.TTDangKy, kh.TenKH FROM DANG_KY dk JOIN KHOA_HOC kh ON kh.MaKH = dk.MaKH WHERE dk.MaDK = ?`, [maDK]);
    if (!dk || dk.MaHV !== req.user.ma) throw notFound('Không tìm thấy lượt đăng ký');
    if (dk.TTDangKy === 'da_huy') throw bad('Lượt đăng ký đã bị hủy');
    if (Number(dk.HocPhi) <= 0) throw bad('Khóa học miễn phí, không cần thanh toán');
    const [[paid]] = await pool.query(`SELECT 1 AS x FROM THANH_TOAN WHERE MaDK = ? AND TrangThaiTT = 'success'`, [maDK]);
    if (paid) throw conflict('Lượt đăng ký này đã được thanh toán', 'ALREADY_PAID');
    const soTien = Math.round(Number(dk.HocPhi));
    const noiDung = maDK; // nội dung CK = đúng mã đăng ký, để đối soát thủ công bằng cách tra DANG_KY.MaDK
    const qrUrl = `https://img.vietqr.io/image/${encodeURIComponent(cfg.bank.bin)}-${encodeURIComponent(cfg.bank.stk)}-${encodeURIComponent(cfg.bank.template)}.png`
      + `?amount=${soTien}&addInfo=${encodeURIComponent(noiDung)}&accountName=${encodeURIComponent(cfg.bank.ten)}`;
    res.json({ configured: true, qrUrl, soTK: cfg.bank.stk, tenTK: cfg.bank.ten, tenNH: cfg.bank.tenNH, noiDung, soTien });
  } catch (e) { fail(res, e); }
});

// ─────────────────────────────────────────────
// ĐÁNH GIÁ KHÓA HỌC — mỗi lượt đăng ký tối đa 1 đánh giá (DANH_GIA.MaDK UNIQUE) → thêm hoặc sửa
// Chỉ người ĐÃ HỌC (có hoạt động thật) mới được đánh giá: không thể đăng ký rồi chấm sao ngay để thao túng điểm.
// ─────────────────────────────────────────────
router.post('/reviews', async (req, res) => {
  try {
    const maDK = v.code(req.body.maDK, 'Mã đăng ký');
    const d = v.int(req.body.diem, { name: 'Điểm đánh giá', min: 1, max: 5 });
    const text = v.paragraph(req.body.nhanXet, { name: 'Nhận xét', max: 1000 });
    const [[dk]] = await pool.query('SELECT MaDK, MaHV, TTDangKy FROM DANG_KY WHERE MaDK = ?', [maDK]);
    if (!dk || dk.MaHV !== req.user.ma) throw notFound('Không tìm thấy lượt đăng ký');
    if (dk.TTDangKy === 'da_huy') throw bad('Không thể đánh giá lượt đăng ký đã hủy');
    if (!['dang_hoc', 'hoan_thanh'].includes(dk.TTDangKy)) throw forbidden('Hãy học ít nhất một bài trước khi đánh giá khóa học', 'NOT_STARTED');

    const [[cur]] = await pool.query('SELECT MaDG FROM DANH_GIA WHERE MaDK = ?', [maDK]);
    if (cur) {
      await pool.query('UPDATE DANH_GIA SET DiemDanhGia = ?, NhanXet = ?, NgayDG = CURRENT_DATE WHERE MaDG = ?', [d, text, cur.MaDG]);
      return res.json({ MaDG: cur.MaDG, updated: true });
    }
    const MaDG = await insertWithCode(pool, 'DANH_GIA', 'MaDG', 'DG', (code) =>
      pool.query('INSERT INTO DANH_GIA(MaDG, MaDK, DiemDanhGia, NhanXet) VALUES(?,?,?,?)', [code, maDK, d, text]));
    res.json({ MaDG, updated: false });
  } catch (e) {
    if (e && e.code === 'ER_DUP_ENTRY') return fail(res, conflict('Bạn đã đánh giá khóa học này rồi — hãy tải lại trang để sửa đánh giá'));
    fail(res, e);
  }
});

// ─────────────────────────────────────────────
// HỌC BÀI: "mở bài" rồi "đánh dấu xong". Chống bấm lướt cho xong: phải đủ quyền học, và phải học tối thiểu vài chục giây
// (LESSON_MIN_SECONDS, tối đa 10% thời lượng bài) tính từ lúc mở bài thì mới được đánh dấu hoàn thành.
// ─────────────────────────────────────────────
async function lessonContext(req) {
  const maBH = v.code(req.params.maBH, 'Mã bài học');
  const [[bh]] = await pool.query(
    `SELECT bh.MaBH, bh.MaKH, bh.ThoiLuong FROM BAI_HOC bh JOIN KHOA_HOC kh ON kh.MaKH = bh.MaKH
      WHERE bh.MaBH = ? AND kh.TrangThai = 'published'`, [maBH]);
  if (!bh) throw notFound('Không tìm thấy bài học');
  const ent = await studentEntitlement(pool, req.user.ma, bh.MaKH);
  if (!ent.dk) throw forbidden('Bạn chưa đăng ký khóa học này', 'NOT_ENROLLED');
  if (!ent.entitled) throw forbidden('Vui lòng thanh toán học phí để mở khóa bài học', 'UNPAID');
  const need = cfg.lessonMinSeconds === 0 ? 0
    : Math.min(cfg.lessonMinSeconds, Math.max(3, Math.round((Number(bh.ThoiLuong) || 0) * 6)));
  return { bh, dk: ent.dk, need };
}
const OPEN_STATES = `('dang_hoc','chua_hoan_thanh')`;

// POST /api/student/lessons/:maBH/open — ghi nhận đã mở bài (idempotent). Trả số giây còn phải học trước khi được đánh dấu xong.
router.post('/lessons/:maBH/open', async (req, res) => {
  try {
    const { bh, dk, need } = await lessonContext(req);
    const [[done]] = await pool.query(
      `SELECT 1 AS x FROM LICH_SU_HOC_TAP WHERE MaDK = ? AND MaBH = ? AND TrangThaiHoanThanh = 'hoan_thanh' LIMIT 1`, [dk.MaDK, bh.MaBH]);
    if (done) return res.json({ ok: true, daXong: true, conLai: 0, can: need });
    let [[op]] = await pool.query(
      `SELECT MaLSHT, TIMESTAMPDIFF(SECOND, ThoiDiemHoc, NOW()) AS giay FROM LICH_SU_HOC_TAP
        WHERE MaDK = ? AND MaBH = ? AND TrangThaiHoanThanh IN ${OPEN_STATES} ORDER BY ThoiDiemHoc ASC LIMIT 1`, [dk.MaDK, bh.MaBH]);
    if (!op) {
      await insertWithCode(pool, 'LICH_SU_HOC_TAP', 'MaLSHT', 'LS', (code) => pool.query(
        `INSERT INTO LICH_SU_HOC_TAP(MaLSHT, MaDK, MaBH, TienDoTangThem, TrangThaiHoanThanh) VALUES(?,?,?,0,'dang_hoc')`, [code, dk.MaDK, bh.MaBH]));
      op = { giay: 0 };
      await syncEnrollment(pool, dk.MaDK); // hoạt động đầu tiên → chuyển sang 'dang_hoc'
    }
    res.json({ ok: true, daXong: false, conLai: Math.max(0, need - (op.giay || 0)), can: need });
  } catch (e) { fail(res, e); }
});

// POST /api/student/lessons/:maBH/complete — đánh dấu đã học xong 1 bài (idempotent)
// Ghi LICH_SU_HOC_TAP rồi đồng bộ trạng thái đăng ký (có thể hoàn thành khóa + cấp chứng chỉ).
router.post('/lessons/:maBH/complete', async (req, res) => {
  try {
    const { bh, dk, need } = await lessonContext(req);
    const [[tong]] = await pool.query('SELECT COUNT(*) AS n FROM BAI_HOC WHERE MaKH = ?', [bh.MaKH]);
    const [[da]] = await pool.query(
      `SELECT 1 AS x FROM LICH_SU_HOC_TAP WHERE MaDK = ? AND MaBH = ? AND TrangThaiHoanThanh = 'hoan_thanh' LIMIT 1`, [dk.MaDK, bh.MaBH]);
    if (!da) {
      const [[op]] = await pool.query(
        `SELECT MaLSHT, TIMESTAMPDIFF(SECOND, ThoiDiemHoc, NOW()) AS giay FROM LICH_SU_HOC_TAP
          WHERE MaDK = ? AND MaBH = ? AND TrangThaiHoanThanh IN ${OPEN_STATES} ORDER BY ThoiDiemHoc ASC LIMIT 1`, [dk.MaDK, bh.MaBH]);
      if (need > 0) {
        if (!op) throw new AppError(400, 'Hãy mở bài học và học trước khi đánh dấu hoàn thành', 'LESSON_NOT_OPENED');
        if (op.giay < need) {
          const wait = need - op.giay;
          res.setHeader('Retry-After', String(wait));
          throw new AppError(429, `Hãy học bài này thêm ${wait} giây nữa rồi đánh dấu hoàn thành.`, 'LESSON_TOO_SOON', { retryAfter: wait });
        }
      }
      const tang = tong.n ? Math.round((100 / tong.n) * 100) / 100 : 0;
      if (op) {
        await pool.query(
          `UPDATE LICH_SU_HOC_TAP SET TrangThaiHoanThanh = 'hoan_thanh', TienDoTangThem = ?, ThoiDiemHoc = NOW() WHERE MaLSHT = ?`, [tang, op.MaLSHT]);
      } else {
        await insertWithCode(pool, 'LICH_SU_HOC_TAP', 'MaLSHT', 'LS', (code) => pool.query(
          `INSERT INTO LICH_SU_HOC_TAP(MaLSHT, MaDK, MaBH, TienDoTangThem, TrangThaiHoanThanh) VALUES(?,?,?,?, 'hoan_thanh')`,
          [code, dk.MaDK, bh.MaBH, tang]));
      }
    }
    const st = await syncEnrollment(pool, dk.MaDK);
    const [[xong]] = await pool.query(
      `SELECT COUNT(DISTINCT MaBH) AS n FROM LICH_SU_HOC_TAP WHERE MaDK = ? AND TrangThaiHoanThanh = 'hoan_thanh'`, [dk.MaDK]);
    res.json({
      MaDK: dk.MaDK, soBaiHoanThanh: xong.n, tongSoBai: tong.n,
      tienDo: tong.n ? Math.round((xong.n / tong.n) * 1000) / 10 : 0,
      trangThai: st.trangThai, capChungChi: st.capChungChi, already: !!da,
    });
  } catch (e) { fail(res, e); }
});

module.exports = router;
