// Tiêu đề bảo mật HTTP, giới hạn tần suất (rate limit) và chống dò mật khẩu.
// Tự viết (bộ nhớ trong tiến trình) để không phải thêm thư viện; đủ dùng cho 1 server.
const cfg = require('../config/env');

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",   // web dùng nhiều thuộc tính style="…" nên cần unsafe-inline cho style (script thì KHÔNG)
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: https://img.vietqr.io",   // mã QR chuyển khoản (VietQR) ở màn thanh toán
  "connect-src 'self'",
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com", // video bài giảng
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

function securityHeaders(req, res, next) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains'); // chỉ khi đang chạy HTTPS
  next();
}
// Dữ liệu API là riêng tư: không cho trình duyệt/proxy lưu đệm
function noStoreApi(req, res, next) { res.setHeader('Cache-Control', 'no-store'); res.setHeader('Pragma', 'no-cache'); next(); }

const clientIp = (req) => req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
function fmtWait(sec) {
  if (sec < 60) return `${sec} giây`;
  const m = Math.floor(sec / 60), s = sec % 60;
  return s ? `${m} phút ${s} giây` : `${m} phút`;
}
function sweeper(map, isDead, everyMs) {
  const t = setInterval(() => { for (const [k, v] of map) if (isDead(v)) map.delete(k); }, everyMs);
  t.unref();
}

/* Giới hạn số yêu cầu theo cửa sổ thời gian cố định (vd 300 yêu cầu/phút/IP) */
function rateLimit({ windowMs, max, key = clientIp, message = 'Bạn thao tác quá nhanh', code = 'RATE_LIMITED' }) {
  const hits = new Map();
  sweeper(hits, (h) => h.reset <= Date.now(), Math.min(windowMs, 60000));
  return (req, res, next) => {
    const k = key(req), now = Date.now();
    let h = hits.get(k);
    if (!h || h.reset <= now) { h = { n: 0, reset: now + windowMs }; hits.set(k, h); }
    h.n += 1;
    if (h.n > max) {
      const wait = Math.max(1, Math.ceil((h.reset - now) / 1000));
      res.setHeader('Retry-After', String(wait));
      return res.status(429).json({ error: `${message}. Thử lại sau ${fmtWait(wait)}.`, code, retryAfter: wait });
    }
    next();
  };
}

/* Đếm số lần SAI liên tiếp theo khóa; đủ `max` lần thì khóa `lockMs`. Đúng 1 lần thì xóa bộ đếm. */
class FailGuard {
  constructor({ max, lockMs, windowMs }) {
    this.max = max; this.lockMs = lockMs; this.windowMs = windowMs; this.map = new Map();
    sweeper(this.map, (e) => (e.until ? e.until <= Date.now() : Date.now() - e.first > windowMs), 60000);
  }
  /** số giây còn bị khóa (0 = không khóa) */
  wait(key) {
    const e = this.map.get(key), now = Date.now();
    if (!e || !e.until) return 0;
    if (e.until <= now) { this.map.delete(key); return 0; }
    return Math.ceil((e.until - now) / 1000);
  }
  fail(key) {
    const now = Date.now();
    let e = this.map.get(key);
    if (!e || (!e.until && now - e.first > this.windowMs)) e = { n: 0, first: now, until: 0 };
    e.n += 1;
    if (e.n >= this.max) e.until = now + this.lockMs;
    this.map.set(key, e);
  }
  ok(key) { this.map.delete(key); }
}

const lockMs = cfg.loginLockMin * 60 * 1000;
// đăng nhập: khóa theo (IP + email) để kẻ tấn công không khóa nạn nhân từ IP khác; thêm trần theo IP chống quét nhiều email
const loginByPair = new FailGuard({ max: cfg.loginMaxFails, lockMs, windowMs: lockMs });
const loginByIp = new FailGuard({ max: cfg.loginMaxFails * 6, lockMs, windowMs: lockMs });
// đổi mật khẩu: sai mật khẩu hiện tại quá nhiều lần cũng bị khóa (theo tài khoản)
const passwordByUser = new FailGuard({ max: 5, lockMs, windowMs: lockMs });

const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: cfg.apiPerMin, message: 'Bạn gửi yêu cầu quá nhiều' });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: cfg.registerPerHour, message: 'Đăng ký quá nhiều lần từ cùng một địa chỉ' });

module.exports = { securityHeaders, noStoreApi, rateLimit, FailGuard, apiLimiter, registerLimiter, loginByPair, loginByIp, passwordByUser, clientIp, fmtWait };
