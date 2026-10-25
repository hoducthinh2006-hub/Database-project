-- =====================================================================
-- (TUỲ CHỌN) Dời toàn bộ mốc ngày/giờ về "hôm nay" — chạy SAU 05_seed_demo.sql, khi muốn làm mới dữ liệu demo.
--
-- Vì sao cần: bảng xếp hạng 7/30 ngày, "Chuỗi ngày học liên tục", "Chăm chỉ nhất tháng", biểu đồ hoạt động 7 ngày…
-- chỉ có số liệu khi có hoạt động GẦN ĐÂY. Dữ liệu demo kết thúc ở ngày nạp (20/10/2026); vài ngày sau các mục đó sẽ trống.
-- File này kéo MỌI mốc thời gian lên cùng một số ngày sao cho hoạt động mới nhất rơi vào hôm nay; thứ tự trước/sau
-- giữa các mốc (đăng ký → học → làm bài → chứng chỉ…) được giữ nguyên. Không sửa dòng nào ngoài các cột ngày/giờ.
-- Chạy lại nhiều lần cũng an toàn (nếu đã là hôm nay thì không đổi gì).
-- =====================================================================
USE btl_csdl_khoahoc;

SET @n = DATEDIFF(CURDATE(), (SELECT MAX(DATE(ThoiDiemHoc)) FROM LICH_SU_HOC_TAP));
SELECT @n AS SoNgayDoi, IF(@n > 0, 'sẽ dời', 'không cần dời') AS TrangThai;

START TRANSACTION;
UPDATE HOC_VIEN        SET NgayDK       = DATE_ADD(NgayDK, INTERVAL @n DAY)       WHERE @n > 0;
UPDATE KHOA_HOC        SET NgayTao      = DATE_ADD(NgayTao, INTERVAL @n DAY)      WHERE @n > 0;
UPDATE DANG_KY         SET NgayDangKy   = DATE_ADD(NgayDangKy, INTERVAL @n DAY),
                           NgayHuy      = DATE_ADD(NgayHuy, INTERVAL @n DAY)       WHERE @n > 0;
UPDATE LICH_SU_HOC_TAP SET ThoiDiemHoc  = DATE_ADD(ThoiDiemHoc, INTERVAL @n DAY)  WHERE @n > 0;
UPDATE KET_QUA         SET ThoiGianLam  = DATE_ADD(ThoiGianLam, INTERVAL @n DAY)  WHERE @n > 0;
UPDATE THANH_TOAN      SET ThoiGian     = DATE_ADD(ThoiGian, INTERVAL @n DAY)     WHERE @n > 0;
UPDATE CHUNG_CHI       SET NgayCap      = DATE_ADD(NgayCap, INTERVAL @n DAY)      WHERE @n > 0;
UPDATE DANH_GIA        SET NgayDG       = DATE_ADD(NgayDG, INTERVAL @n DAY)       WHERE @n > 0;
COMMIT;

SELECT MAX(ThoiDiemHoc) AS HoatDongMoiNhat FROM LICH_SU_HOC_TAP;
