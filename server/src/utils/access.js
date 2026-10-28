// Quy tắc "ai được xem/làm gì" ở MỘT chỗ duy nhất để mọi route dùng chung, tránh mỗi nơi kiểm tra một kiểu.
const pool = require('../config/db');

// Quyền học của 1 học viên với 1 khóa: có lượt đăng ký còn hiệu lực (không bị hủy) VÀ
// (khóa miễn phí HOẶC đã có giao dịch thanh toán ĐƯỢC ADMIN DUYỆT — TrangThaiTT='success').
// Chuyển khoản/thẻ/ví đều chỉ ghi 'pending' lúc học viên gửi; admin duyệt mới mở khóa (dangCho = đang chờ).
// Dùng lượt đăng ký mới nhất.
async function studentEntitlement(db, maHV, maKH) {
  const [[dk]] = await (db || pool).query(
    `SELECT dk.MaDK, dk.TTDangKy, dk.HocPhi, dk.NgayDangKy,
            EXISTS(SELECT 1 FROM THANH_TOAN tt WHERE tt.MaDK = dk.MaDK AND tt.TrangThaiTT = 'success' AND tt.LoaiGiaoDich = 'thanh_toan') AS DaTra,
            EXISTS(SELECT 1 FROM THANH_TOAN tt WHERE tt.MaDK = dk.MaDK AND tt.TrangThaiTT = 'pending') AS DangCho
       FROM DANG_KY dk
      WHERE dk.MaHV = ? AND dk.MaKH = ? AND dk.TTDangKy <> 'da_huy'
      ORDER BY dk.NgayDangKy DESC, dk.MaDK DESC LIMIT 1`,
    [maHV, maKH]);
  if (!dk) return { dk: null, paid: false, entitled: false, dangCho: false, reason: 'chua_dang_ky' };
  const free = Number(dk.HocPhi) <= 0;
  const paid = free || !!dk.DaTra;
  const dangCho = !paid && !!dk.DangCho;
  return { dk, paid, entitled: paid, dangCho, reason: paid ? 'ok' : (dangCho ? 'cho_duyet' : 'chua_thanh_toan') };
}

// Ai được xem khóa này? Khóa nháp/lưu trữ chỉ chủ khóa + admin biết là có tồn tại (người khác nhận 404).
function canViewCourse(user, kh) {
  if (kh.TrangThai === 'published') return true;
  if (!user) return false;
  return user.role === 'admin' || (user.role === 'teacher' && user.ma === kh.MaGV);
}
const isOwner = (user, kh) => !!user && user.role === 'teacher' && user.ma === kh.MaGV;
const isAdmin = (user) => !!user && user.role === 'admin';

module.exports = { studentEntitlement, canViewCourse, isOwner, isAdmin };
