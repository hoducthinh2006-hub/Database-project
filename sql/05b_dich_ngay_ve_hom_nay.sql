-- =====================================================================
-- (TUỲ CHỌN) Dời toàn bộ mốc ngày/giờ về "hôm nay" — chạy SAU 05_seed_demo.sql khi muốn làm mới dữ liệu demo.
-- Các số liệu "7/30 ngày gần đây" chỉ có dữ liệu khi hoạt động demo chưa quá cũ; file này cộng thêm cùng
-- 1 số ngày vào mọi mốc thời gian để hoạt động mới nhất rơi vào hôm nay, giữ nguyên thứ tự trước/sau.
-- =====================================================================
USE btl_csdl_khoahoc;

SET @n = DATEDIFF(CURDATE(), (SELECT MAX(DATE(ThoiDiemHoc)) FROM LICH_SU_HOC_TAP));
SELECT @n AS SoNgayDoi, IF(@n > 0, 'sẽ dời', 'không cần dời') AS TrangThai;

START TRANSACTION;
UPDATE HOC_VIEN        SET NgayDK       = DATE_ADD(NgayDK, INTERVAL @n DAY)       WHERE @n > 0;
UPDATE KHOA_HOC        SET NgayTao      = DATE_ADD(NgayTao, INTERVAL @n DAY)      WHERE @n > 0;
UPDATE DANG_KY         SET NgayDangKy   = DATE_ADD(NgayDangKy, INTERVAL @n DAY),
                           NgayHuy      = DATE_ADD(NgayHuy, INTERVAL @n DAY),
                           NgayHetHan   = DATE_ADD(NgayHetHan, INTERVAL @n DAY)    WHERE @n > 0;
UPDATE LICH_SU_HOC_TAP SET ThoiDiemHoc  = DATE_ADD(ThoiDiemHoc, INTERVAL @n DAY)  WHERE @n > 0;
UPDATE KET_QUA         SET ThoiGianLam  = DATE_ADD(ThoiGianLam, INTERVAL @n DAY)  WHERE @n > 0;
UPDATE THANH_TOAN      SET ThoiGian     = DATE_ADD(ThoiGian, INTERVAL @n DAY)     WHERE @n > 0;
UPDATE CHUNG_CHI       SET NgayCap      = DATE_ADD(NgayCap, INTERVAL @n DAY)      WHERE @n > 0;
UPDATE DANH_GIA        SET NgayDG       = DATE_ADD(NgayDG, INTERVAL @n DAY)       WHERE @n > 0;
COMMIT;

SELECT MAX(ThoiDiemHoc) AS HoatDongMoiNhat FROM LICH_SU_HOC_TAP;
