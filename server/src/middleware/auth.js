const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const cfg = require('../config/env');
const { pvOf } = require('../utils/password');
const { AppError, fail } = require('../utils/http');

/* ---------------------------------------------------------------------------------------------
 * XÁC THỰC: token hợp lệ CHƯA ĐỦ. Mỗi yêu cầu còn đối chiếu lại tài khoản trong DB để
 *  - tài khoản bị admin khóa mất hiệu lực NGAY (không phải đợi token hết hạn),
 *  - đổi/cấp lại mật khẩu → mọi token cũ bị thu hồi (token mang "dấu vân tay" của mật khẩu lúc ký).
 * Kết quả tra cứu được giữ vài giây trong bộ nhớ để không tốn 1 truy vấn cho mỗi yêu cầu.
 * ------------------------------------------------------------------------------------------- */
const TABLES = { student: ['HOC_VIEN', 'MaHV', true], teacher: ['GIANG_VIEN', 'MaGV', true], admin: ['ADMIN', 'MaAD', false] };
const cache = new Map(); // "role:ma" → { v, exp }
const TTL_MS = 5000;

async function loadAccount(role, ma) {
  const t = TABLES[role];
  if (!t || typeof ma !== 'string') return null;
  const key = `${role}:${ma}`, now = Date.now(), hit = cache.get(key);
  if (hit && hit.exp > now) return hit.v;
  // tên bảng/cột lấy từ hằng số TABLES (không phải input người dùng) nên an toàn khi nội suy
  const [rows] = await pool.query(`SELECT MatKhauHash${t[2] ? ', TrangThaiTK' : ''} FROM ${t[0]} WHERE ${t[1]} = ?`, [ma]);
  const v = rows.length ? { status: t[2] ? rows[0].TrangThaiTK : 'active', pv: pvOf(rows[0].MatKhauHash) } : null;
  if (cache.size > 2000) cache.clear();
  cache.set(key, { v, exp: now + TTL_MS });
  return v;
}
// Gọi ngay sau khi đổi trạng thái / mật khẩu để hiệu lực tức thì (không chờ hết TTL)
const invalidateAccount = (role, ma) => cache.delete(`${role}:${ma}`);

function signToken(user, passwordHash) {
  return jwt.sign(
    { id: user.id, ten: user.ten, email: user.email, role: user.role, ma: user.ma, pv: pvOf(passwordHash) },
    cfg.jwtSecret,
    { algorithm: 'HS256', expiresIn: cfg.jwtExpires, issuer: 'n9' });
}

async function resolveUser(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return { err: new AppError(401, 'Vui lòng đăng nhập', 'NO_TOKEN') };
  let claims;
  try {
    claims = jwt.verify(h.slice(7), cfg.jwtSecret, { algorithms: ['HS256'], issuer: 'n9' });
  } catch (e) {
    return { err: e.name === 'TokenExpiredError'
      ? new AppError(401, 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại', 'TOKEN_EXPIRED')
      : new AppError(401, 'Phiên đăng nhập không hợp lệ', 'TOKEN_INVALID') };
  }
  const acc = await loadAccount(claims.role, claims.ma);
  if (!acc) return { err: new AppError(401, 'Tài khoản không còn tồn tại', 'ACCOUNT_GONE') };
  if (acc.status !== 'active') return { err: new AppError(403, 'Tài khoản đã bị khóa. Liên hệ quản trị viên để biết thêm.', 'ACCOUNT_SUSPENDED') };
  if (claims.pv !== acc.pv) return { err: new AppError(401, 'Mật khẩu đã thay đổi — vui lòng đăng nhập lại', 'TOKEN_REVOKED') };
  return { user: claims };
}

// Bắt buộc đăng nhập
async function auth(req, res, next) {
  try {
    const r = await resolveUser(req);
    if (r.err) return res.status(r.err.status).json({ error: r.err.message, code: r.err.code });
    req.user = r.user;
    next();
  } catch (e) { fail(res, e); }
}

// Giải mã NẾU có token hợp lệ, không bắt buộc (route công khai nhưng muốn biết "ai đang xem"). Token hỏng/tài khoản khóa → coi như khách.
async function optionalAuth(req, res, next) {
  try {
    if (req.headers.authorization) { const r = await resolveUser(req); if (r.user) req.user = r.user; }
  } catch (e) { /* lỗi DB tạm thời → vẫn phục vụ như khách */ }
  next();
}

const only = (role, msg) => (req, res, next) => {
  if (req.user?.role !== role) return res.status(403).json({ error: msg, code: 'FORBIDDEN' });
  next();
};
const teacherOnly = only('teacher', 'Chỉ giảng viên mới thực hiện được');
const studentOnly = only('student', 'Chỉ học viên mới thực hiện được');
const adminOnly = only('admin', 'Chỉ quản trị viên mới thực hiện được');

module.exports = { auth, optionalAuth, teacherOnly, studentOnly, adminOnly, signToken, invalidateAccount };
