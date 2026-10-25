const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Kết nối TLS tới DB online (Railway/Aiven…):
//  - DB_SSL=true            → bật TLS
//  - DB_SSL_CA=<đường dẫn file hoặc nội dung PEM>  → XÁC MINH chứng chỉ máy chủ (khuyến nghị, chống nghe lén/giả mạo)
//  - không có DB_SSL_CA     → vẫn mã hóa nhưng không xác minh chứng chỉ (kém an toàn hơn, in cảnh báo)
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

// Pool kết nối dùng chung — mượn connection khi cần, trả lại sau khi xong
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'btl_csdl_khoahoc',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 100,                 // hàng đợi có trần: quá tải thì từ chối bớt thay vì xếp hàng vô hạn
  connectTimeout: 10000,
  enableKeepAlive: true,
  charset: 'utf8mb4',
  multipleStatements: false,       // chặn "chèn thêm câu lệnh" nếu có lỗ hổng SQL injection
  // Trả DATE/DATETIME/TIMESTAMP về dạng chuỗi gốc (vd "2026-05-12") thay vì đối tượng Date của JS — nếu không, Date sẽ bị
  // quy đổi sang UTC khi res.json() gọi toISOString(), lệch lùi 1 ngày với múi giờ VN (UTC+7).
  dateStrings: true,
  ssl: sslOption(),
});

module.exports = pool;
