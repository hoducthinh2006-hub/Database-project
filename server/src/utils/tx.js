// Chạy `fn(conn)` trong 1 transaction: thành công thì commit, lỗi thì rollback rồi ném lại lỗi.
// Dùng cho các thao tác nhiều bước (đăng ký, thanh toán, cấp chứng chỉ…) để không bao giờ để dữ liệu "nửa vời".
async function withTx(pool, fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (e) {
    try { await conn.rollback(); } catch (e2) { /* kết nối đã hỏng — bỏ qua */ }
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = { withTx };
