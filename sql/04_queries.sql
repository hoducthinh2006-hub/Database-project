-- =====================================================================
-- 15 CÂU TRUY VẤN BÁO CÁO — chạy sau 01_schema.sql + 02_seed_data.sql + 03_views.sql
-- 7 câu đánh (⭐) là câu BẮT BUỘC theo đề bài; 8 câu còn lại bổ sung để
-- phủ đủ kỹ thuật SQL (subquery, HAVING, window function, UNION, NOT IN...).
--
-- Quy ước thống nhất (để không bị hỏi vặn khi bảo vệ):
--  - "Hoàn thành" của 1 lượt đăng ký = DANG_KY.TTDangKy = 'hoan_thanh'
--    (1 nguồn sự thật DUY NHẤT — không trộn với view V_HOAN_THANH để tránh
--     2 định nghĩa "hoàn thành" khác nhau trong cùng báo cáo)
--  - "Doanh thu" CHỈ tính khi có 1 dòng THANH_TOAN với TrangThaiTT='success'
--    (KHÔNG suy ra từ DANG_KY.HocPhi đơn thuần, vì có đăng ký chưa trả tiền)
--  - Trigger trg_mot_lan_thanh_toan đã đảm bảo 1 MaDK tối đa 1 lần success
--    → SUM(HocPhi) qua JOIN với THANH_TOAN không bao giờ bị đếm trùng
--  - Khi đưa vào backend: thay giá trị cứng (2026, 'KH001'...) bằng tham số ?
-- =====================================================================
USE btl_csdl_khoahoc;


-- #####################################################################
-- 🟦 TRÀ — khóa học / đăng ký / giảng viên
-- #####################################################################

-- ---------------------------------------------------------------------
-- 1 ⭐ Danh sách khóa học được đăng ký trong 1 tháng cho trước,
--     sắp theo SỐ LƯỢT đăng ký giảm dần.
--     (đếm theo lượt, không phải đầu người — vì 1 HV có thể đăng ký lại)
-- ---------------------------------------------------------------------
SELECT kh.MaKH, kh.TenKH, COUNT(dk.MaDK) AS SoLuotDangKy
FROM   KHOA_HOC kh
JOIN   DANG_KY dk ON dk.MaKH = kh.MaKH
WHERE  YEAR(dk.NgayDangKy) = 2026 AND MONTH(dk.NgayDangKy) = 8   -- tháng 8/2026
GROUP BY kh.MaKH, kh.TenKH
ORDER BY SoLuotDangKy DESC;

-- ---------------------------------------------------------------------
-- 2 ⭐ Tỷ lệ hoàn thành của các khóa học trong 1 khoảng thời gian cho trước
--     = số lượt TTDangKy='hoan_thanh' / tổng số lượt đăng ký trong khoảng đó
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 3. Khóa học có học phí CAO HƠN học phí trung bình toàn hệ thống
--    (subquery độc lập — không phụ thuộc tham số ngoài)
-- ---------------------------------------------------------------------
SELECT MaKH, TenKH, HocPhi
FROM   KHOA_HOC
WHERE  HocPhi > (SELECT AVG(HocPhi) FROM KHOA_HOC)
ORDER BY HocPhi DESC;

-- ---------------------------------------------------------------------
-- 4. Giảng viên đang dạy từ 2 khóa học trở lên
-- ---------------------------------------------------------------------
SELECT gv.MaGV, gv.HoTen, COUNT(kh.MaKH) AS SoKhoaDay
FROM   GIANG_VIEN gv
JOIN   KHOA_HOC kh ON kh.MaGV = gv.MaGV
GROUP BY gv.MaGV, gv.HoTen
HAVING COUNT(kh.MaKH) >= 2;

-- ---------------------------------------------------------------------
-- 5 🔴 Điểm trung bình của mỗi học viên trong từng khóa học, dựa trên
--     điểm CAO NHẤT của mỗi bài kiểm tra đã làm (không phải điểm lần đầu),
--     sắp giảm dần. Tái dùng view V_DIEM_TB (đã lấy MAX theo MaDK+MaBKT).
-- ---------------------------------------------------------------------
SELECT dk.MaKH, hv.MaHV, hv.HoTen, dk.MaDK, vdt.DiemTrungBinh
FROM   DANG_KY dk
JOIN   HOC_VIEN hv   ON hv.MaHV = dk.MaHV
JOIN   V_DIEM_TB vdt ON vdt.MaDK = dk.MaDK
ORDER BY dk.MaKH, vdt.DiemTrungBinh DESC;


-- #####################################################################
-- 🟩 LỘC — bài học / kiểm tra / tiến độ
-- #####################################################################

-- ---------------------------------------------------------------------
-- 6 ⭐ Thống kê số lượt ĐÃ HOÀN THÀNH / ĐANG HỌC / CHƯA HOÀN THÀNH
--     theo từng khóa học trong 1 khoảng thời gian cho trước. 3 nhóm loại
--     trừ lẫn nhau: "chưa hoàn thành" = chưa bắt đầu học VÀ CHƯA HUỶ.
--     Lượt đã huỷ đếm RIÊNG (cột DaHuy), không gộp vào "chưa hoàn thành".
-- ---------------------------------------------------------------------
SELECT kh.MaKH, kh.TenKH,
       SUM(CASE WHEN dk.TTDangKy = 'hoan_thanh' THEN 1 ELSE 0 END) AS DaHoanThanh,
       SUM(CASE WHEN dk.TTDangKy = 'dang_hoc'   THEN 1 ELSE 0 END) AS DangHoc,
       SUM(CASE WHEN dk.TTDangKy NOT IN ('hoan_thanh','dang_hoc','da_huy') THEN 1 ELSE 0 END) AS ChuaHoanThanh,
       SUM(CASE WHEN dk.TTDangKy = 'da_huy' THEN 1 ELSE 0 END) AS DaHuy
FROM   KHOA_HOC kh
JOIN   DANG_KY dk ON dk.MaKH = kh.MaKH
WHERE  dk.NgayDangKy BETWEEN '2026-08-01' AND '2026-09-30'
GROUP BY kh.MaKH, kh.TenKH;

-- ---------------------------------------------------------------------
-- 7. Bài học kèm tên khóa học + tên giảng viên phụ trách
-- ---------------------------------------------------------------------
SELECT bh.MaBH, bh.TenBH, bh.ThuTu, kh.TenKH, gv.HoTen AS TenGiangVien
FROM   BAI_HOC bh
JOIN   KHOA_HOC kh   ON kh.MaKH = bh.MaKH
JOIN   GIANG_VIEN gv ON gv.MaGV = kh.MaGV
ORDER BY kh.TenKH, bh.ThuTu;

-- ---------------------------------------------------------------------
-- 8. Khóa học CHƯA có học viên nào đăng ký
--    (LEFT JOIN rồi lọc NULL — tương đương NOT EXISTS, dễ đọc hơn)
-- ---------------------------------------------------------------------
SELECT kh.MaKH, kh.TenKH
FROM   KHOA_HOC kh
LEFT JOIN DANG_KY dk ON dk.MaKH = kh.MaKH
WHERE  dk.MaDK IS NULL;

-- ---------------------------------------------------------------------
-- 9. Top 3 khóa học doanh thu cao nhất.
--    QUAN TRỌNG: JOIN thêm THANH_TOAN (chỉ success) — không tính
--    doanh thu từ đăng ký chưa trả tiền hoặc khóa miễn phí không có
--    giao dịch nào.
-- ---------------------------------------------------------------------
SELECT kh.MaKH, kh.TenKH, SUM(dk.HocPhi) AS DoanhThu
FROM   KHOA_HOC kh
JOIN   DANG_KY dk    ON dk.MaKH = kh.MaKH
JOIN   THANH_TOAN tt ON tt.MaDK = dk.MaDK AND tt.TrangThaiTT = 'success'
GROUP BY kh.MaKH, kh.TenKH
ORDER BY DoanhThu DESC
LIMIT 3;

-- ---------------------------------------------------------------------
-- 10 🔴 Xếp hạng học viên theo điểm trung bình TRONG TỪNG khóa học
--      (window function — hạng reset lại ở mỗi khóa nhờ PARTITION BY)
-- ---------------------------------------------------------------------
SELECT dk.MaKH, hv.HoTen, dk.MaDK, vdt.DiemTrungBinh,
       RANK() OVER (PARTITION BY dk.MaKH ORDER BY vdt.DiemTrungBinh DESC) AS XepHang
FROM   DANG_KY dk
JOIN   HOC_VIEN hv   ON hv.MaHV = dk.MaHV
JOIN   V_DIEM_TB vdt ON vdt.MaDK = dk.MaDK
ORDER BY dk.MaKH, XepHang;


-- #####################################################################
-- 🟧 THỊNH — học viên / thanh toán / chứng chỉ / đánh giá
-- #####################################################################

-- ---------------------------------------------------------------------
-- 11 ⭐ Doanh thu hệ thống trong 1 tháng cho trước = tổng giao dịch
--      'thanh_toan' thành công TRỪ tổng giao dịch 'hoan_tien' thành công
--      phát sinh trong tháng (thất bại/đang chờ không tính). Khi 1 lượt
--      đăng ký bị huỷ, doanh thu được điều chỉnh qua dòng hoan_tien chứ
--      KHÔNG xoá dòng thanh_toan cũ — tránh tính trùng/tính thiếu.
-- ---------------------------------------------------------------------
SELECT DATE_FORMAT(tt.ThoiGian, '%Y-%m') AS Thang,
       SUM(CASE WHEN tt.LoaiGiaoDich = 'thanh_toan' THEN tt.SoTien ELSE -tt.SoTien END) AS DoanhThu
FROM   THANH_TOAN tt
WHERE  tt.TrangThaiTT = 'success'
  AND  YEAR(tt.ThoiGian) = 2026 AND MONTH(tt.ThoiGian) = 8
GROUP BY DATE_FORMAT(tt.ThoiGian, '%Y-%m');

-- ---------------------------------------------------------------------
-- 12 ⭐ Đánh giá / nhận xét của học viên theo từng khóa học, theo mốc
--      thời gian (khoảng ngày cho trước)
-- ---------------------------------------------------------------------
SELECT kh.MaKH, kh.TenKH, hv.HoTen, dg.DiemDanhGia, dg.NhanXet, dg.NgayDG
FROM   DANH_GIA dg
JOIN   DANG_KY dk  ON dk.MaDK = dg.MaDK
JOIN   KHOA_HOC kh ON kh.MaKH = dk.MaKH
JOIN   HOC_VIEN hv ON hv.MaHV = dk.MaHV
WHERE  dg.NgayDG BETWEEN '2026-08-01' AND '2026-09-30'
ORDER BY kh.MaKH, dg.NgayDG;

-- ---------------------------------------------------------------------
-- 13. Tỷ lệ học viên có chứng chỉ trên mỗi khóa học
--     (COUNT DISTINCT để không lệch nếu sau này 1 đăng ký có thể có
--     nhiều dòng liên quan — hiện tại CHUNG_CHI.MaDK đã UNIQUE nên 1:1,
--     dùng DISTINCT vẫn đúng và an toàn hơn khi schema thay đổi)
-- ---------------------------------------------------------------------
SELECT kh.MaKH, kh.TenKH,
       COUNT(DISTINCT dk.MaDK) AS TongLuotDangKy,
       COUNT(DISTINCT cc.MaDK) AS SoChungChi,
       ROUND(100.0 * COUNT(DISTINCT cc.MaDK) / COUNT(DISTINCT dk.MaDK), 1) AS TyLeCoChungChi
FROM   KHOA_HOC kh
JOIN   DANG_KY dk ON dk.MaKH = kh.MaKH
LEFT JOIN CHUNG_CHI cc ON cc.MaDK = dk.MaDK
GROUP BY kh.MaKH, kh.TenKH;

-- ---------------------------------------------------------------------
-- 14. Học viên CHƯA từng thanh toán thành công lần nào
--     (NOT IN trên subquery các MaHV đã có ít nhất 1 giao dịch success)
-- ---------------------------------------------------------------------
SELECT hv.MaHV, hv.HoTen, hv.Email
FROM   HOC_VIEN hv
WHERE  hv.MaHV NOT IN (
  SELECT dk.MaHV
  FROM   DANG_KY dk
  JOIN   THANH_TOAN tt ON tt.MaDK = dk.MaDK
  WHERE  tt.TrangThaiTT = 'success'
);

-- ---------------------------------------------------------------------
-- 15. Gộp danh sách email của giảng viên và học viên thành 1 danh sách
--     (UNION — trùng email giữa 2 bảng sẽ tự loại trùng theo UNION chuẩn;
--     dùng UNION ALL nếu muốn giữ cả 2 dòng khi trùng)
-- ---------------------------------------------------------------------
SELECT MaGV AS Ma, HoTen, Email, 'giang_vien' AS VaiTro FROM GIANG_VIEN
UNION
SELECT MaHV AS Ma, HoTen, Email, 'hoc_vien'   AS VaiTro FROM HOC_VIEN
ORDER BY VaiTro, HoTen;
