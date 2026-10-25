// VINH DANH: ghi nhận thành tích theo từng DANH HIỆU (khác bảng xếp hạng: không phải một cuộc đua duy nhất).
// Mỗi danh hiệu có tiêu chí riêng, ghi rõ trong `moTa`; tính trực tiếp từ dữ liệu học tập thật, không cần bảng mới.
//   GET /api/honors — ai cũng xem được phần giảng viên + khóa học; phần học viên (có tên người học) chỉ khi đã đăng nhập.
const router = require('express').Router();
const pool = require('../config/db');
const { optionalAuth } = require('../middleware/auth');
const { globalBoard, ratedCourses, weightedRating, MIN_DANH_GIA } = require('../utils/ranking');
const { fail } = require('../utils/http');

const TTL = 30 * 1000;
let cache = null;

const ddmm = (s) => { const m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}` : ''; };
const sec = (ma, ten, icon, moTa, items) => ({ ma, ten, icon, moTa, items });

async function studentHonors() {
  const [thang, cham] = await Promise.all([
    globalBoard(pool, { tieuChi: 'diem', khoang: 'thang' }),
    globalBoard(pool, { tieuChi: 'chamchi', khoang: 'thang' }),
  ]);
  const top3 = (b) => b.bang.filter((r) => r.Hang != null).slice(0, 3);

  const [cc] = await pool.query(
    `SELECT hv.MaHV, hv.HoTen, COUNT(*) AS n, DATE_FORMAT(MAX(cc.NgayCap), '%Y-%m-%d') AS cuoi
       FROM CHUNG_CHI cc JOIN DANG_KY dk ON dk.MaDK = cc.MaDK JOIN HOC_VIEN hv ON hv.MaHV = dk.MaHV AND hv.TrangThaiTK = 'active'
      GROUP BY hv.MaHV, hv.HoTen ORDER BY n DESC, MAX(cc.NgayCap) DESC, hv.HoTen LIMIT 3`);

  const it = (r, o) => ({ id: r.MaHV, ten: r.HoTen, ...o });
  return [
    sec('thu-khoa', 'Thủ khoa tháng', 'crown', `Điểm TB bài kiểm tra cao nhất trong 30 ngày qua (điểm cao nhất mỗi bài, làm tối thiểu ${thang.nguong} bài)`,
      top3(thang).map((r) => it(r, { hang: r.Hang, giaTri: r.DiemTB.toFixed(2), nhan: 'điểm TB', phu: `${r.SoBaiKT} bài kiểm tra · ${r.SoChungChi} chứng chỉ` }))),
    sec('cham-chi', 'Chăm chỉ nhất tháng', 'flame', 'Hoàn thành nhiều bài học nhất trong 30 ngày qua',
      top3(cham).map((r) => it(r, { hang: r.Hang, giaTri: String(r.SoBaiHoc), nhan: 'bài học', phu: `${r.SoBaiKT} bài kiểm tra đã làm` }))),
    sec('suu-tam', 'Nhà sưu tầm chứng chỉ', 'award', 'Nhận nhiều chứng chỉ hoàn thành khóa nhất',
      cc.map((r, i) => it(r, { hang: i + 1, giaTri: String(r.n), nhan: 'chứng chỉ', phu: `mới nhất ${ddmm(r.cuoi)}` }))),
  ];
}

async function teacherAndCourseHonors() {
  const { C, courses } = await ratedCourses(pool);

  // giảng viên: gộp mọi đánh giá của các khóa đang công khai, tính điểm có trọng số
  const gv = new Map();
  courses.forEach((c) => {
    const g = gv.get(c.MaGV) || gv.set(c.MaGV, { MaGV: c.MaGV, HoTen: c.TenGV, tong: 0, v: 0, khoa: 0 }).get(c.MaGV);
    g.khoa++; g.v += c.SoDanhGia; g.tong += (c.DiemTB || 0) * c.SoDanhGia;
  });
  const fav = [...gv.values()].filter((g) => g.v >= MIN_DANH_GIA).map((g) => ({ ...g, R: g.tong / g.v, score: weightedRating(g.tong / g.v, g.v, C) }))
    .sort((a, b) => b.score - a.score || b.v - a.v).slice(0, 3);

  const [crowd] = await pool.query(
    `SELECT gv.MaGV, gv.HoTen, COUNT(DISTINCT dk.MaHV) AS n, COUNT(DISTINCT kh.MaKH) AS k
       FROM GIANG_VIEN gv JOIN KHOA_HOC kh ON kh.MaGV = gv.MaGV AND kh.TrangThai = 'published'
       JOIN DANG_KY dk ON dk.MaKH = kh.MaKH AND dk.TTDangKy <> 'da_huy'
      WHERE gv.TrangThaiTK = 'active' GROUP BY gv.MaGV, gv.HoTen ORDER BY n DESC, k DESC, gv.HoTen LIMIT 3`);
  const [cert] = await pool.query(
    `SELECT gv.MaGV, gv.HoTen, COUNT(*) AS n
       FROM GIANG_VIEN gv JOIN KHOA_HOC kh ON kh.MaGV = gv.MaGV AND kh.TrangThai = 'published'
       JOIN DANG_KY dk ON dk.MaKH = kh.MaKH JOIN CHUNG_CHI cc ON cc.MaDK = dk.MaDK
      WHERE gv.TrangThaiTK = 'active' GROUP BY gv.MaGV, gv.HoTen ORDER BY n DESC, gv.HoTen LIMIT 3`);

  const giangVien = [
    sec('gv-yeu-thich', 'Giảng viên được yêu thích', 'star', `Điểm đánh giá có trọng số cao nhất (cần tối thiểu ${MIN_DANH_GIA} lượt đánh giá để tránh "1 sao 5 điểm" lên đỉnh)`,
      fav.map((g, i) => ({ id: g.MaGV, ten: g.HoTen, hang: i + 1, giaTri: g.R.toFixed(2), nhan: 'sao', phu: `${g.v} đánh giá · ${g.khoa} khóa` }))),
    sec('gv-lop-dong', 'Lớp học đông nhất', 'users', 'Có nhiều học viên khác nhau nhất trên các khóa đang công khai',
      crowd.map((g, i) => ({ id: g.MaGV, ten: g.HoTen, hang: i + 1, giaTri: String(g.n), nhan: 'học viên', phu: `${g.k} khóa học` }))),
    sec('gv-chung-chi', 'Truyền cảm hứng', 'award', 'Có nhiều học viên hoàn thành khóa và nhận chứng chỉ nhất',
      cert.map((g, i) => ({ id: g.MaGV, ten: g.HoTen, hang: i + 1, giaTri: String(g.n), nhan: 'chứng chỉ đã cấp', phu: 'cho học viên của giảng viên' }))),
  ];

  const rated = courses.filter((c) => c.SoDanhGia >= MIN_DANH_GIA).sort((a, b) => b.DiemXepHang - a.DiemXepHang || b.SoDanhGia - a.SoDanhGia).slice(0, 3);
  const crowdC = courses.filter((c) => c.SoHocVien > 0).sort((a, b) => b.SoHocVien - a.SoHocVien || a.TenKH.localeCompare(b.TenKH, 'vi')).slice(0, 3);
  const fin = courses.filter((c) => c.SoLuot >= 5).map((c) => ({ ...c, rate: c.SoHoanThanh / c.SoLuot }))
    .sort((a, b) => b.rate - a.rate || b.SoLuot - a.SoLuot).slice(0, 3);
  const khoaHoc = [
    sec('kh-danh-gia', 'Khóa học được đánh giá cao', 'star', `Điểm đánh giá có trọng số cao nhất (cần tối thiểu ${MIN_DANH_GIA} lượt đánh giá)`,
      rated.map((c, i) => ({ id: c.MaKH, kind: 'khoa', ten: c.TenKH, hang: i + 1, giaTri: c.DiemTB.toFixed(2), nhan: 'sao', phu: `${c.SoDanhGia} đánh giá · ${c.TenGV}` }))),
    sec('kh-dong-nhat', 'Nhiều người học nhất', 'users', 'Số học viên khác nhau đã đăng ký (không tính lượt hủy)',
      crowdC.map((c, i) => ({ id: c.MaKH, kind: 'khoa', ten: c.TenKH, hang: i + 1, giaTri: String(c.SoHocVien), nhan: 'học viên', phu: c.TenGV }))),
    sec('kh-hoan-thanh', 'Tỷ lệ hoàn thành cao nhất', 'check-circle', 'Phần trăm lượt đăng ký học xong và nhận chứng chỉ (khóa có từ 5 lượt đăng ký)',
      fin.map((c, i) => ({ id: c.MaKH, kind: 'khoa', ten: c.TenKH, hang: i + 1, giaTri: Math.round(c.rate * 100) + '%', nhan: 'hoàn thành', phu: `${c.SoHoanThanh}/${c.SoLuot} lượt · ${c.TenGV}` }))),
  ];
  return { giangVien, khoaHoc };
}

router.get('/', optionalAuth, async (req, res) => {
  try {
    if (!cache || Date.now() - cache.t > TTL) {
      const [hocVien, rest] = await Promise.all([studentHonors(), teacherAndCourseHonors()]);
      cache = { t: Date.now(), data: { capNhat: new Date().toISOString(), hocVien, ...rest } };
    }
    const me = req.user && req.user.role === 'student' ? req.user.ma : null;
    const d = cache.data;
    const mark = (list) => list.map((s) => ({ ...s, items: s.items.map((i) => ({ ...i, laToi: !!me && i.id === me })) }));
    res.json({
      capNhat: d.capNhat,
      hocVien: req.user ? mark(d.hocVien) : null, // khách chưa đăng nhập không thấy tên người học
      giangVien: d.giangVien, khoaHoc: d.khoaHoc,
    });
  } catch (e) { fail(res, e); }
});

module.exports = router;
