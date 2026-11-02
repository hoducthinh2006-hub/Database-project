-- =====================================================================
-- 15 CÂU TRUY VẤN BÁO CÁO — chạy sau 01_schema.sql + 02_seed_data.sql + 03_views.sql
-- 7 câu ⭐ là bắt buộc theo đề bài; 8 câu còn lại bổ sung để phủ kỹ thuật SQL.
-- Quy ước: "hoàn thành" = DANG_KY.TTDangKy='hoan_thanh' (1 nguồn sự thật duy nhất);
-- "doanh thu" chỉ tính khi có dòng THANH_TOAN TrangThaiTT='success'.
-- =====================================================================
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

-- 3. Khóa học có học phí cao hơn học phí trung bình toàn hệ thống
SELECT MaKH, TenKH, HocPhi
FROM   KHOA_HOC
WHERE  HocPhi > (SELECT AVG(HocPhi) FROM KHOA_HOC)
ORDER BY HocPhi DESC;

-- 4. Giảng viên đang dạy từ 2 khóa học trở lên
SELECT gv.MaGV, gv.HoTen, COUNT(kh.MaKH) AS SoKhoaDay
FROM   GIANG_VIEN gv
JOIN   KHOA_HOC kh ON kh.MaGV = gv.MaGV
GROUP BY gv.MaGV, gv.HoTen
HAVING COUNT(kh.MaKH) >= 2;

-- 5. Điểm trung bình của mỗi học viên trong từng khóa học (dùng view V_DIEM_TB), sắp giảm dần
SELECT dk.MaKH, hv.MaHV, hv.HoTen, dk.MaDK, vdt.DiemTrungBinh
FROM   DANG_KY dk
JOIN   HOC_VIEN hv   ON hv.MaHV = dk.MaHV
JOIN   V_DIEM_TB vdt ON vdt.MaDK = dk.MaDK
ORDER BY dk.MaKH, vdt.DiemTrungBinh DESC;

-- 6. Thống kê số lượt đã hoàn thành / đang học / chưa hoàn thành / đã huỷ theo khóa, trong 1 khoảng thời gian
SELECT kh.MaKH, kh.TenKH,
       SUM(CASE WHEN dk.TTDangKy = 'hoan_thanh' THEN 1 ELSE 0 END) AS DaHoanThanh,
       SUM(CASE WHEN dk.TTDangKy = 'dang_hoc'   THEN 1 ELSE 0 END) AS DangHoc,
       SUM(CASE WHEN dk.TTDangKy NOT IN ('hoan_thanh','dang_hoc','da_huy') THEN 1 ELSE 0 END) AS ChuaHoanThanh,
       SUM(CASE WHEN dk.TTDangKy = 'da_huy' THEN 1 ELSE 0 END) AS DaHuy
FROM   KHOA_HOC kh
JOIN   DANG_KY dk ON dk.MaKH = kh.MaKH
WHERE  dk.NgayDangKy BETWEEN '2026-08-01' AND '2026-09-30'
GROUP BY kh.MaKH, kh.TenKH;

-- 7. Bài học kèm tên khóa học + tên giảng viên phụ trách
SELECT bh.MaBH, bh.TenBH, bh.ThuTu, kh.TenKH, gv.HoTen AS TenGiangVien
FROM   BAI_HOC bh
JOIN   KHOA_HOC kh   ON kh.MaKH = bh.MaKH
JOIN   GIANG_VIEN gv ON gv.MaGV = kh.MaGV
ORDER BY kh.TenKH, bh.ThuTu;

-- 8. Khóa học chưa có học viên nào đăng ký
SELECT kh.MaKH, kh.TenKH
FROM   KHOA_HOC kh
LEFT JOIN DANG_KY dk ON dk.MaKH = kh.MaKH
WHERE  dk.MaDK IS NULL;

-- 9. Top 3 khóa học doanh thu cao nhất (chỉ tính giao dịch THANH_TOAN success)
SELECT kh.MaKH, kh.TenKH, SUM(dk.HocPhi) AS DoanhThu
FROM   KHOA_HOC kh
JOIN   DANG_KY dk    ON dk.MaKH = kh.MaKH
JOIN   THANH_TOAN tt ON tt.MaDK = dk.MaDK AND tt.TrangThaiTT = 'success'
GROUP BY kh.MaKH, kh.TenKH
ORDER BY DoanhThu DESC
LIMIT 3;

-- 10. Xếp hạng học viên theo điểm trung bình trong từng khóa học (window function, PARTITION BY khóa)
SELECT dk.MaKH, hv.HoTen, dk.MaDK, vdt.DiemTrungBinh,
       RANK() OVER (PARTITION BY dk.MaKH ORDER BY vdt.DiemTrungBinh DESC) AS XepHang
FROM   DANG_KY dk
JOIN   HOC_VIEN hv   ON hv.MaHV = dk.MaHV
JOIN   V_DIEM_TB vdt ON vdt.MaDK = dk.MaDK
ORDER BY dk.MaKH, XepHang;

-- 11. Doanh thu hệ thống trong 1 tháng = tổng 'thanh_toan' thành công trừ tổng 'hoan_tien' thành công
SELECT DATE_FORMAT(tt.ThoiGian, '%Y-%m') AS Thang,
       SUM(CASE WHEN tt.LoaiGiaoDich = 'thanh_toan' THEN tt.SoTien ELSE -tt.SoTien END) AS DoanhThu
FROM   THANH_TOAN tt
WHERE  tt.TrangThaiTT = 'success'
  AND  YEAR(tt.ThoiGian) = 2026 AND MONTH(tt.ThoiGian) = 8
GROUP BY DATE_FORMAT(tt.ThoiGian, '%Y-%m');

-- 12. Đánh giá / nhận xét của học viên theo từng khóa học, trong 1 khoảng thời gian
SELECT kh.MaKH, kh.TenKH, hv.HoTen, dg.DiemDanhGia, dg.NhanXet, dg.NgayDG
FROM   DANH_GIA dg
JOIN   DANG_KY dk  ON dk.MaDK = dg.MaDK
JOIN   KHOA_HOC kh ON kh.MaKH = dk.MaKH
JOIN   HOC_VIEN hv ON hv.MaHV = dk.MaHV
WHERE  dg.NgayDG BETWEEN '2026-08-01' AND '2026-09-30'
ORDER BY kh.MaKH, dg.NgayDG;

-- 13. Tỷ lệ học viên có chứng chỉ trên mỗi khóa học
SELECT kh.MaKH, kh.TenKH,
       COUNT(DISTINCT dk.MaDK) AS TongLuotDangKy,
       COUNT(DISTINCT cc.MaDK) AS SoChungChi,
       ROUND(100.0 * COUNT(DISTINCT cc.MaDK) / COUNT(DISTINCT dk.MaDK), 1) AS TyLeCoChungChi
FROM   KHOA_HOC kh
JOIN   DANG_KY dk ON dk.MaKH = kh.MaKH
LEFT JOIN CHUNG_CHI cc ON cc.MaDK = dk.MaDK
GROUP BY kh.MaKH, kh.TenKH;

-- 14. Học viên chưa từng thanh toán thành công lần nào
SELECT hv.MaHV, hv.HoTen, hv.Email
FROM   HOC_VIEN hv
WHERE  hv.MaHV NOT IN (
  SELECT dk.MaHV
  FROM   DANG_KY dk
  JOIN   THANH_TOAN tt ON tt.MaDK = dk.MaDK
  WHERE  tt.TrangThaiTT = 'success'
);

-- 15. Gộp danh sách email của giảng viên và học viên thành 1 danh sách (UNION)
SELECT MaGV AS Ma, HoTen, Email, 'giang_vien' AS VaiTro FROM GIANG_VIEN
UNION
SELECT MaHV AS Ma, HoTen, Email, 'hoc_vien'   AS VaiTro FROM HOC_VIEN
ORDER BY VaiTro, HoTen;
