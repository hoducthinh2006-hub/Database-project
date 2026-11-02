const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config();

// DB_SSL=true bật TLS; DB_SSL_CA (đường dẫn hoặc nội dung PEM) xác minh chứng chỉ máy chủ, thiếu thì vẫn mã hóa nhưng không xác minh
function sslOption() {
  if (process.env.DB_SSL !== 'true') return undefined;
  const ca = process.env.DB_SSL_CA;
  if (ca) {
    const pem = ca.includes('BEGIN CERTIFICATE') ? ca : fs.readFileSync(ca, 'utf8');
    return { ca: pem, rejectUnauthorized: true };
  }
  console.warn('[N9] DB_SSL=true nhưng chưa có DB_SSL_CA → kết nối được mã hóa nhưng KHÔNG xác minh chứng chỉ máy chủ DB.');
  return { rejectUnauthorized: false };
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'btl_csdl_khoahoc',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 100,
  connectTimeout: 10000,
  enableKeepAlive: true,
  charset: 'utf8mb4',
  multipleStatements: false,       // chặn "chèn thêm câu lệnh" nếu có lỗ hổng SQL injection
  dateStrings: true,                // tránh Date bị quy đổi UTC khi trả JSON, lệch 1 ngày với múi giờ VN
  ssl: sslOption(),
});

module.exports = pool;
