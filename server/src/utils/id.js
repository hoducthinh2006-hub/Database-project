const { AppError } = require('./http');

// Sinh mã tiếp theo dạng PREFIX + số (VD: HV001, KH004); table/col/prefix là hằng số nội bộ nên an toàn khi nội suy
async function nextCode(db, table, col, prefix, pad = 3) {
  const [rows] = await db.query(
    `SELECT ${col} AS c FROM ${table} WHERE ${col} LIKE ? ORDER BY LENGTH(${col}) DESC, ${col} DESC LIMIT 1`,
    [prefix + '%']
  );
  let n = 1;
  if (rows.length) {
    const m = String(rows[0].c).match(/(\d+)$/);
    if (m) n = parseInt(m[1], 10) + 1;
  }
  return prefix + String(n).padStart(pad, '0');
}

// Trùng mã (2 yêu cầu cùng lúc) → khóa chính báo trùng → sinh lại, thử tiếp tối đa 8 lần
async function insertWithCode(db, table, col, prefix, doInsert, pad = 3) {
  for (let i = 0; i < 8; i++) {
    const code = await nextCode(db, table, col, prefix, pad);
    try {
      await doInsert(code);
      return code;
    } catch (e) {
      if (e && e.code === 'ER_DUP_ENTRY' && /PRIMARY/i.test(e.sqlMessage || '')) {
        await new Promise((r) => setTimeout(r, 5 + Math.random() * 25)); // lệch pha giữa các yêu cầu tranh nhau
        continue;
      }
      throw e;
    }
  }
  throw new AppError(503, 'Hệ thống đang bận, vui lòng thử lại sau giây lát', 'BUSY');
}

module.exports = { nextCode, insertWithCode };
