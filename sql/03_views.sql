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

-- Điểm trung bình mỗi lượt đăng ký = TB điểm CAO NHẤT mỗi bài kiểm tra, quy đổi về thang 10 trước khi gộp
-- (các bài có thể có DiemToiDa khác nhau).
CREATE OR REPLACE VIEW V_DIEM_TB AS
SELECT MaDK, AVG(DiemCaoNhat / DiemToiDa * 10) AS DiemTrungBinh
FROM (
  SELECT kq.MaDK, kq.MaBKT, MAX(kq.DiemSo) AS DiemCaoNhat, bkt.DiemToiDa
  FROM   KET_QUA kq JOIN BAI_KIEM_TRA bkt ON bkt.MaBKT = kq.MaBKT
  GROUP BY kq.MaDK, kq.MaBKT, bkt.DiemToiDa
) AS BestPerTest
GROUP BY MaDK;

-- Trạng thái hoàn thành: tiến độ 100% VÀ điểm trung bình >= 7 (thang 10)
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
