const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { insertWithCode } = require('../utils/id');
const { auth, signToken, invalidateAccount } = require('../middleware/auth');
const { registerLimiter, loginByPair, loginByIp, passwordByUser, clientIp, fmtWait } = require('../middleware/security');
const { AppError, bad, fail } = require('../utils/http');
const v = require('../utils/validate');
const pw = require('../utils/password');

const ACCOUNT = { student: ['HOC_VIEN', 'MaHV'], teacher: ['GIANG_VIEN', 'MaGV'], admin: ['ADMIN', 'MaAD'] };
const ROLE_ORDER = { student: 0, teacher: 1, admin: 2 };

// POST /api/auth/register
// CHỈ học viên tự đăng ký công khai — đúng mô hình kinh doanh của nhóm: admin trực tiếp thuê & cấp tài khoản
// cho giảng viên (xem POST /api/admin/teachers), không mở cổng tự đăng ký cho giảng viên để kiểm soát chất lượng nội dung.
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const hoTen = v.text(req.body.hoTen, { name: 'Họ tên', min: 2, max: 100 });
    const mail = v.email(req.body.email);
    pw.checkNewPassword(req.body.matKhau, { email: mail, name: hoTen });

    // Email phải chưa tồn tại ở BẤT KỲ bảng tài khoản nào
    const [[dup]] = await pool.query(
      `SELECT (SELECT COUNT(*) FROM HOC_VIEN WHERE Email=?) + (SELECT COUNT(*) FROM GIANG_VIEN WHERE Email=?) + (SELECT COUNT(*) FROM ADMIN WHERE Email=?) AS n`,
      [mail, mail, mail]);
    if (dup.n) throw new AppError(409, 'Email này đã được đăng ký', 'DUPLICATE');

    const hash = await pw.hash(req.body.matKhau);
    const ma = await insertWithCode(pool, 'HOC_VIEN', 'MaHV', 'HV', (code) =>
      pool.query('INSERT INTO HOC_VIEN(MaHV,HoTen,Email,MatKhauHash) VALUES(?,?,?,?)', [code, hoTen, mail, hash]));
    const user = { id: ma, ten: hoTen, email: mail, role: 'student', ma };
    res.json({ token: signToken(user, hash), user });
  } catch (e) { fail(res, e); }
});

// POST /api/auth/login — tìm email ở HOC_VIEN trước, rồi GIANG_VIEN, rồi ADMIN
// Chống dò mật khẩu: khóa tạm sau nhiều lần sai (theo IP+email và theo IP); luôn chạy bcrypt dù email không tồn tại
// để không phân biệt được "email có tài khoản" qua độ trễ phản hồi.
router.post('/login', async (req, res) => {
  try {
    const mail = String(typeof req.body.email === 'string' ? req.body.email : '').toLowerCase().trim().slice(0, 100);
    const pass = typeof req.body.matKhau === 'string' ? req.body.matKhau.slice(0, 200) : '';
    const ip = clientIp(req), kPair = `${ip}|${mail}`;

    const wait = Math.max(loginByPair.wait(kPair), loginByIp.wait(ip));
    if (wait) {
      res.setHeader('Retry-After', String(wait));
      throw new AppError(429, `Đăng nhập sai quá nhiều lần. Thử lại sau ${fmtWait(wait)}.`, 'LOGIN_LOCKED', { retryAfter: wait });
    }

    const [rows] = await pool.query(
      `SELECT 'student' AS role, MaHV AS ma, HoTen, Email, MatKhauHash, TrangThaiTK FROM HOC_VIEN WHERE Email=?
       UNION ALL SELECT 'teacher', MaGV, HoTen, Email, MatKhauHash, TrangThaiTK FROM GIANG_VIEN WHERE Email=?
       UNION ALL SELECT 'admin', MaAD, HoTen, Email, MatKhauHash, 'active' FROM ADMIN WHERE Email=?`,
      [mail, mail, mail]);
    const acc = rows.sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role])[0] || null;

    const ok = await bcrypt.compare(pass, (acc && acc.MatKhauHash) || pw.DUMMY_HASH);
    if (!acc || !ok) {
      loginByPair.fail(kPair); loginByIp.fail(ip);
      throw new AppError(401, 'Email hoặc mật khẩu không đúng', 'BAD_CREDENTIALS');
    }
    if (acc.TrangThaiTK && acc.TrangThaiTK !== 'active')
      throw new AppError(403, 'Tài khoản đã bị khóa. Liên hệ quản trị viên để biết thêm.', 'ACCOUNT_SUSPENDED');

    loginByPair.ok(kPair);
    const user = { id: acc.ma, ten: acc.HoTen, email: acc.Email, role: acc.role, ma: acc.ma };
    res.json({ token: signToken(user, acc.MatKhauHash), user });
  } catch (e) { fail(res, e); }
});

// GET /api/auth/me — hồ sơ đầy đủ của người đang đăng nhập + vài số liệu nhanh.
// Tách riêng khỏi JWT payload (chỉ có id/ten/email/role) vì profile cần SDT,
// ngày sinh, chuyên môn... là dữ liệu có thể đổi, không nên "đóng băng" trong token.
router.get('/me', auth, async (req, res) => {
  try {
    const { role, ma } = req.user;
    if (role === 'student') {
      const [[hv]] = await pool.query(
        'SELECT MaHV AS ma, HoTen, Email, SoDienThoai, NgaySinh, NgayDK, TrangThaiTK FROM HOC_VIEN WHERE MaHV=?', [ma]);
      if (!hv) return res.status(404).json({ error: 'Không tìm thấy hồ sơ', code: 'NOT_FOUND' });
      const [[stat]] = await pool.query(
        `SELECT COUNT(*) AS SoKhoaHocDaDK,
                COALESCE(SUM(CASE WHEN TTDangKy='hoan_thanh' THEN 1 ELSE 0 END), 0) AS SoKhoaHocHoanThanh
           FROM DANG_KY WHERE MaHV=?`, [ma]);
      const [[cc]] = await pool.query(
        `SELECT COUNT(*) AS SoChungChi
           FROM CHUNG_CHI cc JOIN DANG_KY dk ON dk.MaDK = cc.MaDK
          WHERE dk.MaHV=? AND cc.HieuLuc='con_hieu_luc'`, [ma]);
      return res.json({ ...hv, role, ...stat, ...cc });
    }
    if (role === 'teacher') {
      const [[gv]] = await pool.query(
        'SELECT MaGV AS ma, HoTen, Email, SDT, NgaySinh, ChuyenMon, TrinhDo, TrangThaiTK FROM GIANG_VIEN WHERE MaGV=?', [ma]);
      if (!gv) return res.status(404).json({ error: 'Không tìm thấy hồ sơ', code: 'NOT_FOUND' });
      const [[stat]] = await pool.query(
        `SELECT COUNT(DISTINCT kh.MaKH) AS SoKhoaHoc,
                COUNT(DISTINCT dk.MaHV) AS SoHocVien,
                ROUND(AVG(dg.DiemDanhGia),1) AS DiemDanhGiaTB
           FROM KHOA_HOC kh
           LEFT JOIN DANG_KY dk ON dk.MaKH = kh.MaKH
           LEFT JOIN DANH_GIA dg ON dg.MaDK = dk.MaDK
          WHERE kh.MaGV=?`, [ma]);
      return res.json({ ...gv, role, ...stat });
    }
    const [[ad]] = await pool.query('SELECT MaAD AS ma, HoTen, Email FROM ADMIN WHERE MaAD=?', [ma]);
    if (!ad) return res.status(404).json({ error: 'Không tìm thấy hồ sơ', code: 'NOT_FOUND' });
    res.json({ ...ad, role });
  } catch (e) { fail(res, e); }
});

// PUT /api/auth/me — cập nhật các trường cá nhân KHÔNG nhạy cảm (không đổi
// email ở đây — email là khóa đăng nhập; đổi mật khẩu có endpoint riêng, bắt buộc nhập mật khẩu cũ).
router.put('/me', auth, async (req, res) => {
  try {
    const { role, ma } = req.user;
    if (role === 'student') {
      const sdt = v.phone(req.body.soDienThoai);
      const ns = v.date(req.body.ngaySinh, { name: 'Ngày sinh' });
      await pool.query('UPDATE HOC_VIEN SET SoDienThoai=?, NgaySinh=? WHERE MaHV=?', [sdt, ns, ma]);
    } else if (role === 'teacher') {
      const sdt = v.phone(req.body.sdt);
      const ns = v.date(req.body.ngaySinh, { name: 'Ngày sinh' });
      const cm = v.text(req.body.chuyenMon, { name: 'Chuyên môn', max: 100, required: false });
      const td = v.text(req.body.trinhDo, { name: 'Trình độ', max: 50, required: false });
      await pool.query('UPDATE GIANG_VIEN SET SDT=?, NgaySinh=?, ChuyenMon=?, TrinhDo=? WHERE MaGV=?', [sdt, ns, cm, td, ma]);
    } else {
      throw bad('Quản trị viên không có thông tin cá nhân để chỉnh sửa ở đây');
    }
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

// POST /api/auth/change-password — bắt buộc nhập đúng mật khẩu hiện tại. Thành công thì mọi token cũ (kể cả của kẻ trộm token) hết hiệu lực,
// token mới trả về để phiên hiện tại tiếp tục dùng.
router.post('/change-password', auth, async (req, res) => {
  try {
    const { role, ma } = req.user;
    const wait = passwordByUser.wait(ma);
    if (wait) {
      res.setHeader('Retry-After', String(wait));
      throw new AppError(429, `Bạn nhập sai mật khẩu hiện tại quá nhiều lần. Thử lại sau ${fmtWait(wait)}.`, 'PASSWORD_LOCKED');
    }
    const { matKhauCu, matKhauMoi } = req.body;
    if (typeof matKhauCu !== 'string' || typeof matKhauMoi !== 'string' || !matKhauCu || !matKhauMoi) throw bad('Vui lòng nhập mật khẩu hiện tại và mật khẩu mới');

    const [tbl, col] = ACCOUNT[role];
    const [[row]] = await pool.query(`SELECT MatKhauHash FROM ${tbl} WHERE ${col}=?`, [ma]);
    if (!row) throw new AppError(401, 'Tài khoản không còn tồn tại', 'ACCOUNT_GONE');

    const ok = await bcrypt.compare(matKhauCu.slice(0, 200), row.MatKhauHash);
    if (!ok) { passwordByUser.fail(ma); throw new AppError(400, 'Mật khẩu hiện tại không đúng', 'BAD_OLD_PASSWORD'); }
    if (matKhauMoi === matKhauCu) throw bad('Mật khẩu mới phải khác mật khẩu hiện tại');
    pw.checkNewPassword(matKhauMoi, { email: req.user.email, name: req.user.ten });

    const hash = await pw.hash(matKhauMoi);
    await pool.query(`UPDATE ${tbl} SET MatKhauHash=? WHERE ${col}=?`, [hash, ma]);
    invalidateAccount(role, ma);
    passwordByUser.ok(ma);
    console.info(`[N9][audit] ${role} ${ma} đã đổi mật khẩu`);
    res.json({ ok: true, token: signToken(req.user, hash) });
  } catch (e) { fail(res, e); }
});

module.exports = router;
