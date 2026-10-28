-- =====================================================================
-- Dữ liệu mẫu — chạy SAU 01_schema.sql
-- Mật khẩu đăng nhập của MỌI tài khoản demo: 123456
-- Tình huống test:
--  - HV001 đăng ký lại cùng khóa (KH001) 2 lần (DK001, DK005)
--  - BKT001 được DK001 làm 2 lần (điểm cải thiện)
--  - DK004 đăng ký rồi huỷ
--  - DK001 hoàn thành → có chứng chỉ + đánh giá
-- =====================================================================
USE btl_csdl_khoahoc;

-- Mật khẩu demo của mọi tài khoản là 123456 → chuỗi bcrypt dưới đây.
SET @pw = '$2a$10$nEBROmqqq3AkMUFy/OOstOhbO.Sx6JhV5iaP8Dz/s0NUTsHYYAIFe';

-- ───────── ADMIN (tài khoản quản trị — không đăng ký công khai) ─────────
INSERT INTO ADMIN (MaAD, HoTen, Email, MatKhauHash) VALUES
('AD001', N'Quản trị viên N9', 'admin@n9.vn', @pw);

-- ───────── GIẢNG VIÊN (mật khẩu lưu ngay trong bảng — Phương án B) ─────────
INSERT INTO GIANG_VIEN (MaGV, HoTen, Email, MatKhauHash, SDT, NgaySinh, ChuyenMon, TrinhDo) VALUES
('GV001', N'Trần Minh Khoa', 'khoa.tran@email.com', @pw, '0908000001', '1988-04-10', N'Lập trình Python', N'Thạc sĩ'),
('GV002', N'Lê Hoài Thu',   'thu.le@email.com',    @pw, '0908000002', '1990-09-22', N'Thiết kế UI/UX',   N'Cử nhân'),
('GV003', N'Phạm Thế Quế',  'que.pham@email.com',  @pw, '0908000003', '1985-01-15', N'Cơ sở dữ liệu',    N'Tiến sĩ');

-- ───────── HỌC VIÊN ─────────
INSERT INTO HOC_VIEN (MaHV, HoTen, Email, MatKhauHash, SoDienThoai, NgaySinh, NgayDK, TrangThaiTK) VALUES
('HV001', N'Nguyễn Văn An',  'an.nguyen@email.com', @pw, '0901111111', '2000-05-12', '2026-08-01', 'active'),
('HV002', N'Vũ Thị Ngọc',    'ngoc.vu@email.com',   @pw, '0902222222', '1999-11-03', '2026-08-05', 'active'),
('HV003', N'Hoàng Đức Anh',  'anh.hoang@email.com', @pw, '0903333333', '2001-02-20', '2026-08-10', 'active');

-- ───────── KHÓA HỌC ─────────
INSERT INTO KHOA_HOC (MaKH, MaGV, TenKH, MoTa, LinhVuc, TrinhDo, ThoiLuong, HocPhi, NgayTao, TrangThai) VALUES
('KH001', 'GV001', N'Lập trình Python cơ bản', N'Nhập môn Python cho người mới bắt đầu', N'Lập trình', 'co_ban', 180, 499000, '2026-07-01', 'published'),
('KH002', 'GV003', N'SQL cho phân tích dữ liệu', N'Truy vấn, JOIN, GROUP BY và báo cáo bằng SQL', N'Lập trình', 'co_ban', 150, 0, '2026-07-05', 'published'),
('KH003', 'GV002', N'Thiết kế UI/UX với Figma', N'Quy trình thiết kế giao diện thực chiến', N'Thiết kế', 'trung_cap', 200, 650000, '2026-07-10', 'published');

-- ───────── BÀI HỌC ─────────
INSERT INTO BAI_HOC (MaBH, MaKH, TenBH, ThuTu, ThoiLuong, GiaoTrinh, ThucHanh, VideoBaiGiang) VALUES
('BH001', 'KH001', N'Cài đặt môi trường & Hello World', 1, 20, N'Giáo trình bài 1...', N'Cài Python, chạy chương trình đầu tiên', 'https://youtu.be/_uQrJ0TkZlc'),
('BH002', 'KH001', N'Biến, kiểu dữ liệu và toán tử', 2, 35, N'Giáo trình bài 2...', N'Viết chương trình tính toán', 'https://youtu.be/rfscVS0vtbw'),
('BH003', 'KH001', N'Cấu trúc điều khiển: if / for / while', 3, 40, N'Giáo trình bài 3...', N'Bài tập vòng lặp', NULL),
('BH004', 'KH002', N'SELECT, WHERE và các toán tử', 1, 30, N'Giáo trình SQL bài 1...', N'Viết truy vấn SELECT', 'https://youtu.be/HXV3zeQKqGY'),
('BH005', 'KH002', N'JOIN nhiều bảng', 2, 35, N'Giáo trình SQL bài 2...', N'Bài tập JOIN', NULL);

-- ───────── BÀI KIỂM TRA (câu hỏi lưu JSON trong NoiDungBKT) ─────────
INSERT INTO BAI_KIEM_TRA (MaBKT, MaBH, TenBKT, NoiDungBKT, ThoiGian, TrangThai, SoLanLamToiDa) VALUES
('BKT001', 'BH001', N'Kiểm tra bài 1: Môi trường & cú pháp', N'[
  {"q":"Lệnh nào in ra màn hình trong Python?","opt":["echo()","print()","console.log()","write()"],"dap":1},
  {"q":"Phần mở rộng của file Python là gì?","opt":[".py",".pt",".pyt",".python"],"dap":0},
  {"q":"Ký hiệu nào bắt đầu một dòng chú thích?","opt":["//","/*","#","--"],"dap":2}
]', 15, 'active', 2),
('BKT002', 'BH002', N'Kiểm tra bài 2: Biến & kiểu dữ liệu', N'[
  {"q":"Kiểu dữ liệu của số 3.14 là gì?","opt":["int","float","str","bool"],"dap":1},
  {"q":"Kết quả của 7 // 2 là bao nhiêu?","opt":["3.5","3","4","2"],"dap":1},
  {"q":"Hàm nào chuyển chuỗi thành số nguyên?","opt":["str()","int()","float()","bool()"],"dap":1}
]', 15, 'active', NULL),
('BKT003', 'BH004', N'Kiểm tra SQL: SELECT cơ bản', N'[
  {"q":"Lệnh nào lấy dữ liệu từ bảng?","opt":["GET","SELECT","FETCH","PULL"],"dap":1},
  {"q":"Mệnh đề nào dùng để lọc dòng?","opt":["FILTER","HAVING","WHERE","LIMIT"],"dap":2},
  {"q":"Ký tự đại diện cho tất cả các cột?","opt":["%","*","#","@"],"dap":1}
]', 12, 'active', 1);

-- ───────── ĐĂNG KÝ ─────────
INSERT INTO DANG_KY (MaDK, MaHV, MaKH, HocPhi, NgayDangKy, NgayHuy, TTDangKy) VALUES
('DK001', 'HV001', 'KH001', 499000, '2026-08-02', NULL, 'hoan_thanh'),
('DK002', 'HV002', 'KH001', 499000, '2026-08-06', NULL, 'dang_hoc'),
('DK003', 'HV001', 'KH002', 0,      '2026-08-15', NULL, 'dang_hoc'),
('DK004', 'HV003', 'KH003', 650000, '2026-08-11', '2026-08-12', 'da_huy'),
('DK005', 'HV001', 'KH001', 499000, '2026-09-01', NULL, 'dang_hoc');

-- ───────── LỊCH SỬ HỌC TẬP (thay TIEN_DO_BAI_HOC) ─────────
INSERT INTO LICH_SU_HOC_TAP (MaLSHT, MaDK, MaBH, ThoiDiemHoc, TienDoTangThem, TrangThaiHoanThanh) VALUES
('LS001', 'DK001', 'BH001', '2026-08-03 10:00:00', 33.33, 'hoan_thanh'),
('LS002', 'DK001', 'BH002', '2026-08-04 11:00:00', 33.33, 'hoan_thanh'),
('LS003', 'DK001', 'BH003', '2026-08-05 09:30:00', 33.34, 'hoan_thanh'),
('LS004', 'DK002', 'BH001', '2026-08-07 14:00:00', 33.33, 'hoan_thanh'),
('LS005', 'DK002', 'BH002', '2026-08-08 15:00:00', 0.00,  'dang_hoc'),
('LS006', 'DK003', 'BH004', '2026-08-16 08:00:00', 50.00, 'hoan_thanh'),
('LS007', 'DK003', 'BH005', '2026-08-17 09:00:00', 0.00,  'dang_hoc'),
('LS008', 'DK005', 'BH001', '2026-09-02 10:00:00', 0.00,  'dang_hoc');

-- ───────── KẾT QUẢ ─────────
INSERT INTO KET_QUA (MaKQ, MaDK, MaBKT, LanLam, DiemSo, ThoiGianLam) VALUES
('KQ001', 'DK001', 'BKT001', 1, 6.67, '2026-08-03 10:20:00'),
('KQ002', 'DK001', 'BKT001', 2, 10.00, '2026-08-03 10:40:00'),
('KQ003', 'DK001', 'BKT002', 1, 6.67, '2026-08-04 11:20:00'),
('KQ004', 'DK002', 'BKT001', 1, 6.67, '2026-08-07 14:20:00'),
('KQ005', 'DK003', 'BKT003', 1, 10.00, '2026-08-16 08:20:00');

-- ───────── THANH TOÁN (SoTien = HocPhi tại thời điểm trả; với 'hoan_tien' là số tiền hoàn) ─────────
INSERT INTO THANH_TOAN (MaTT, MaDK, SoTien, PhuongThucTT, LoaiGiaoDich, ThoiGian, TrangThaiTT) VALUES
('TT001', 'DK001', 499000, N'Chuyển khoản',  'thanh_toan', '2026-08-02 09:00:00', 'success'),
('TT002', 'DK002', 499000, N'Thẻ tín dụng',  'thanh_toan', '2026-08-06 09:00:00', 'failed'),
('TT003', 'DK002', 499000, N'Thẻ tín dụng',  'thanh_toan', '2026-08-06 09:15:00', 'success'),
('TT004', 'DK005', 499000, N'Ví điện tử',    'thanh_toan', '2026-09-01 10:00:00', 'success');
-- DK003 học khóa miễn phí (HocPhi = 0) nên không có giao dịch

-- ───────── CHỨNG CHỈ (DK001 hoàn thành) ─────────
INSERT INTO CHUNG_CHI (MaCC, MaDK, NgayCap, HieuLuc) VALUES
('CC001', 'DK001', '2026-08-06', 'con_hieu_luc');

-- ───────── ĐÁNH GIÁ (mỗi đăng ký tối đa 1 đánh giá) ─────────
INSERT INTO DANH_GIA (MaDG, MaDK, DiemDanhGia, NhanXet, NgayDG) VALUES
('DG001', 'DK001', 5, N'Khóa học dễ hiểu, giảng viên nhiệt tình', '2026-08-06'),
('DG002', 'DK002', 4, N'Nội dung ổn nhưng hơi nhanh', '2026-08-08');
