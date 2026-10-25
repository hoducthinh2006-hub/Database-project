// Chính sách mật khẩu + tiện ích băm/đối chiếu.
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const cfg = require('../config/env');
const { bad } = require('./http');

// Mật khẩu MỚI (đăng ký / đổi): 8–72 ký tự, có chữ và số. (bcrypt chỉ xét 72 byte đầu nên chặn dài hơn.)
function checkNewPassword(pw, { email, name } = {}) {
  if (typeof pw !== 'string') throw bad('Mật khẩu không hợp lệ');
  if (pw.length < 8) throw bad('Mật khẩu phải từ 8 ký tự trở lên');
  if (Buffer.byteLength(pw, 'utf8') > 72) throw bad('Mật khẩu quá dài (tối đa 72 byte)');
  if (!/[A-Za-zÀ-ỹ]/.test(pw) || !/\d/.test(pw)) throw bad('Mật khẩu cần có cả chữ và số');
  if (/^(.)\1+$/.test(pw)) throw bad('Mật khẩu quá dễ đoán');
  if (email && pw.toLowerCase() === String(email).toLowerCase()) throw bad('Mật khẩu không được trùng email');
  if (name && pw.toLowerCase() === String(name).toLowerCase()) throw bad('Mật khẩu không được trùng họ tên');
  return pw;
}
const hash = (pw) => bcrypt.hash(pw, cfg.bcryptCost);

// Băm giả để mất thời gian như thật khi email không tồn tại → không dò được "email nào có tài khoản" qua độ trễ
const DUMMY_HASH = bcrypt.hashSync('n9-dummy-password-for-timing', 10);

// Mật khẩu tạm cho tài khoản do admin cấp: 10 ký tự dễ đọc (bỏ 0/O, 1/l/I), luôn có cả chữ lẫn số
function tempPassword() {
  const letters = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz', digits = '23456789';
  const all = letters + digits;
  for (;;) {
    const b = crypto.randomBytes(10);
    let out = '';
    for (let i = 0; i < 10; i++) out += all[b[i] % all.length];
    if (/\d/.test(out) && /[A-Za-z]/.test(out)) return out;
  }
}

// "Dấu vân tay" của mật khẩu hiện tại — nhúng vào JWT. Đổi/cấp lại mật khẩu → hash đổi → mọi token cũ tự vô hiệu.
const pvOf = (passwordHash) => crypto.createHash('sha256').update(String(passwordHash || '')).digest('base64url').slice(0, 16);

module.exports = { checkNewPassword, hash, DUMMY_HASH, tempPassword, pvOf };
