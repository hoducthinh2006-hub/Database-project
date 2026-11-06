-- =====================================================================
-- (TUỲ CHỌN) Dữ liệu demo cho tính năng "Thời hạn truy cập + Đăng ký lại".
-- Quy tắc: CÒN hạn → học viên cứ vào xem/ôn tập lại bình thường. ĐÃ hết hạn → nội dung bị khóa lại,
-- phải bấm "Đăng ký lại" và thanh toán theo học phí hiện tại mới học tiếp được.
--
-- THỨ TỰ NẠP:  01_schema → 02_seed_data → 03_views → 05_seed_demo → 06_seed_han_truy_cap
--              (05b_dich_ngay_ve_hom_nay là tùy chọn, chạy cuối cùng nếu muốn dời mốc ngày về hôm nay)
-- File này dùng mã (HV039+, DK134+, LS380+, KQ184+, TT098+, CC043+, DG050+) nằm SAU mã lớn nhất của 05
-- nên nạp chung với 05 không bị trùng khóa chính. Chỉ cần có 02 (không có 05 vẫn chạy được nếu bỏ phần 1b).
--
-- 1) Thời hạn của các khóa:   KH001=6 tháng · KH003=3 tháng · KH002=vĩnh viễn
--    1b) (cần 05) KH004=12 tháng · KH006=6 tháng · KH007=6 tháng · KH008=3 tháng · KH010=12 tháng · KH013=3 tháng
--        các khóa còn lại để vĩnh viễn → số lượt "còn hạn / hết hạn / vĩnh viễn" tự phân bố theo ngày đăng ký của 05.
-- 2) Học viên mới dành riêng để test:
--      mai.dang@email.com  (HV039): KH001 hoàn thành + CÒN hạn         → xem/ôn tập bình thường
--      bao.ly@email.com    (HV040): KH001 hoàn thành + ĐÃ hết hạn      → bị khóa, có nút "Đăng ký lại"
--                                   KH003 đã trả tiền, chưa học, ĐÃ hết hạn → vẫn bị khóa dù đã trả tiền
--      ngoc.vu@email.com   (HV002): KH002 hoàn thành + VĨNH VIỄN        → không có dòng "hạn dùng"
-- (Dùng tài khoản MỚI cho các ca hết hạn vì 05 đã cho HV003 một lượt KH001 mới hơn, sẽ che lượt cũ.)
-- =====================================================================
USE btl_csdl_khoahoc;
SET NAMES utf8mb4;

SET @pw = '$2a$10$nEBROmqqq3AkMUFy/OOstOhbO.Sx6JhV5iaP8Dz/s0NUTsHYYAIFe'; -- mật khẩu demo: 123456

-- 0) Hai học viên mới
INSERT INTO HOC_VIEN (MaHV, HoTen, Email, MatKhauHash, SoDienThoai, NgaySinh, NgayDK, TrangThaiTK) VALUES
('HV039', N'Đặng Thị Mai', 'mai.dang@email.com', @pw, '0904444444', '2000-07-15', '2026-08-10', 'active'),
('HV040', N'Lý Quốc Bảo',  'bao.ly@email.com',   @pw, '0905555555', '1999-03-02', '2026-01-20', 'active');

-- 1) Thời hạn cho 3 khóa của 02_seed_data.sql
UPDATE KHOA_HOC SET ThoiHanTruyCap = 180  WHERE MaKH = 'KH001'; -- 6 tháng
UPDATE KHOA_HOC SET ThoiHanTruyCap = NULL WHERE MaKH = 'KH002'; -- vĩnh viễn
UPDATE KHOA_HOC SET ThoiHanTruyCap = 90   WHERE MaKH = 'KH003'; -- 3 tháng

-- 1b) Thêm thời hạn cho một số khóa của 05_seed_demo.sql (không có 05 thì các dòng này không làm gì cả)
UPDATE KHOA_HOC SET ThoiHanTruyCap = 365 WHERE MaKH IN ('KH004', 'KH010'); -- 12 tháng
UPDATE KHOA_HOC SET ThoiHanTruyCap = 180 WHERE MaKH IN ('KH006', 'KH007'); -- 6 tháng
UPDATE KHOA_HOC SET ThoiHanTruyCap = 90  WHERE MaKH IN ('KH008', 'KH013'); -- 3 tháng

-- 2) Lượt đăng ký mới
INSERT INTO DANG_KY (MaDK, MaHV, MaKH, HocPhi, NgayDangKy, NgayHuy, TTDangKy) VALUES
('DK134', 'HV040', 'KH001', 499000, '2026-02-01', NULL, 'hoan_thanh'),   -- hoàn thành, 180 ngày đã trôi qua → hết hạn
('DK135', 'HV002', 'KH002', 0,      '2026-08-12', NULL, 'hoan_thanh'),   -- khóa miễn phí + vĩnh viễn
('DK136', 'HV040', 'KH003', 650000, '2026-03-01', NULL, 'da_xac_nhan'),  -- đã mua, chưa học gì, 90 ngày đã trôi qua → hết hạn
('DK137', 'HV039', 'KH001', 499000, '2026-08-18', NULL, 'hoan_thanh');   -- hoàn thành, còn hạn

-- 3) DK134 (HV040 · KH001): 3 bài, 2 bài kiểm tra điểm 10, thanh toán, chứng chỉ, đánh giá
INSERT INTO LICH_SU_HOC_TAP (MaLSHT, MaDK, MaBH, ThoiDiemHoc, TienDoTangThem, TrangThaiHoanThanh) VALUES
('LS380', 'DK134', 'BH001', '2026-02-02 10:00:00', 33.33, 'hoan_thanh'),
('LS381', 'DK134', 'BH002', '2026-02-05 10:00:00', 33.33, 'hoan_thanh'),
('LS382', 'DK134', 'BH003', '2026-02-08 10:00:00', 33.34, 'hoan_thanh');
INSERT INTO KET_QUA (MaKQ, MaDK, MaBKT, LanLam, DiemSo, ThoiGianLam) VALUES
('KQ184', 'DK134', 'BKT001', 1, 10.00, '2026-02-02 10:20:00'),
('KQ185', 'DK134', 'BKT002', 1, 10.00, '2026-02-05 10:20:00');
INSERT INTO THANH_TOAN (MaTT, MaDK, SoTien, PhuongThucTT, LoaiGiaoDich, ThoiGian, TrangThaiTT) VALUES
('TT098', 'DK134', 499000, N'Chuyển khoản', 'thanh_toan', '2026-02-01 09:00:00', 'success');
INSERT INTO CHUNG_CHI (MaCC, MaDK, NgayCap, HieuLuc) VALUES
('CC043', 'DK134', '2026-02-08', 'con_hieu_luc');
INSERT INTO DANH_GIA (MaDG, MaDK, DiemDanhGia, NhanXet, NgayDG) VALUES
('DG050', 'DK134', 9, N'Học xong rồi mới biết là có hạn, giờ phải đăng ký lại mất phí', '2026-02-08');

-- 4) DK135 (HV002 · KH002): 2 bài, 1 bài kiểm tra, chứng chỉ, đánh giá (khóa miễn phí nên không có thanh toán)
INSERT INTO LICH_SU_HOC_TAP (MaLSHT, MaDK, MaBH, ThoiDiemHoc, TienDoTangThem, TrangThaiHoanThanh) VALUES
('LS383', 'DK135', 'BH004', '2026-08-13 10:00:00', 50.00, 'hoan_thanh'),
('LS384', 'DK135', 'BH005', '2026-08-14 10:00:00', 50.00, 'hoan_thanh');
INSERT INTO KET_QUA (MaKQ, MaDK, MaBKT, LanLam, DiemSo, ThoiGianLam) VALUES
('KQ186', 'DK135', 'BKT003', 1, 10.00, '2026-08-13 10:20:00');
INSERT INTO CHUNG_CHI (MaCC, MaDK, NgayCap, HieuLuc) VALUES
('CC044', 'DK135', '2026-08-14', 'con_hieu_luc');
INSERT INTO DANH_GIA (MaDG, MaDK, DiemDanhGia, NhanXet, NgayDG) VALUES
('DG051', 'DK135', 10, N'Khóa SQL miễn phí mà chất lượng, học lại thoải mái vì vĩnh viễn', '2026-08-14');

-- 5) DK136 (HV040 · KH003): đã trả tiền nhưng chưa học bài nào
INSERT INTO THANH_TOAN (MaTT, MaDK, SoTien, PhuongThucTT, LoaiGiaoDich, ThoiGian, TrangThaiTT) VALUES
('TT099', 'DK136', 650000, N'Thẻ tín dụng', 'thanh_toan', '2026-03-01 09:00:00', 'success');

-- 6) DK137 (HV039 · KH001): hoàn thành gần đây
INSERT INTO LICH_SU_HOC_TAP (MaLSHT, MaDK, MaBH, ThoiDiemHoc, TienDoTangThem, TrangThaiHoanThanh) VALUES
('LS385', 'DK137', 'BH001', '2026-08-19 10:00:00', 33.33, 'hoan_thanh'),
('LS386', 'DK137', 'BH002', '2026-08-20 10:00:00', 33.33, 'hoan_thanh'),
('LS387', 'DK137', 'BH003', '2026-08-21 10:00:00', 33.34, 'hoan_thanh');
INSERT INTO KET_QUA (MaKQ, MaDK, MaBKT, LanLam, DiemSo, ThoiGianLam) VALUES
('KQ187', 'DK137', 'BKT001', 1, 10.00, '2026-08-19 10:20:00'),
('KQ188', 'DK137', 'BKT002', 1, 10.00, '2026-08-20 10:20:00');
INSERT INTO THANH_TOAN (MaTT, MaDK, SoTien, PhuongThucTT, LoaiGiaoDich, ThoiGian, TrangThaiTT) VALUES
('TT100', 'DK137', 499000, N'Chuyển khoản', 'thanh_toan', '2026-08-18 09:00:00', 'success');
INSERT INTO CHUNG_CHI (MaCC, MaDK, NgayCap, HieuLuc) VALUES
('CC045', 'DK137', '2026-08-21', 'con_hieu_luc');
INSERT INTO DANH_GIA (MaDG, MaDK, DiemDanhGia, NhanXet, NgayDG) VALUES
('DG052', 'DK137', 10, N'Khóa học rất chất lượng, vẫn còn hạn nên vào ôn tập thoải mái', '2026-08-21');

-- 7) Tính NgayHetHan cho MỌI lượt đăng ký còn hiệu lực (cả của 02, của 05 lẫn vừa thêm)
--    = NgayDangKy + ThoiHanTruyCap của khóa. Khóa vĩnh viễn giữ NULL.
UPDATE DANG_KY dk
JOIN KHOA_HOC kh ON kh.MaKH = dk.MaKH
SET dk.NgayHetHan = DATE_ADD(dk.NgayDangKy, INTERVAL kh.ThoiHanTruyCap DAY)
WHERE kh.ThoiHanTruyCap IS NOT NULL AND dk.NgayHuy IS NULL;

-- Thống kê nhanh: số lượt theo tình trạng hạn
SELECT CASE WHEN dk.NgayHetHan IS NULL THEN 'vĩnh viễn'
            WHEN dk.NgayHetHan < CURRENT_DATE THEN 'ĐÃ HẾT HẠN'
            ELSE 'còn hạn' END AS TinhTrang,
       COUNT(*) AS SoLuot
FROM DANG_KY dk WHERE dk.NgayHuy IS NULL GROUP BY TinhTrang;

SELECT COUNT(*) AS GiangVien FROM GIANG_VIEN;
SELECT COUNT(*) AS HocVien   FROM HOC_VIEN;
SELECT COUNT(*) AS KhoaHoc   FROM KHOA_HOC;
