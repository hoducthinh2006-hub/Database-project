// Kiểm tra dữ liệu người dùng gửi lên. Mỗi hàm trả giá trị đã chuẩn hóa hoặc ném AppError 400 (thông điệp tiếng Việt).
const { bad } = require('./http');

// Chuỗi: bắt buộc phải là string (chặn kiểu object/mảng "lách" qua JSON), cắt khoảng trắng, giới hạn độ dài
function text(v, { name = 'Giá trị', min = 0, max = 255, required = true } = {}) {
  if (v === undefined || v === null || v === '') {
    if (required || min > 0) throw bad(`Vui lòng nhập ${name.toLowerCase()}`);
    return null;
  }
  if (typeof v !== 'string') throw bad(`${name} không hợp lệ`);
  const s = v.trim().replace(/\s{2,}/g, ' ');
  if (s.length < min) throw bad(`${name} quá ngắn (tối thiểu ${min} ký tự)`);
  if (s.length > max) throw bad(`${name} quá dài (tối đa ${max} ký tự)`);
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(s)) throw bad(`${name} chứa ký tự không hợp lệ`);
  return s;
}
// Đoạn văn nhiều dòng (mô tả, nhận xét): giữ xuống dòng
function paragraph(v, { name = 'Nội dung', max = 2000, required = false } = {}) {
  if (v === undefined || v === null || v === '') { if (required) throw bad(`Vui lòng nhập ${name.toLowerCase()}`); return null; }
  if (typeof v !== 'string') throw bad(`${name} không hợp lệ`);
  const s = v.trim();
  if (s.length > max) throw bad(`${name} quá dài (tối đa ${max} ký tự)`);
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(s)) throw bad(`${name} chứa ký tự không hợp lệ`);
  return s || null;
}
function email(v) {
  const s = text(v, { name: 'Email', max: 100 }).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(s)) throw bad('Email không hợp lệ');
  return s;
}
function int(v, { name = 'Giá trị', min = -2147483648, max = 2147483647, required = true } = {}) {
  if (v === undefined || v === null || v === '') { if (required) throw bad(`Vui lòng nhập ${name.toLowerCase()}`); return null; }
  const n = typeof v === 'number' ? v : (typeof v === 'string' && /^-?\d+$/.test(v.trim()) ? Number(v) : NaN);
  if (!Number.isInteger(n)) throw bad(`${name} phải là số nguyên`);
  if (n < min || n > max) throw bad(`${name} phải nằm trong khoảng ${min} – ${max}`);
  return n;
}
function oneOf(v, list, name = 'Giá trị') {
  if (typeof v !== 'string' || !list.includes(v)) throw bad(`${name} không hợp lệ`);
  return v;
}
// Ngày dạng YYYY-MM-DD, có thật trong lịch, không ở tương lai (ngày sinh) và không quá xa
function date(v, { name = 'Ngày', required = false, allowFuture = false } = {}) {
  if (v === undefined || v === null || v === '') { if (required) throw bad(`Vui lòng nhập ${name.toLowerCase()}`); return null; }
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw bad(`${name} phải có dạng năm-tháng-ngày`);
  const d = new Date(v + 'T00:00:00Z');
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) throw bad(`${name} không tồn tại`);
  if (d.getUTCFullYear() < 1900) throw bad(`${name} không hợp lệ`);
  if (!allowFuture && d.getTime() > Date.now()) throw bad(`${name} không được ở tương lai`);
  return v;
}
function phone(v, { name = 'Số điện thoại' } = {}) {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string') throw bad(`${name} không hợp lệ`);
  const s = v.trim();
  if (!/^[0-9+().\-\s]{8,15}$/.test(s) || s.replace(/\D/g, '').length < 8) throw bad(`${name} không hợp lệ`);
  return s;
}
// Link YouTube hợp lệ (cùng định dạng mà trình phát trong web nhận). Trả về chuỗi đã chuẩn hóa hoặc null nếu để trống.
const YT_RE = /^https:\/\/(?:www\.|m\.)?(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/))([\w-]{6,20})(?:[?&#][^\s]*)?$/i;
function youtube(v) {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string') throw bad('Link video không hợp lệ');
  const s = v.trim();
  if (s.length > 255 || !YT_RE.test(s)) throw bad('Link YouTube không hợp lệ (dùng dạng https://youtu.be/… hoặc https://www.youtube.com/watch?v=…)');
  return s;
}
// Mã định danh dạng KH001, HV002… (chặn chuỗi lạ trước khi chạm DB)
function code(v, name = 'Mã') {
  if (typeof v !== 'string' || !/^[A-Za-z]{1,4}\d{1,8}$/.test(v)) throw bad(`${name} không hợp lệ`);
  return v;
}
// Câu hỏi trắc nghiệm: [{ q, opt:[...], dap }]
function questions(arr) {
  if (!Array.isArray(arr) || !arr.length) throw bad('Bài kiểm tra cần ít nhất 1 câu hỏi');
  if (arr.length > 50) throw bad('Tối đa 50 câu hỏi cho mỗi bài kiểm tra');
  return arr.map((q, i) => {
    const n = i + 1;
    if (!q || typeof q !== 'object') throw bad(`Câu ${n} không hợp lệ`);
    const content = text(q.q, { name: `Nội dung câu ${n}`, min: 1, max: 500 });
    if (!Array.isArray(q.opt) || q.opt.length < 2 || q.opt.length > 6) throw bad(`Câu ${n} cần từ 2 đến 6 đáp án`);
    const opt = q.opt.map((o, j) => text(o, { name: `Đáp án ${String.fromCharCode(65 + j)} của câu ${n}`, min: 1, max: 300 }));
    const dap = int(q.dap, { name: `Đáp án đúng của câu ${n}`, min: 0, max: opt.length - 1 });
    return { q: content, opt, dap };
  });
}

module.exports = { text, paragraph, email, int, oneOf, date, phone, youtube, code, questions, YT_RE };
