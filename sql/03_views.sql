-- =====================================================================
-- VIEW hỗ trợ — các trường suy diễn KHÔNG lưu cứng trong bảng,
-- tính runtime để luôn nhất quán với dữ liệu gốc. Chạy sau 02_seed_data.sql.
-- =====================================================================
USE btl_csdl_khoahoc;

-- % tiến độ của từng lượt đăng ký = số bài ĐÃ hoàn thành / tổng số bài của khóa.
-- LICH_SU_HOC_TAP có thể có nhiều dòng cho 1 bài → đếm DISTINCT bài hoàn thành.
CREATE OR REPLACE VIEW V_TIEN_DO AS
SELECT dk.MaDK,
       (SELECT COUNT(*) FROM BAI_HOC bh WHERE bh.MaKH = dk.MaKH) AS TongSoBai,
       COUNT(DISTINCT CASE WHEN ls.TrangThaiHoanThanh = 'hoan_thanh' THEN ls.MaBH END) AS SoBaiHoanThanh,
       ROUND(100.0 * COUNT(DISTINCT CASE WHEN ls.TrangThaiHoanThanh = 'hoan_thanh' THEN ls.MaBH END)
             / NULLIF((SELECT COUNT(*) FROM BAI_HOC bh WHERE bh.MaKH = dk.MaKH), 0), 1) AS TienDoPhanTram
FROM   DANG_KY dk
LEFT JOIN LICH_SU_HOC_TAP ls ON ls.MaDK = dk.MaDK
GROUP BY dk.MaDK, dk.MaKH;

-- Điểm trung bình mỗi lượt đăng ký, lấy điểm CAO NHẤT của mỗi bài kiểm tra
-- nếu bài đó được làm nhiều lần. Thang điểm 10.
CREATE OR REPLACE VIEW V_DIEM_TB AS
SELECT MaDK, AVG(DiemCaoNhat) AS DiemTrungBinh
FROM (
  SELECT MaDK, MaBKT, MAX(DiemSo) AS DiemCaoNhat
  FROM   KET_QUA
  GROUP BY MaDK, MaBKT
) AS BestPerTest
GROUP BY MaDK;

-- Trạng thái hoàn thành: tiến độ 100% VÀ điểm trung bình >= 7 (thang 10).
CREATE OR REPLACE VIEW V_HOAN_THANH AS
SELECT td.MaDK,
       td.TienDoPhanTram,
       d.DiemTrungBinh,
       CASE WHEN td.TienDoPhanTram = 100 AND d.DiemTrungBinh >= 7
            THEN 'hoan_thanh' ELSE 'chua_hoan_thanh' END AS TrangThaiHoanThanh
FROM   V_TIEN_DO td
JOIN   V_DIEM_TB d ON d.MaDK = td.MaDK;

-- Lần đăng ký thứ mấy của mỗi (học viên, khóa học) theo thời gian.
CREATE OR REPLACE VIEW V_LAN_DANG_KY AS
SELECT MaDK, MaHV, MaKH, NgayDangKy,
       ROW_NUMBER() OVER (PARTITION BY MaHV, MaKH ORDER BY NgayDangKy) AS LanDangKy
FROM DANG_KY;
