-- =====================================================================
-- BTL_CSDL — Hệ thống quản lý khóa học trực tuyến
-- Schema v2 — cập nhật theo Lược đồ ER bản sửa 5/10 + Sơ đồ quan hệ 4/10
-- =====================================================================

CREATE DATABASE IF NOT EXISTS btl_csdl_khoahoc
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE btl_csdl_khoahoc;

-- ─────────────────────────────────────────────
-- 1. GIANG_VIEN
-- ─────────────────────────────────────────────
CREATE TABLE GIANG_VIEN (
  MaGV        VARCHAR(20)  PRIMARY KEY,
  HoTen       VARCHAR(100) NOT NULL,
  Email       VARCHAR(100) NOT NULL UNIQUE,
  MatKhauHash VARCHAR(255) NOT NULL,   -- bcrypt, không lưu mật khẩu thô
  SDT         VARCHAR(15),
  NgaySinh    DATE,
  ChuyenMon   VARCHAR(100),
  TrinhDo     VARCHAR(50),
  TrangThaiTK VARCHAR(30)  NOT NULL DEFAULT 'active',  -- admin khóa GV vi phạm
  CHECK (TrangThaiTK IN ('active','suspended'))
);

-- ─────────────────────────────────────────────
-- 2. HOC_VIEN
-- ─────────────────────────────────────────────
CREATE TABLE HOC_VIEN (
  MaHV         VARCHAR(20)  PRIMARY KEY,
  HoTen        VARCHAR(100) NOT NULL,
  Email        VARCHAR(100) NOT NULL UNIQUE,
  MatKhauHash  VARCHAR(255) NOT NULL,   -- bcrypt, không lưu mật khẩu thô
  SoDienThoai  VARCHAR(15),
  NgaySinh     DATE,
  NgayDK       DATE         NOT NULL DEFAULT (CURRENT_DATE),
  TrangThaiTK  VARCHAR(30)  NOT NULL DEFAULT 'active',
  CHECK (TrangThaiTK IN ('active','suspended','deleted'))
);

-- ─────────────────────────────────────────────
-- 3. KHOA_HOC
-- ─────────────────────────────────────────────
CREATE TABLE KHOA_HOC (
  MaKH       VARCHAR(20)    PRIMARY KEY,
  MaGV       VARCHAR(20)    NOT NULL,
  TenKH      VARCHAR(150)   NOT NULL,
  MoTa       TEXT,
  LinhVuc    VARCHAR(100),
  TrinhDo    VARCHAR(50),
  ThoiLuong  INT,
  HocPhi     DECIMAL(12,2)  NOT NULL DEFAULT 0 CHECK (HocPhi >= 0),
  NgayTao    DATE           NOT NULL DEFAULT (CURRENT_DATE),
  TrangThai  VARCHAR(30)    NOT NULL DEFAULT 'draft',
  FOREIGN KEY (MaGV) REFERENCES GIANG_VIEN(MaGV),
  CHECK (TrangThai IN ('draft','published','archived'))
);

-- ─────────────────────────────────────────────
-- 4. BAI_HOC
-- ─────────────────────────────────────────────
CREATE TABLE BAI_HOC (
  MaBH           VARCHAR(20)  PRIMARY KEY,
  MaKH           VARCHAR(20)  NOT NULL,
  TenBH          VARCHAR(150) NOT NULL,
  ThuTu          INT          NOT NULL CHECK (ThuTu > 0),
  ThoiLuong      INT,
  VideoBaiGiang  VARCHAR(255),
  GiaoTrinh      TEXT,
  ThucHanh       TEXT,
  FOREIGN KEY (MaKH) REFERENCES KHOA_HOC(MaKH) ON DELETE CASCADE,
  CONSTRAINT UQ_BaiHoc_ThuTu UNIQUE (MaKH, ThuTu)
);

-- ─────────────────────────────────────────────
-- 5. DANG_KY  (thêm HocPhi + TTDangKy)
-- ─────────────────────────────────────────────
CREATE TABLE DANG_KY (
  MaDK        VARCHAR(20)    PRIMARY KEY,
  MaHV        VARCHAR(20)    NOT NULL,
  MaKH        VARCHAR(20)    NOT NULL,
  HocPhi      DECIMAL(12,2)  NOT NULL DEFAULT 0 CHECK (HocPhi >= 0),
  NgayDangKy  DATE           NOT NULL DEFAULT (CURRENT_DATE),
  NgayHuy     DATE,
  TTDangKy    VARCHAR(50)    NOT NULL DEFAULT 'cho_xac_nhan',
  FOREIGN KEY (MaHV) REFERENCES HOC_VIEN(MaHV),
  FOREIGN KEY (MaKH) REFERENCES KHOA_HOC(MaKH),
  CHECK (NgayHuy IS NULL OR NgayHuy >= NgayDangKy),
  CHECK (TTDangKy IN ('cho_xac_nhan','da_xac_nhan','dang_hoc','hoan_thanh','da_huy'))
);

-- ─────────────────────────────────────────────
-- 6. LICH_SU_HOC_TAP  (thay thế TIEN_DO_BAI_HOC)
--    Mỗi cặp (đăng ký, bài học) chỉ có 1 bản ghi tiến độ HIỆN HÀNH (UNIQUE) —
--    app tự tìm-thì-sửa/không-có-thì-tạo (xem student.routes.js open/complete), ràng buộc UNIQUE ở đây chỉ để CSDL tự ép cứng.
--    Tiến độ 1 lượt đăng ký = tổng TienDoTangThem của các bài đã hoàn thành (≤ 100%).
-- ─────────────────────────────────────────────
CREATE TABLE LICH_SU_HOC_TAP (
  MaLSHT             VARCHAR(20)   PRIMARY KEY,
  MaDK               VARCHAR(20)   NOT NULL,
  MaBH               VARCHAR(20)   NOT NULL,
  ThoiDiemHoc        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  TienDoTangThem     DECIMAL(5,2)  NOT NULL DEFAULT 0 CHECK (TienDoTangThem >= 0),
  TrangThaiHoanThanh VARCHAR(30)   NOT NULL DEFAULT 'chua_hoan_thanh',
  FOREIGN KEY (MaDK) REFERENCES DANG_KY(MaDK) ON DELETE CASCADE,
  FOREIGN KEY (MaBH) REFERENCES BAI_HOC(MaBH),
  CHECK (TrangThaiHoanThanh IN ('chua_hoan_thanh','dang_hoc','hoan_thanh')),
  CONSTRAINT UQ_LichSuHocTap_Cap UNIQUE (MaDK, MaBH)
);

-- ─────────────────────────────────────────────
-- 7. THANH_TOAN  (có SoTien riêng: với 'thanh_toan' = học phí tại thời điểm trả;
--    với 'hoan_tien' = số tiền hoàn — có thể khác HocPhi gốc nên không suy ra được từ DANG_KY)
-- ─────────────────────────────────────────────
CREATE TABLE THANH_TOAN (
  MaTT          VARCHAR(20)    PRIMARY KEY,
  MaDK          VARCHAR(20)    NOT NULL,
  SoTien        DECIMAL(12,2)  NOT NULL DEFAULT 0 CHECK (SoTien >= 0),
  PhuongThucTT  VARCHAR(50),
  LoaiGiaoDich  VARCHAR(50)    NOT NULL DEFAULT 'thanh_toan',
  ThoiGian      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  TrangThaiTT   VARCHAR(50)    NOT NULL DEFAULT 'pending',
  FOREIGN KEY (MaDK) REFERENCES DANG_KY(MaDK) ON DELETE CASCADE,
  CHECK (TrangThaiTT IN ('pending','success','failed','cancelled')),
  CHECK (LoaiGiaoDich IN ('thanh_toan','hoan_tien'))
);

-- ─────────────────────────────────────────────
-- 8. CHUNG_CHI  (1 DANG_KY có thể cấp N chứng chỉ → bỏ UNIQUE MaDK)
-- ─────────────────────────────────────────────
CREATE TABLE CHUNG_CHI (
  MaCC     VARCHAR(20)  PRIMARY KEY,
  MaDK     VARCHAR(20)  NOT NULL UNIQUE,   -- 1 đăng ký ↔ 1 chứng chỉ (1:1)
  NgayCap  DATE         NOT NULL DEFAULT (CURRENT_DATE),
  HieuLuc  VARCHAR(50)  NOT NULL DEFAULT 'con_hieu_luc',
  FOREIGN KEY (MaDK) REFERENCES DANG_KY(MaDK) ON DELETE CASCADE,
  CHECK (HieuLuc IN ('con_hieu_luc','het_hieu_luc'))
);

-- ─────────────────────────────────────────────
-- 9. BAI_KIEM_TRA  (bỏ DiemToiDa + BatBuoc, thêm TrangThai; FK → BAI_HOC)
-- ─────────────────────────────────────────────
CREATE TABLE BAI_KIEM_TRA (
  MaBKT          VARCHAR(20)   PRIMARY KEY,
  MaBH           VARCHAR(20)   NOT NULL,
  TenBKT         VARCHAR(150)  NOT NULL,
  NoiDungBKT     TEXT,
  ThoiGian       INT           NOT NULL CHECK (ThoiGian > 0),
  TrangThai      VARCHAR(30)   NOT NULL DEFAULT 'active',
  SoLanLamToiDa  INT           DEFAULT NULL,
  DiemToiDa      DECIMAL(5,2)  NOT NULL DEFAULT 10 CHECK (DiemToiDa > 0),
  FOREIGN KEY (MaBH) REFERENCES BAI_HOC(MaBH) ON DELETE CASCADE,
  CHECK (TrangThai IN ('active','inactive'))
);

-- ─────────────────────────────────────────────
-- 10. KET_QUA  (unique index tránh trùng lần làm)
-- ─────────────────────────────────────────────
CREATE TABLE KET_QUA (
  MaKQ         VARCHAR(20)   PRIMARY KEY,
  MaDK         VARCHAR(20)   NOT NULL,
  MaBKT        VARCHAR(20)   NOT NULL,
  LanLam       INT           NOT NULL CHECK (LanLam >= 1),
  DiemSo       DECIMAL(5,2)  NOT NULL CHECK (DiemSo >= 0),
  ThoiGianLam  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (MaDK) REFERENCES DANG_KY(MaDK) ON DELETE CASCADE,
  FOREIGN KEY (MaBKT) REFERENCES BAI_KIEM_TRA(MaBKT),
  CONSTRAINT UQ_KetQua_Lan UNIQUE (MaDK, MaBKT, LanLam)
);

-- ─────────────────────────────────────────────
-- 11. DANH_GIA  (gắn qua DANG_KY: mỗi lượt đăng ký đánh giá tối đa 1 lần)
--     MaDK UNIQUE → quan hệ 1:1 với DANG_KY; thêm DiemDanhGia (1-5 sao)
-- ─────────────────────────────────────────────
CREATE TABLE DANH_GIA (
  MaDG         VARCHAR(20) PRIMARY KEY,
  MaDK         VARCHAR(20) NOT NULL UNIQUE,
  DiemDanhGia  INT         NOT NULL CHECK (DiemDanhGia BETWEEN 0 AND 10),
  NhanXet      TEXT,
  NgayDG       DATE        NOT NULL DEFAULT (CURRENT_DATE),
  FOREIGN KEY (MaDK) REFERENCES DANG_KY(MaDK) ON DELETE CASCADE
);

-- ─────────────────────────────────────────────
-- 12. ADMIN (bảng hệ thống — KHÔNG thuộc 11 bảng nghiệp vụ trong sơ đồ ER
--     của nhóm, chỉ phục vụ vai trò quản trị trang web: cấp tài khoản
--     giảng viên, duyệt khóa học, xem báo cáo tổng quan).
--     Không có đăng ký công khai — chỉ tạo bằng cách insert trực tiếp
--     hoặc do admin khác tạo, đúng mô hình "admin vận hành hệ thống".
-- ─────────────────────────────────────────────
CREATE TABLE ADMIN (
  MaAD        VARCHAR(20)  PRIMARY KEY,
  HoTen       VARCHAR(100) NOT NULL,
  Email       VARCHAR(100) NOT NULL UNIQUE,
  MatKhauHash VARCHAR(255) NOT NULL   -- bcrypt, giống Phương án B của GIANG_VIEN/HOC_VIEN
);

-- ─────────────────────────────────────────────
-- TRIGGER: mỗi đăng ký chỉ 1 giao dịch 'thanh_toan' (loại mua) 'success'
-- (lưới an toàn ở tầng CSDL — không phụ thuộc UI). CHỈ xét loại 'thanh_toan':
-- giao dịch 'hoan_tien' thành công (khi hủy đăng ký) vẫn phải chèn được bình
-- thường dù đã có 1 dòng 'thanh_toan' success trước đó cho cùng MaDK.
-- ─────────────────────────────────────────────
DELIMITER $$
CREATE TRIGGER trg_mot_lan_thanh_toan
BEFORE INSERT ON THANH_TOAN
FOR EACH ROW
BEGIN
  IF NEW.TrangThaiTT = 'success' AND NEW.LoaiGiaoDich = 'thanh_toan' AND EXISTS (
    SELECT 1 FROM THANH_TOAN WHERE MaDK = NEW.MaDK AND TrangThaiTT = 'success' AND LoaiGiaoDich = 'thanh_toan'
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Dang ky nay da thanh toan thanh cong, khong the thanh toan lai';
  END IF;
END$$
DELIMITER ;
