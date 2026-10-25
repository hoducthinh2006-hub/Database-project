require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cfg = require('./config/env');                 // dừng ngay nếu JWT_SECRET thiếu/yếu
const pool = require('./config/db');
const { securityHeaders, noStoreApi, apiLimiter } = require('./middleware/security');
const { errorHandler, notFoundApi } = require('./utils/http');

const app = express();
app.disable('x-powered-by');                          // không khoe "Express" cho kẻ dò quét
if (cfg.trustProxy) app.set('trust proxy', cfg.trustProxy);
app.use(securityHeaders);                             // CSP, nosniff, chống nhúng khung, v.v.

/* ===================== API ===================== */
const api = express.Router();
// Web và API cùng 1 server (cùng origin) nên KHÔNG cần CORS. Chỉ mở cho các origin liệt kê trong CORS_ORIGINS (và Live Server khi dev).
api.use(cors({
  origin: (origin, cb) => cb(null, !origin || cfg.corsOrigins.includes(origin)),
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
}));
api.use(noStoreApi);
api.use(apiLimiter);
api.use(express.json({ limit: '200kb' }));            // chặn gửi thân yêu cầu quá lớn

api.get('/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
api.use('/auth', require('./routes/auth.routes'));
api.use('/courses', require('./routes/courses.routes'));
api.use('/quizzes', require('./routes/quizzes.routes'));
api.use('/reports', require('./routes/reports.routes'));
api.use('/student', require('./routes/student.routes'));
api.use('/teacher', require('./routes/teacher.routes'));
api.use('/admin', require('./routes/admin.routes'));
api.use('/honors', require('./routes/honors.routes'));
api.use(notFoundApi);                                 // đường dẫn API không tồn tại → JSON 404 (không phải trang HTML)
app.use('/api', api);

/* ===================== Giao diện web tĩnh ===================== */
// Phục vụ frontend tĩnh (thư mục web/) — 1 server chạy cả web lẫn API. Chỉ thư mục web/ được mở ra ngoài.
const WEB_DIR = path.join(__dirname, '../../web');
app.use(express.static(WEB_DIR, { dotfiles: 'ignore' }));
// mọi đường dẫn "trang" (không có đuôi tệp, không phải /api) trả về index.html (SPA); tệp thiếu thì 404 thật
app.get(/^\/(?!api(\/|$)).*/, (req, res, next) => {
  if (path.extname(req.path)) return next();
  res.sendFile(path.join(WEB_DIR, 'index.html'));
});

app.use(errorHandler);                                // lỗi chưa bắt (vd JSON hỏng) → JSON gọn, không lộ chi tiết

const server = app.listen(cfg.port, () => console.log(`N9 server chạy tại http://localhost:${cfg.port}${cfg.prod ? ' (production)' : ''}`));

process.on('unhandledRejection', (r) => console.error('[N9][unhandledRejection]', r));
process.on('uncaughtException', (e) => { console.error('[N9][uncaughtException]', e); process.exit(1); });
const stop = () => server.close(() => pool.end().finally(() => process.exit(0)));
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
