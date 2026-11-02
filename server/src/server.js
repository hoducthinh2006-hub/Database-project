require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cfg = require('./config/env');
const pool = require('./config/db');
const { securityHeaders, noStoreApi, apiLimiter } = require('./middleware/security');
const { errorHandler, notFoundApi } = require('./utils/http');

const app = express();
app.disable('x-powered-by');
if (cfg.trustProxy) app.set('trust proxy', cfg.trustProxy);
app.use(securityHeaders);

/* ===================== API ===================== */
const api = express.Router();
// Web và API cùng 1 server (cùng origin) nên không cần CORS, chỉ mở cho CORS_ORIGINS (và Live Server khi dev)
api.use(cors({
  origin: (origin, cb) => cb(null, !origin || cfg.corsOrigins.includes(origin)),
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
}));
api.use(noStoreApi);
api.use(apiLimiter);
api.use('/auth/avatar', express.json({ limit: '2mb' })); // ảnh base64 cần trần riêng, cao hơn phần còn lại
api.use(express.json({ limit: '200kb' }));

api.get('/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
api.use('/auth', require('./routes/auth.routes'));
api.use('/courses', require('./routes/courses.routes'));
api.use('/quizzes', require('./routes/quizzes.routes'));
api.use('/reports', require('./routes/reports.routes'));
api.use('/student', require('./routes/student.routes'));
api.use('/teacher', require('./routes/teacher.routes'));
api.use('/admin', require('./routes/admin.routes'));
api.use('/honors', require('./routes/honors.routes'));
api.use(notFoundApi);
app.use('/api', api);

app.use('/avatars', express.static(path.join(__dirname, '../public/avatars'), { dotfiles: 'ignore', maxAge: '7d' }));

/* ===================== Giao diện web tĩnh ===================== */
const WEB_DIR = path.join(__dirname, '../../web');
app.use(express.static(WEB_DIR, { dotfiles: 'ignore' }));
// Mọi đường dẫn "trang" (không đuôi tệp, không phải /api) trả index.html (SPA); tệp thiếu thì 404 thật
app.get(/^\/(?!api(\/|$)).*/, (req, res, next) => {
  if (path.extname(req.path)) return next();
  res.sendFile(path.join(WEB_DIR, 'index.html'));
});

app.use(errorHandler);

const server = app.listen(cfg.port, () => console.log(`N9 server chạy tại http://localhost:${cfg.port}${cfg.prod ? ' (production)' : ''}`));

process.on('unhandledRejection', (r) => console.error('[N9][unhandledRejection]', r));
process.on('uncaughtException', (e) => { console.error('[N9][uncaughtException]', e); process.exit(1); });
const stop = () => server.close(() => pool.end().finally(() => process.exit(0)));
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
