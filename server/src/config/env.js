// Đọc + kiểm tra cấu hình môi trường một lần lúc khởi động (sau khi dotenv đã nạp .env).
// Thiếu/yếu JWT_SECRET → dừng ngay: nếu không, ai biết chuỗi mẫu trong .env.example có thể tự ký token admin.
const PLACEHOLDERS = ['doi-thanh-mot-chuoi-ngau-nhien-that-dai', 'changeme', 'secret', 'your-secret', 'jwt-secret'];

const num = (v, d) => { const n = Number(v); return v !== undefined && v !== '' && Number.isFinite(n) && n >= 0 ? n : d; };

function load() {
  const env = process.env;
  const secret = env.JWT_SECRET || '';
  if (secret.length < 24 || PLACEHOLDERS.includes(secret.toLowerCase())) {
    console.error('\n[N9] JWT_SECRET thiếu hoặc quá yếu (cần ≥ 24 ký tự và không dùng chuỗi mẫu).');
    console.error('     Tạo chuỗi mạnh:  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
    console.error('     rồi đặt vào server/.env:   JWT_SECRET=<chuỗi vừa tạo>\n');
    process.exit(1);
  }
  const prod = env.NODE_ENV === 'production';
  // Origin được phép gọi API từ trình duyệt khác nguồn. Web và API cùng 1 server nên mặc định KHÔNG cần ai cả.
  const corsOrigins = (env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!prod) corsOrigins.push('http://localhost:5500', 'http://127.0.0.1:5500'); // Live Server khi phát triển
  const tp = env.TRUST_PROXY;
  return {
    prod,
    port: num(env.PORT, 3000),
    jwtSecret: secret,
    jwtExpires: env.JWT_EXPIRES || '24h',
    // Đặt TRUST_PROXY=1 khi chạy sau proxy của Railway/Render… để lấy đúng IP người dùng (rate limit theo IP).
    trustProxy: tp ? (Number.isNaN(Number(tp)) ? tp : Number(tp)) : false,
    corsOrigins,
    loginMaxFails: num(env.LOGIN_MAX_FAILS, 5),        // số lần sai tối đa / (IP + email)
    loginLockMin: num(env.LOGIN_LOCK_MIN, 15),         // khóa bao nhiêu phút
    apiPerMin: num(env.RATE_LIMIT_API_PER_MIN, 300),   // số yêu cầu API / phút / IP
    registerPerHour: num(env.REGISTER_PER_HOUR, 15),   // số lần đăng ký tài khoản / giờ / IP
    lessonMinSeconds: num(env.LESSON_MIN_SECONDS, 20), // học ít nhất ngần này giây mới được đánh dấu xong bài (0 = tắt)
    quizGraceSeconds: num(env.QUIZ_GRACE_SECONDS, 30), // dung sai khi nộp bài trễ (độ trễ mạng)
    bcryptCost: Math.min(14, Math.max(10, num(env.BCRYPT_COST, 12))),
    // QR "Chuyển khoản" thật khi thanh toán (tùy chọn) — thiếu BIN hoặc số TK thì coi như chưa cấu hình.
    bank: {
      bin: (env.BANK_BIN || '').trim(),
      stk: (env.BANK_ACCOUNT_NO || '').trim(),
      ten: (env.BANK_ACCOUNT_NAME || '').trim(),
      tenNH: (env.BANK_NAME || '').trim(),
      template: (env.BANK_QR_TEMPLATE || 'compact2').trim(),
    },
  };
}

module.exports = load();
