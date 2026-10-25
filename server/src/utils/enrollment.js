const pool = require('../config/db');
const { insertWithCode } = require('./id');
const { withTx } = require('./tx');

// Đồng bộ trạng thái 1 lượt đăng ký theo tiến độ thật:
//  - có hoạt động học/làm bài đầu tiên  → 'dang_hoc'
//  - học hết bài + làm đủ bài kiểm tra + điểm TB >= 7 → 'hoan_thanh' và cấp chứng chỉ
// Cùng quy tắc với view V_HOAN_THANH (tiến độ 100% & điểm TB >= 7, thang 10).
// Cập nhật trạng thái + cấp chứng chỉ nằm trong MỘT transaction: không bao giờ có cảnh "đã hoàn thành mà chưa có chứng chỉ".
async function syncEnrollment(_pool, maDK) {
  const [[dk]] = await pool.query('SELECT MaDK, MaKH, TTDangKy FROM DANG_KY WHERE MaDK=?', [maDK]);
  if (!dk || dk.TTDangKy === 'da_huy' || dk.TTDangKy === 'hoan_thanh')
    return { trangThai: dk ? dk.TTDangKy : null, capChungChi: false };

  const [[t]] = await pool.query(
    `SELECT (SELECT COUNT(*) FROM BAI_HOC WHERE MaKH = ?) AS tong,
            (SELECT COUNT(DISTINCT MaBH) FROM LICH_SU_HOC_TAP WHERE MaDK = ? AND TrangThaiHoanThanh = 'hoan_thanh') AS xong,
            (SELECT COUNT(*) FROM BAI_KIEM_TRA bkt JOIN BAI_HOC bh ON bh.MaBH = bkt.MaBH
              WHERE bh.MaKH = ? AND bkt.TrangThai = 'active') AS soKT,
            (SELECT COUNT(DISTINCT kq.MaBKT) FROM KET_QUA kq
               JOIN BAI_KIEM_TRA bkt ON bkt.MaBKT = kq.MaBKT AND bkt.TrangThai = 'active'
               JOIN BAI_HOC bh ON bh.MaBH = bkt.MaBH
              WHERE kq.MaDK = ? AND bh.MaKH = ?) AS ktDaLam,
            (SELECT DiemTrungBinh FROM V_DIEM_TB WHERE MaDK = ?) AS diemTB`,
    [dk.MaKH, maDK, dk.MaKH, maDK, dk.MaKH, maDK]);

  let next = dk.TTDangKy;
  if ((t.xong > 0 || t.ktDaLam > 0) && ['cho_xac_nhan', 'da_xac_nhan'].includes(next)) next = 'dang_hoc';
  const dat = t.tong > 0 && t.xong >= t.tong
    && (t.soKT === 0 || (t.ktDaLam >= t.soKT && t.diemTB != null && Number(t.diemTB) >= 7));
  if (dat) next = 'hoan_thanh';
  if (next === dk.TTDangKy) return { trangThai: next, capChungChi: false };

  return withTx(pool, async (conn) => {
    // khóa dòng đăng ký để 2 yêu cầu đồng thời không cùng cấp chứng chỉ
    const [[cur]] = await conn.query('SELECT TTDangKy FROM DANG_KY WHERE MaDK = ? FOR UPDATE', [maDK]);
    if (!cur || cur.TTDangKy === 'da_huy' || cur.TTDangKy === 'hoan_thanh') return { trangThai: cur ? cur.TTDangKy : null, capChungChi: false };
    await conn.query('UPDATE DANG_KY SET TTDangKy = ? WHERE MaDK = ?', [next, maDK]);
    let capChungChi = false;
    if (next === 'hoan_thanh') {
      const [[has]] = await conn.query('SELECT 1 AS x FROM CHUNG_CHI WHERE MaDK = ?', [maDK]);
      if (!has) {
        await insertWithCode(pool, 'CHUNG_CHI', 'MaCC', 'CC', (MaCC) => conn.query('INSERT INTO CHUNG_CHI(MaCC, MaDK) VALUES(?, ?)', [MaCC, maDK]));
        capChungChi = true;
      }
    }
    return { trangThai: next, capChungChi };
  });
}

module.exports = { syncEnrollment };
