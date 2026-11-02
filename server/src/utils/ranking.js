// Quy tắc xếp hạng ở một chỗ duy nhất (bảng theo khóa, bảng vàng toàn nền tảng, Vinh danh, "hạng của tôi").
// Điểm 1 bài kiểm tra = điểm CAO NHẤT trong các lần làm; có ngưỡng tối thiểu số bài mới được xếp hạng;
// đồng điểm xét tiếp tiêu chí phụ, bằng hết thì đồng hạng.
const DAY = 24 * 3600 * 1000;

const KHOANG = { tatca: null, thang: 30, tuan: 7 };
const NGUONG_GLOBAL = { tatca: 3, thang: 2, tuan: 1 };
const NGUONG_KHOA = 2;
const M_DANH_GIA = 5; // trọng số điểm nền: ~5 lượt đánh giá thì điểm riêng của khóa mới có sức nặng ngang điểm chung
const MIN_DANH_GIA = 3;

const round2 = (x) => Math.round(Number(x) * 100) / 100;
const since = (days) => (days == null ? null : new Date(Date.now() - days * DAY));

// Gán hạng kiểu "competition ranking": bằng nhau cùng hạng, hạng kế tiếp nhảy cách
function assignRanks(sorted, key) {
  let prev = null, rank = 0;
  sorted.forEach((r, i) => {
    const k = key(r);
    if (k !== prev) { rank = i + 1; prev = k; }
    r.Hang = rank;
  });
  return sorted;
}

// Điểm đánh giá có trọng số (Bayesian average): khóa chỉ có 1 lượt "5 sao" không thể vượt khóa có 50 lượt trung bình 4.8.
//   score = (v / (v + m)) · R + (m / (v + m)) · C      (R: điểm TB của khóa, v: số lượt, C: điểm TB toàn hệ thống, m: M_DANH_GIA)
const weightedRating = (R, v, C, m = M_DANH_GIA) => (v / (v + m)) * R + (m / (v + m)) * C;

// Bảng xếp hạng theo KHÓA — trả về Map maKH → { MaKH, TenKH, tongSoBaiKT, nguong, tongSo, daXepHang, bang:[…] }
async function courseBoards(db, maKHs, viewer) {
  const out = new Map();
  if (!maKHs.length) return out;
  const [khs] = await db.query('SELECT MaKH, TenKH FROM KHOA_HOC WHERE MaKH IN (?)', [maKHs]);
  const [qcount] = await db.query(
    `SELECT bh.MaKH, COUNT(*) AS n FROM BAI_KIEM_TRA bkt JOIN BAI_HOC bh ON bh.MaBH = bkt.MaBH
      WHERE bh.MaKH IN (?) AND bkt.TrangThai = 'active' GROUP BY bh.MaKH`, [maKHs]);
  const [enrolled] = await db.query(
    `SELECT dk.MaKH, hv.MaHV, hv.HoTen,
            MAX(COALESCE(td.TienDoPhanTram, 0)) AS TienDo, MAX(dk.TTDangKy = 'hoan_thanh') AS DaHoanThanh
       FROM DANG_KY dk JOIN HOC_VIEN hv ON hv.MaHV = dk.MaHV JOIN V_TIEN_DO td ON td.MaDK = dk.MaDK
      WHERE dk.MaKH IN (?) AND dk.TTDangKy <> 'da_huy' AND hv.TrangThaiTK = 'active'
      GROUP BY dk.MaKH, hv.MaHV, hv.HoTen`, [maKHs]);
  const [best] = await db.query(
    // Best quy đổi về thang 10 theo DiemToiDa của chính bài đó — cùng công thức view V_DIEM_TB
    `SELECT bh.MaKH, dk.MaHV, kq.MaBKT, MAX(kq.DiemSo) / bkt.DiemToiDa * 10 AS Best, COUNT(*) AS Lan
       FROM KET_QUA kq JOIN BAI_KIEM_TRA bkt ON bkt.MaBKT = kq.MaBKT AND bkt.TrangThai = 'active'
       JOIN BAI_HOC bh ON bh.MaBH = bkt.MaBH JOIN DANG_KY dk ON dk.MaDK = kq.MaDK
      WHERE bh.MaKH IN (?) AND dk.TTDangKy <> 'da_huy'
      GROUP BY bh.MaKH, dk.MaHV, kq.MaBKT`, [maKHs]);

  const soKT = Object.fromEntries(qcount.map((r) => [r.MaKH, Number(r.n)]));
  const scoreOf = new Map(); // "maKH|maHV" → [điểm từng bài]
  const lanOf = new Map(); // "maKH|maHV" → tổng số lượt làm bài
  best.forEach((r) => {
    const k = r.MaKH + '|' + r.MaHV;
    (scoreOf.get(k) || scoreOf.set(k, []).get(k)).push(Number(r.Best));
    lanOf.set(k, (lanOf.get(k) || 0) + Number(r.Lan));
  });

  for (const kh of khs) {
    const tong = soKT[kh.MaKH] || 0, nguong = tong === 0 ? 0 : Math.min(NGUONG_KHOA, tong);
    const rows = enrolled.filter((e) => e.MaKH === kh.MaKH).map((e) => {
      const sc = scoreOf.get(kh.MaKH + '|' + e.MaHV) || [];
      return {
        MaHV: e.MaHV, HoTen: e.HoTen, TienDo: Number(e.TienDo), DaHoanThanh: !!e.DaHoanThanh,
        SoBaiKTDaLam: sc.length, SoLanLam: lanOf.get(kh.MaKH + '|' + e.MaHV) || 0, DiemTB: sc.length ? round2(sc.reduce((a, b) => a + b, 0) / sc.length) : null,
        DuDieuKien: nguong > 0 && sc.length >= nguong,
        CanLamThem: nguong > 0 ? Math.max(0, nguong - sc.length) : 0,
        LaToi: !!viewer && e.MaHV === viewer,
      };
    });
    const ok = rows.filter((r) => r.DuDieuKien)
      .sort((a, b) => b.DiemTB - a.DiemTB || b.TienDo - a.TienDo || b.SoBaiKTDaLam - a.SoBaiKTDaLam || a.SoLanLam - b.SoLanLam || a.HoTen.localeCompare(b.HoTen, 'vi'));
    assignRanks(ok, (r) => `${r.DiemTB}|${Math.round(r.TienDo)}|${r.SoBaiKTDaLam}|${r.SoLanLam}`);
    const rest = rows.filter((r) => !r.DuDieuKien)
      .sort((a, b) => b.SoBaiKTDaLam - a.SoBaiKTDaLam || b.TienDo - a.TienDo || a.HoTen.localeCompare(b.HoTen, 'vi'));
    rest.forEach((r) => { r.Hang = null; });
    out.set(kh.MaKH, { MaKH: kh.MaKH, TenKH: kh.TenKH, tongSoBaiKT: tong, nguong, tongSo: rows.length, daXepHang: ok.length, bang: [...ok, ...rest] });
  }
  return out;
}

// Bảng vàng TOÀN NỀN TẢNG — tieuChi 'diem' (điểm TB) | 'chamchi' (số bài học hoàn thành), khoang 'tatca'|'thang'|'tuan'
async function globalBoard(db, { tieuChi = 'diem', khoang = 'tatca' } = {}, viewer) {
  const from = since(KHOANG[khoang]);
  const fromSql = from ? ' AND kq.ThoiGianLam >= ?' : '';
  const [students] = await db.query(`SELECT MaHV, HoTen FROM HOC_VIEN WHERE TrangThaiTK = 'active'`);
  const [best] = await db.query(
    `SELECT dk.MaHV, bh.MaKH, kq.MaBKT, MAX(kq.DiemSo) / bkt.DiemToiDa * 10 AS Best, MAX(kq.ThoiGianLam) AS Cuoi
       FROM KET_QUA kq JOIN DANG_KY dk ON dk.MaDK = kq.MaDK
       JOIN BAI_KIEM_TRA bkt ON bkt.MaBKT = kq.MaBKT JOIN BAI_HOC bh ON bh.MaBH = bkt.MaBH
      WHERE dk.TTDangKy <> 'da_huy'${fromSql} GROUP BY dk.MaHV, bh.MaKH, kq.MaBKT`, from ? [from] : []);
  const [les] = await db.query(
    `SELECT dk.MaHV, COUNT(DISTINCT ls.MaDK, ls.MaBH) AS n FROM LICH_SU_HOC_TAP ls JOIN DANG_KY dk ON dk.MaDK = ls.MaDK
      WHERE ls.TrangThaiHoanThanh = 'hoan_thanh' AND dk.TTDangKy <> 'da_huy'${from ? ' AND ls.ThoiDiemHoc >= ?' : ''} GROUP BY dk.MaHV`, from ? [from] : []);
  const [cer] = await db.query(
    `SELECT dk.MaHV, COUNT(*) AS n FROM CHUNG_CHI cc JOIN DANG_KY dk ON dk.MaDK = cc.MaDK
      WHERE 1 = 1${from ? ' AND cc.NgayCap >= DATE(?)' : ''} GROUP BY dk.MaHV`, from ? [from] : []);

  const sc = new Map(), crs = new Map();
  best.forEach((r) => { (sc.get(r.MaHV) || sc.set(r.MaHV, []).get(r.MaHV)).push(Number(r.Best)); (crs.get(r.MaHV) || crs.set(r.MaHV, new Set()).get(r.MaHV)).add(r.MaKH); });
  const lesOf = Object.fromEntries(les.map((r) => [r.MaHV, Number(r.n)]));
  const cerOf = Object.fromEntries(cer.map((r) => [r.MaHV, Number(r.n)]));
  const nguong = NGUONG_GLOBAL[khoang] || NGUONG_GLOBAL.tatca;

  const rows = students.map((s) => {
    const a = sc.get(s.MaHV) || [];
    return {
      MaHV: s.MaHV, HoTen: s.HoTen, DiemTB: a.length ? round2(a.reduce((x, y) => x + y, 0) / a.length) : null,
      SoBaiKT: a.length, SoKhoa: (crs.get(s.MaHV) || new Set()).size, SoBaiHoc: lesOf[s.MaHV] || 0, SoChungChi: cerOf[s.MaHV] || 0,
      LaToi: !!viewer && s.MaHV === viewer,
    };
  }).filter((r) => r.SoBaiKT > 0 || r.SoBaiHoc > 0 || r.LaToi);

  let ranked, rest;
  if (tieuChi === 'chamchi') {
    ranked = rows.filter((r) => r.SoBaiHoc >= 1)
      .sort((a, b) => b.SoBaiHoc - a.SoBaiHoc || b.SoBaiKT - a.SoBaiKT || (b.DiemTB || 0) - (a.DiemTB || 0) || a.HoTen.localeCompare(b.HoTen, 'vi'));
    assignRanks(ranked, (r) => `${r.SoBaiHoc}|${r.SoBaiKT}|${r.DiemTB}`);
    rest = rows.filter((r) => r.SoBaiHoc < 1);
  } else {
    ranked = rows.filter((r) => r.SoBaiKT >= nguong)
      .sort((a, b) => b.DiemTB - a.DiemTB || b.SoChungChi - a.SoChungChi || b.SoBaiKT - a.SoBaiKT || b.SoBaiHoc - a.SoBaiHoc || a.HoTen.localeCompare(b.HoTen, 'vi'));
    assignRanks(ranked, (r) => `${r.DiemTB}|${r.SoChungChi}|${r.SoBaiKT}|${r.SoBaiHoc}`);
    rest = rows.filter((r) => r.SoBaiKT < nguong);
  }
  rest.forEach((r) => { r.Hang = null; r.CanLamThem = tieuChi === 'chamchi' ? 1 : Math.max(0, nguong - r.SoBaiKT); });
  const top = ranked.slice(0, 50), me = [...ranked.slice(50), ...rest].filter((r) => r.LaToi); // luôn kèm dòng của người xem dù ngoài top
  return { tieuChi, khoang, nguong: tieuChi === 'chamchi' ? 1 : nguong, daXepHang: ranked.length, bang: [...top, ...me], tongSo: ranked.length };
}

// Điểm đánh giá khóa học (có trọng số)
async function ratedCourses(db) {
  const [rows] = await db.query(
    `SELECT kh.MaKH, kh.TenKH, kh.MaGV, gv.HoTen AS TenGV, kh.LinhVuc,
            COUNT(dg.MaDG) AS SoDanhGia, AVG(dg.DiemDanhGia) AS DiemTB,
            (SELECT COUNT(DISTINCT dk2.MaHV) FROM DANG_KY dk2 WHERE dk2.MaKH = kh.MaKH AND dk2.TTDangKy <> 'da_huy') AS SoHocVien,
            (SELECT COUNT(*) FROM DANG_KY dk3 WHERE dk3.MaKH = kh.MaKH AND dk3.TTDangKy <> 'da_huy') AS SoLuot,
            (SELECT COUNT(*) FROM DANG_KY dk4 WHERE dk4.MaKH = kh.MaKH AND dk4.TTDangKy = 'hoan_thanh') AS SoHoanThanh
       FROM KHOA_HOC kh JOIN GIANG_VIEN gv ON gv.MaGV = kh.MaGV
       LEFT JOIN DANG_KY dk ON dk.MaKH = kh.MaKH AND dk.TTDangKy <> 'da_huy'
       LEFT JOIN DANH_GIA dg ON dg.MaDK = dk.MaDK
      WHERE kh.TrangThai = 'published' GROUP BY kh.MaKH, kh.TenKH, kh.MaGV, gv.HoTen, kh.LinhVuc`);
  const tongLuot = rows.reduce((s, r) => s + Number(r.SoDanhGia), 0);
  const C = tongLuot ? rows.reduce((s, r) => s + (Number(r.DiemTB) || 0) * Number(r.SoDanhGia), 0) / tongLuot : 4;
  return {
    C: round2(C),
    courses: rows.map((r) => {
      const v = Number(r.SoDanhGia), R = v ? Number(r.DiemTB) : null;
      return {
        MaKH: r.MaKH, TenKH: r.TenKH, MaGV: r.MaGV, TenGV: r.TenGV, LinhVuc: r.LinhVuc, SoDanhGia: v, DiemTB: R != null ? round2(R) : null,
        DiemXepHang: v ? round2(weightedRating(R, v, C)) : null, SoHocVien: Number(r.SoHocVien), SoLuot: Number(r.SoLuot), SoHoanThanh: Number(r.SoHoanThanh),
      };
    }),
  };
}

module.exports = { courseBoards, globalBoard, ratedCourses, weightedRating, assignRanks, round2, NGUONG_GLOBAL, NGUONG_KHOA, M_DANH_GIA, MIN_DANH_GIA, KHOANG };
