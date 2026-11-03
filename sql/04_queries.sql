USE btl_csdl_khoahoc;

-- 1. Danh sách khóa học được đăng ký trong 1 tháng, sắp theo số LƯỢT đăng ký giảm dần
SELECT kh.MaKH, kh.TenKH, COUNT(dk.MaDK) AS SoLuotDangKy
FROM   KHOA_HOC kh
JOIN   DANG_KY dk ON dk.MaKH = kh.MaKH
WHERE  YEAR(dk.NgayDangKy) = 2026 AND MONTH(dk.NgayDangKy) = 8   -- tháng 8/2026
GROUP BY kh.MaKH, kh.TenKH
ORDER BY SoLuotDangKy DESC;

-- 2. Tỷ lệ hoàn thành của các khóa học trong 1 khoảng thời gian
SELECT kh.MaKH, kh.TenKH,
       COUNT(dk.MaDK) AS TongLuotDangKy,
       SUM(CASE WHEN dk.TTDangKy = 'hoan_thanh' THEN 1 ELSE 0 END) AS SoLuotHoanThanh,
       ROUND(100.0 * SUM(CASE WHEN dk.TTDangKy = 'hoan_thanh' THEN 1 ELSE 0 END)
             / COUNT(dk.MaDK), 1) AS TyLeHoanThanh
FROM   KHOA_HOC kh
JOIN   DANG_KY dk ON dk.MaKH = kh.MaKH
WHERE  dk.NgayDangKy BETWEEN '2026-08-01' AND '2026-09-30'
GROUP BY kh.MaKH, kh.TenKH
ORDER BY TyLeHoanThanh DESC;

-- 3. Lịch sử học tập đầy đủ của 1 học viên: các lần đăng ký khóa học, tiến độ từng bài học, điểm, thời gian làm của từng lần kiểm tra theo bài học, trạng thái hoàn thành và thông tin chứng chỉ

SELECT dk.MaDK, kh.TenKH,
       'Đăng ký khóa học' AS LoaiSuKien,
       CONCAT('Trạng thái: ', dk.TTDangKy,
              IFNULL(CONCAT(' — Tiến độ: ', td.TienDoPhanTram, '%'), ''),
              IFNULL(CONCAT(' — Điểm TB: ', ROUND(dt.DiemTrungBinh, 1)), '')) AS ChiTiet,
       CAST(dk.NgayDangKy AS DATETIME) AS ThoiDiem
FROM   DANG_KY dk
JOIN   KHOA_HOC kh    ON kh.MaKH = dk.MaKH
LEFT JOIN V_TIEN_DO td ON td.MaDK = dk.MaDK
LEFT JOIN V_DIEM_TB dt ON dt.MaDK = dk.MaDK
WHERE  dk.MaHV = 'HV001'

UNION ALL

SELECT dk.MaDK, kh.TenKH,
       'Tiến độ bài học' AS LoaiSuKien,
       CONCAT(bh.TenBH, ' — ', ls.TrangThaiHoanThanh, ' (+', ls.TienDoTangThem, '%)') AS ChiTiet,
       ls.ThoiDiemHoc AS ThoiDiem
FROM   LICH_SU_HOC_TAP ls
JOIN   DANG_KY dk  ON dk.MaDK = ls.MaDK
JOIN   KHOA_HOC kh ON kh.MaKH = dk.MaKH
JOIN   BAI_HOC bh  ON bh.MaBH = ls.MaBH
WHERE  dk.MaHV = 'HV001'

UNION ALL

SELECT dk.MaDK, kh.TenKH,
       'Kết quả kiểm tra' AS LoaiSuKien,
       CONCAT(bkt.TenBKT, ' — Lần ', kq.LanLam, ': ', kq.DiemSo, '/', bkt.DiemToiDa, ' điểm') AS ChiTiet,
       kq.ThoiGianLam AS ThoiDiem
FROM   KET_QUA kq
JOIN   DANG_KY dk      ON dk.MaDK = kq.MaDK
JOIN   KHOA_HOC kh     ON kh.MaKH = dk.MaKH
JOIN   BAI_KIEM_TRA bkt ON bkt.MaBKT = kq.MaBKT
WHERE  dk.MaHV = 'HV001'

UNION ALL

SELECT dk.MaDK, kh.TenKH,
       'Chứng chỉ' AS LoaiSuKien,
       CONCAT('Cấp ngày ', cc.NgayCap, ' — ', cc.HieuLuc) AS ChiTiet,
       CAST(cc.NgayCap AS DATETIME) AS ThoiDiem
FROM   CHUNG_CHI cc
JOIN   DANG_KY dk  ON dk.MaDK = cc.MaDK
JOIN   KHOA_HOC kh ON kh.MaKH = dk.MaKH
WHERE  dk.MaHV = 'HV001'

ORDER BY MaDK, ThoiDiem;

-- 4. Điểm trung bình của học viên trong từng khóa học (dựa điểm cao nhất mỗi bài kiểm tra, dùng view V_DIEM_TB), sắp giảm dần
SELECT dk.MaKH, hv.MaHV, hv.HoTen, dk.MaDK, vdt.DiemTrungBinh
FROM   DANG_KY dk
JOIN   HOC_VIEN hv   ON hv.MaHV = dk.MaHV
JOIN   V_DIEM_TB vdt ON vdt.MaDK = dk.MaDK
ORDER BY dk.MaKH, vdt.DiemTrungBinh DESC;

-- 5. Thống kê số lượt đã hoàn thành / đang học / chưa hoàn thành / đã huỷ theo khóa, trong 1 khoảng thời gian
WITH TrangThai AS (
   SELECT dk.MaDK, dk.MaKH,
          CASE
            WHEN dk.TTDangKy = 'da_huy' OR dk.NgayHuy IS NOT NULL
                 THEN 'DaHuy'
            WHEN COALESCE(td.TienDoPhanTram, 0) = 100
                 AND dt.DiemTrungBinh >= 7 THEN 'HoanThanh'
            WHEN EXISTS (SELECT 1 FROM LICH_SU_HOC_TAP ls
                         WHERE ls.MaDK = dk.MaDK)
              OR EXISTS (SELECT 1 FROM KET_QUA kq
                         WHERE kq.MaDK = dk.MaDK) THEN 'DangHoc'
            ELSE 'ChuaHoanThanh'
          END AS Nhom
   FROM DANG_KY dk
   LEFT JOIN V_TIEN_DO td ON td.MaDK = dk.MaDK
   LEFT JOIN V_DIEM_TB dt ON dt.MaDK = dk.MaDK
   WHERE dk.NgayDangKy >= '2026-08-01'
     AND dk.NgayDangKy < '2026-09-30'
)
SELECT kh.MaKH, kh.TenKH,
      SUM(t.Nhom = 'HoanThanh') AS DaHoanThanh,
      SUM(t.Nhom = 'DangHoc') AS DangHoc,
      SUM(t.Nhom = 'ChuaHoanThanh') AS ChuaHoanThanh,
      SUM(t.Nhom = 'DaHuy') AS DaHuy
FROM TrangThai t
JOIN KHOA_HOC kh ON kh.MaKH = t.MaKH
GROUP BY kh.MaKH, kh.TenKH
ORDER BY kh.MaKH;

-- 6. Doanh thu hệ thống trong 1 tháng = tổng 'thanh_toan' thành công trừ tổng 'hoan_tien' thành công
SELECT DATE_FORMAT(tt.ThoiGian, '%Y-%m') AS Thang,
       SUM(CASE WHEN tt.LoaiGiaoDich = 'thanh_toan' THEN tt.SoTien ELSE -tt.SoTien END) AS DoanhThu
FROM   THANH_TOAN tt
WHERE  tt.TrangThaiTT = 'success'
  AND  YEAR(tt.ThoiGian) = 2026 AND MONTH(tt.ThoiGian) = 8
GROUP BY DATE_FORMAT(tt.ThoiGian, '%Y-%m');

-- 7. Đánh giá / nhận xét của học viên theo từng khóa học, trong 1 khoảng thời gian
SELECT kh.MaKH, kh.TenKH, hv.HoTen, dg.DiemDanhGia, dg.NhanXet, dg.NgayDG
FROM   DANH_GIA dg
JOIN   DANG_KY dk  ON dk.MaDK = dg.MaDK
JOIN   KHOA_HOC kh ON kh.MaKH = dk.MaKH
JOIN   HOC_VIEN hv ON hv.MaHV = dk.MaHV
WHERE  dg.NgayDG BETWEEN '2026-08-01' AND '2026-09-30'
ORDER BY kh.MaKH, dg.NgayDG;

-- ===================== TRUY VẤN BỔ SUNG =====================

-- 8. Khóa học có học phí cao hơn học phí trung bình toàn hệ thống
SELECT MaKH, TenKH, HocPhi
FROM   KHOA_HOC
WHERE  HocPhi > (SELECT AVG(HocPhi) FROM KHOA_HOC)
ORDER BY HocPhi DESC;

-- 9. Giảng viên đang dạy từ 2 khóa học trở lên
SELECT gv.MaGV, gv.HoTen, COUNT(kh.MaKH) AS SoKhoaDay
FROM   GIANG_VIEN gv
JOIN   KHOA_HOC kh ON kh.MaGV = gv.MaGV
GROUP BY gv.MaGV, gv.HoTen
HAVING COUNT(kh.MaKH) >= 2;

-- 10. Bài học kèm tên khóa học + tên giảng viên phụ trách
SELECT bh.MaBH, bh.TenBH, bh.ThuTu, kh.TenKH, gv.HoTen AS TenGiangVien
FROM   BAI_HOC bh
JOIN   KHOA_HOC kh   ON kh.MaKH = bh.MaKH
JOIN   GIANG_VIEN gv ON gv.MaGV = kh.MaGV
ORDER BY kh.TenKH, bh.ThuTu;

-- 11. Khóa học chưa có học viên nào đăng ký
SELECT kh.MaKH, kh.TenKH
FROM   KHOA_HOC kh
LEFT JOIN DANG_KY dk ON dk.MaKH = kh.MaKH
WHERE  dk.MaDK IS NULL;

-- 12. Top 3 khóa học doanh thu cao nhất (chỉ tính giao dịch THANH_TOAN success)
SELECT kh.MaKH, kh.TenKH, SUM(dk.HocPhi) AS DoanhThu
FROM   KHOA_HOC kh
JOIN   DANG_KY dk    ON dk.MaKH = kh.MaKH
JOIN   THANH_TOAN tt ON tt.MaDK = dk.MaDK AND tt.TrangThaiTT = 'success'
GROUP BY kh.MaKH, kh.TenKH
ORDER BY DoanhThu DESC
LIMIT 3;

-- 13. Xếp hạng học viên theo điểm trung bình trong từng khóa học (window function, PARTITION BY khóa)
SELECT dk.MaKH, hv.HoTen, dk.MaDK, vdt.DiemTrungBinh,
       RANK() OVER (PARTITION BY dk.MaKH ORDER BY vdt.DiemTrungBinh DESC) AS XepHang
FROM   DANG_KY dk
JOIN   HOC_VIEN hv   ON hv.MaHV = dk.MaHV
JOIN   V_DIEM_TB vdt ON vdt.MaDK = dk.MaDK
ORDER BY dk.MaKH, XepHang;

-- 14. Tỷ lệ học viên có chứng chỉ trên mỗi khóa học
SELECT kh.MaKH, kh.TenKH,
       COUNT(DISTINCT dk.MaDK) AS TongLuotDangKy,
       COUNT(DISTINCT cc.MaDK) AS SoChungChi,
       ROUND(100.0 * COUNT(DISTINCT cc.MaDK) / COUNT(DISTINCT dk.MaDK), 1) AS TyLeCoChungChi
FROM   KHOA_HOC kh
JOIN   DANG_KY dk ON dk.MaKH = kh.MaKH
LEFT JOIN CHUNG_CHI cc ON cc.MaDK = dk.MaDK
GROUP BY kh.MaKH, kh.TenKH;

-- 15. Học viên chưa từng thanh toán thành công lần nào
SELECT hv.MaHV, hv.HoTen, hv.Email
FROM   HOC_VIEN hv
WHERE  hv.MaHV NOT IN (
  SELECT dk.MaHV
  FROM   DANG_KY dk
  JOIN   THANH_TOAN tt ON tt.MaDK = dk.MaDK
  WHERE  tt.TrangThaiTT = 'success'
);

-- 16. Gộp danh sách email của giảng viên và học viên thành 1 danh sách (UNION)
SELECT MaGV AS Ma, HoTen, Email, 'giang_vien' AS VaiTro FROM GIANG_VIEN
UNION
SELECT MaHV AS Ma, HoTen, Email, 'hoc_vien'   AS VaiTro FROM HOC_VIEN
ORDER BY VaiTro, HoTen;
