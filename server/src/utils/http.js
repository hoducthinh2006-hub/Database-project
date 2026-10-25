// Lỗi có chủ đích (trả đúng mã + thông điệp cho người dùng) và bộ xử lý lỗi tập trung.
// Mục tiêu: KHÔNG bao giờ trả nguyên e.message của MySQL/Node ra ngoài (lộ tên bảng, cột, câu SQL).
class AppError extends Error {
  constructor(status, message, code, extra) { super(message); this.status = status; this.code = code; if (extra) Object.assign(this, extra); }
}
const bad = (msg) => new AppError(400, msg, 'BAD_REQUEST');
const forbidden = (msg, code = 'FORBIDDEN') => new AppError(403, msg, code);
const notFound = (msg = 'Không tìm thấy') => new AppError(404, msg, 'NOT_FOUND');
const conflict = (msg, code = 'CONFLICT') => new AppError(409, msg, code);

// Dịch lỗi MySQL sang thông điệp thân thiện + mã HTTP đúng
function fromDb(e) {
  switch (e.code) {
    case 'ER_DUP_ENTRY':
      if (/email/i.test(e.sqlMessage || '')) return new AppError(409, 'Email này đã được đăng ký', 'DUPLICATE');
      return new AppError(409, 'Dữ liệu này đã tồn tại', 'DUPLICATE');
    case 'ER_ROW_IS_REFERENCED_2':
    case 'ER_ROW_IS_REFERENCED':
      return new AppError(409, 'Không thể xóa vì đã có dữ liệu liên quan (học viên đã đăng ký, học hoặc làm bài). Hãy nhờ quản trị viên chuyển sang "Lưu trữ" thay vì xóa.', 'IN_USE');
    case 'ER_NO_REFERENCED_ROW_2':
    case 'ER_NO_REFERENCED_ROW':
      return new AppError(400, 'Dữ liệu tham chiếu không tồn tại', 'BAD_REFERENCE');
    case 'ER_SIGNAL_EXCEPTION':
      return new AppError(409, 'Lượt đăng ký này đã được thanh toán, không thể thanh toán lại', 'ALREADY_PAID');
    case 'ER_DATA_TOO_LONG':
      return new AppError(400, 'Dữ liệu nhập quá dài', 'TOO_LONG');
    case 'ER_BAD_NULL_ERROR':
      return new AppError(400, 'Thiếu dữ liệu bắt buộc', 'MISSING');
    case 'ER_TRUNCATED_WRONG_VALUE':
    case 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD':
    case 'ER_WRONG_VALUE_FOR_TYPE':
    case 'ER_WARN_DATA_OUT_OF_RANGE':
    case 'ER_CHECK_CONSTRAINT_VIOLATED':
      return new AppError(400, 'Giá trị nhập không hợp lệ', 'BAD_VALUE');
    case 'ER_LOCK_DEADLOCK':
    case 'ER_LOCK_WAIT_TIMEOUT':
      return new AppError(503, 'Hệ thống đang bận, vui lòng thử lại sau giây lát', 'BUSY');
    case 'PROTOCOL_CONNECTION_LOST':
    case 'ECONNREFUSED':
    case 'ETIMEDOUT':
    case 'ER_CON_COUNT_ERROR':
      return new AppError(503, 'Không kết nối được cơ sở dữ liệu, vui lòng thử lại sau', 'DB_DOWN');
    default:
      return null;
  }
}

function toAppError(e) {
  if (e instanceof AppError) return e;
  if (e && e.type === 'entity.parse.failed') return new AppError(400, 'Dữ liệu gửi lên không phải JSON hợp lệ', 'BAD_JSON');
  if (e && e.type === 'entity.too.large') return new AppError(413, 'Dữ liệu gửi lên quá lớn', 'TOO_LARGE');
  return (e && fromDb(e)) || new AppError(500, 'Lỗi hệ thống, vui lòng thử lại sau', 'INTERNAL');
}

// Dùng trong catch của từng route: ghi log đầy đủ ở server, trả thông điệp an toàn cho client
function fail(res, e) {
  const ae = toAppError(e);
  if (ae.status >= 500) console.error('[N9][lỗi]', e && e.stack ? e.stack : e);
  if (!res.headersSent) res.status(ae.status).json({ error: ae.message, code: ae.code, ...(ae.retryAfter ? { retryAfter: ae.retryAfter } : {}) });
}

// middleware cuối chuỗi: lỗi chưa được bắt (vd JSON hỏng) vẫn ra JSON gọn, không lộ stack
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  fail(res, err);
}
const notFoundApi = (req, res) => res.status(404).json({ error: 'Không tìm thấy đường dẫn API', code: 'NOT_FOUND' });

module.exports = { AppError, bad, forbidden, notFound, conflict, fail, errorHandler, notFoundApi, toAppError };
