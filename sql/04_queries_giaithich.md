# Giải thích 15 câu truy vấn báo cáo

Đi kèm `04_queries.sql`. Mỗi câu: **câu hỏi gốc → vì sao cần → kỹ thuật dùng → vì sao viết như vậy** (để trả lời được khi bị hỏi vặn lúc bảo vệ).

> Quy ước chung xuyên suốt cả 15 câu — nhớ trả lời được nếu bị hỏi:
> - **"Hoàn thành"** của 1 lượt đăng ký luôn lấy từ `DANG_KY.TTDangKy = 'hoan_thanh'` — KHÔNG trộn với view `V_HOAN_THANH` (tiêu chí tiến độ + điểm) để tránh 2 cách định nghĩa "hoàn thành" ra 2 kết quả khác nhau trong cùng 1 báo cáo.
> - **"Doanh thu"** chỉ tính khi có 1 dòng `THANH_TOAN` với `TrangThaiTT='success'` — không suy trực tiếp từ `DANG_KY.HocPhi`, vì có đăng ký chưa trả tiền hoặc khóa miễn phí.
> - **Không đếm trùng doanh thu**: trigger `trg_mot_lan_thanh_toan` đã chặn 1 `MaDK` có 2 lần thanh toán `success` → mọi `SUM` qua JOIN với `THANH_TOAN` là an toàn, không cần tự khử trùng thêm.

---

## 🟦 TRÀ

### 1 ⭐ — Khóa học đăng ký trong 1 tháng, sắp theo lượt giảm dần
**Vì sao cần:** admin cần biết khóa nào "hot" trong tháng để ưu tiên quảng bá hoặc đánh giá hiệu quả marketing.
**Kỹ thuật:** `JOIN KHOA_HOC + DANG_KY`, lọc `YEAR()/MONTH()`, `GROUP BY` khóa, `COUNT`, `ORDER BY DESC`.
**Vì sao viết vậy:** đếm theo **lượt** (`COUNT(dk.MaDK)`) chứ không phải đầu người — vì 1 học viên có thể đăng ký lại cùng khóa (HV001 đăng ký KH001 hai lần trong seed data). Nếu đếm theo `DISTINCT MaHV` sẽ làm giảm ảo con số thực tế nhóm đã bán.

### 2 ⭐ — Tỷ lệ hoàn thành khóa học trong 1 khoảng thời gian
**Vì sao cần:** đo "chất lượng" khóa học — khóa có tỷ lệ hoàn thành thấp có thể do nội dung khó hiểu hoặc quá dài, cần admin xem lại.
**Kỹ thuật:** `GROUP BY` khóa, `CASE WHEN` đếm điều kiện, tính % bằng `SUM(CASE...)/COUNT(*)`.
**Vì sao viết vậy:** dùng trực tiếp `dk.TTDangKy='hoan_thanh'` (1 nguồn sự thật) thay vì view `V_HOAN_THANH` — để tỷ lệ này khớp với trạng thái hiển thị trên giao diện học viên, tránh 2 số liệu lệch nhau.

### 3 — Khóa học có học phí cao hơn trung bình
**Vì sao cần:** phát hiện khóa đang định giá cao bất thường — cần xem lại có xứng đáng hay đang "hớt váng" quá đà.
**Kỹ thuật:** subquery độc lập `WHERE HocPhi > (SELECT AVG(HocPhi) FROM KHOA_HOC)`.
**Vì sao viết vậy:** đây là ví dụ chuẩn của **subquery vô hướng (scalar subquery)** — so sánh 1 giá trị với kết quả 1 câu `SELECT` khác, không cần `JOIN`.

### 4 — Giảng viên dạy ≥ 2 khóa học
**Vì sao cần:** biết giảng viên nào đang "gánh" nhiều khóa — phục vụ phân bổ công việc, hoặc để admin đàm phán ưu đãi khi họ dạy nhiều.
**Kỹ thuật:** `GROUP BY MaGV`, lọc bằng `HAVING COUNT(MaKH) >= 2`.
**Vì sao viết vậy:** `HAVING` bắt buộc ở đây vì điều kiện lọc dựa trên **kết quả đã nhóm** (`COUNT`) — `WHERE` không làm được việc này vì `WHERE` lọc trước khi nhóm, lúc đó `COUNT` chưa tồn tại.

### 5 🔴 — Điểm trung bình học viên từng khóa (dựa trên điểm cao nhất mỗi bài KT)
**Vì sao cần:** nếu học viên làm lại bài kiểm tra để cải thiện điểm, công bằng nhất là tính theo điểm **cao nhất đạt được**, không phải điểm lần đầu hay điểm trung bình các lần làm.
**Kỹ thuật:** subquery `GROUP BY (MaDK, MaBKT)` lấy `MAX(DiemSo)` → gói sẵn trong view `V_DIEM_TB` → `JOIN` rồi `ORDER BY DESC`.
**Vì sao viết vậy:** tái dùng view thay vì viết lại subquery — đảm bảo mọi nơi cần "điểm trung bình" đều ra cùng 1 số, không có 2 công thức tính khác nhau nằm rải rác trong code. Từ khi `BAI_KIEM_TRA` có cột `DiemToiDa` (mỗi bài có thể thang điểm khác nhau), `V_DIEM_TB` tự quy đổi `DiemCaoNhat/DiemToiDa*10` trước khi lấy trung bình — câu truy vấn này không đổi gì cả vì chỉ `JOIN` vào view, mọi logic quy đổi nằm gọn trong 1 chỗ.

---

## 🟩 LỘC

### 6 ⭐ — Thống kê hoàn thành / đang học / chưa hoàn thành theo khóa
**Vì sao cần:** cho admin "sức khỏe" tổng thể của từng khóa theo thời gian — bao nhiêu % học viên đang bỏ dở.
**Kỹ thuật:** `CASE WHEN` 4 nhánh loại trừ nhau, `SUM` từng nhánh trong cùng 1 `GROUP BY`.
**Vì sao viết vậy (đã cập nhật theo đề bài bản sửa):** 3 nhóm "đã hoàn thành / đang học / chưa hoàn thành" phải loại trừ lẫn nhau VÀ loại trừ cả lượt đã hủy — nên nhánh "chưa hoàn thành" dùng `NOT IN ('hoan_thanh','dang_hoc','da_huy')` (trước đây gộp `da_huy` vào chung nhóm này, nay tách thành cột `DaHuy` riêng theo đúng yêu cầu "lượt đã hủy được thống kê riêng hoặc loại khỏi 3 nhóm"). 4 nhánh luôn cộng đúng = tổng số đăng ký, không rơi mất dòng nào.

### 7 — Bài học kèm tên khóa + tên giảng viên
**Vì sao cần:** phục vụ trang quản lý nội dung — giảng viên/admin xem nhanh bài học thuộc khóa nào, ai dạy, không cần tra 2 lần.
**Kỹ thuật:** `JOIN` bắc cầu 3 bảng `BAI_HOC → KHOA_HOC → GIANG_VIEN`.
**Vì sao viết vậy:** ví dụ chuẩn của JOIN nhiều bảng theo chuỗi khóa ngoại (không có khóa ngoại trực tiếp từ `BAI_HOC` đến `GIANG_VIEN`, phải đi qua `KHOA_HOC`).

### 8 — Khóa học chưa có học viên nào đăng ký
**Vì sao cần:** cảnh báo khóa học "chết" — không ai mua, cần xem lại marketing hoặc gỡ khỏi trang chủ.
**Kỹ thuật:** `LEFT JOIN DANG_KY` rồi lọc `WHERE dk.MaDK IS NULL`.
**Vì sao viết vậy:** đây là cách chuẩn để tìm "không tồn tại dòng khớp" — `LEFT JOIN` giữ lại mọi khóa học dù không có đăng ký nào (INNER JOIN sẽ làm mất hẳn các khóa này khỏi kết quả, không tìm được).

### 9 — Top 3 khóa học doanh thu cao nhất
**Vì sao cần:** biết khóa "con gà đẻ trứng vàng" để đầu tư thêm nội dung, hoặc làm case study bán hàng.
**Kỹ thuật:** `JOIN` thêm `THANH_TOAN` (chỉ `success`), `SUM(HocPhi)`, `ORDER BY DESC LIMIT 3`.
**Vì sao viết vậy:** nếu chỉ `SUM(DANG_KY.HocPhi)` mà không `JOIN THANH_TOAN`, kết quả sẽ tính cả những đăng ký **chưa hề trả tiền** → doanh thu ảo, sai hoàn toàn với số tiền thực nhận.

### 10 🔴 — Xếp hạng học viên theo điểm trong từng khóa
**Vì sao cần:** làm bảng vinh danh/leaderboard theo từng khóa riêng biệt — học viên khóa A không bị xếp lẫn với khóa B.
**Kỹ thuật:** window function `RANK() OVER (PARTITION BY MaKH ORDER BY DiemTrungBinh DESC)`.
**Vì sao viết vậy:** `PARTITION BY MaKH` là mấu chốt — nó "chia nhỏ" bảng thành từng khóa riêng rồi đánh hạng độc lập trong mỗi phần, khác hẳn `ORDER BY` thường chỉ sắp xếp toàn bảng. Dùng `RANK()` (không dùng `ROW_NUMBER()`) vì nếu 2 học viên bằng điểm, họ phải đồng hạng — `ROW_NUMBER()` sẽ ép mỗi người 1 số khác nhau, sai về nghiệp vụ.

---

## 🟧 THỊNH

### 11 ⭐ — Doanh thu hệ thống theo tháng (thanh toán thành công trừ hoàn tiền thành công)
**Vì sao cần:** chỉ số kinh doanh quan trọng nhất — admin cần biết chính xác tiền thực thu mỗi tháng.
**Kỹ thuật:** `SUM(CASE WHEN LoaiGiaoDich='thanh_toan' THEN SoTien ELSE -SoTien END)` chỉ trên các dòng `TrangThaiTT='success'`, `GROUP BY` tháng theo `ThoiGian` (ngày **giao dịch**, không phải ngày đăng ký).
**Vì sao viết vậy (đã cập nhật theo đề bài bản sửa):** trước đây chỉ cộng `thanh_toan` thành công và lấy số tiền từ `DANG_KY.HocPhi`. Đề bài bản sửa yêu cầu trừ cả hoàn tiền, nên: (1) thêm cột `THANH_TOAN.SoTien` riêng — không dùng `HocPhi` nữa vì 1 khoản hoàn có thể khác học phí gốc; (2) khi hủy đăng ký, hệ thống tự ghi 1 dòng `hoan_tien` thành công (không xóa dòng `thanh_toan` cũ, tránh tính trùng/tính thiếu — đúng quy tắc "điều chỉnh bằng giao dịch hoàn tiền, không xóa khoản thu đã ghi nhận"); (3) `CASE WHEN` cộng dòng mua, trừ dòng hoàn, dùng chung ngày **giao dịch** để nhóm theo tháng vì 1 người có thể đăng ký tháng 7 nhưng trả/hủy&hoàn ở tháng khác.

### 12 ⭐ — Đánh giá/nhận xét theo khóa học, theo mốc thời gian
**Vì sao cần:** theo dõi phản hồi học viên theo thời gian — phát hiện sớm nếu 1 khóa bắt đầu bị đánh giá kém sau khi sửa nội dung.
**Kỹ thuật:** `JOIN DANH_GIA → DANG_KY → KHOA_HOC (+ HOC_VIEN)`, lọc khoảng ngày, `ORDER BY NgayDG`.
**Vì sao viết vậy:** đi qua `DANG_KY` bắt buộc vì `DANH_GIA` không có khóa ngoại trực tiếp tới `KHOA_HOC` hay `HOC_VIEN` — đúng theo thiết kế "1 đánh giá gắn với 1 lượt đăng ký cụ thể" (không phải gắn thẳng vào khóa học), để tránh 1 học viên đánh giá khóa 2 lần nếu học lại.

### 13 — Tỷ lệ học viên có chứng chỉ mỗi khóa
**Vì sao cần:** đo mức độ "học thật, học tới cùng" của từng khóa — tỷ lệ cấp chứng chỉ thấp có thể do khóa quá khó hoặc tiêu chí cấp chứng chỉ chưa hợp lý.
**Kỹ thuật:** `LEFT JOIN CHUNG_CHI`, `COUNT(DISTINCT ...)` cho cả tử và mẫu.
**Vì sao viết vậy:** dùng `LEFT JOIN` + `COUNT(DISTINCT cc.MaDK)` (không phải `COUNT(*)`) để không bị nhân dòng sai nếu cấu trúc join có thể tạo thêm dòng — cách viết an toàn hơn, ít phụ thuộc giả định "chắc chắn 1:1" dù hiện tại `CHUNG_CHI.MaDK` đã `UNIQUE`.

### 14 — Học viên chưa từng thanh toán
**Vì sao cần:** danh sách "khách lạnh" để gửi email nhắc nhở / ưu đãi khuyến khích thanh toán — giữ chân người dùng.
**Kỹ thuật:** `NOT IN` trên subquery các `MaHV` đã từng có giao dịch `success`.
**Vì sao viết vậy:** lọc qua subquery độc lập dễ đọc hơn `LEFT JOIN ... WHERE NULL` trong trường hợp này vì không cần lấy thêm cột nào từ `THANH_TOAN` — chỉ cần biết "có hay không", nên `NOT IN` gọn và đúng mục đích hơn.

### 15 — Gộp email giảng viên + học viên
**Vì sao cần:** phục vụ việc gửi thông báo hệ thống (newsletter, bảo trì server) tới toàn bộ người dùng — cả giảng viên và học viên — mà không cần viết 2 lệnh riêng.
**Kỹ thuật:** `UNION` 2 câu `SELECT` có cùng số cột, cùng kiểu dữ liệu.
**Vì sao viết vậy:** dùng `UNION` (không phải `UNION ALL`) vì muốn tự loại các dòng trùng lặp hoàn toàn (trường hợp hiếm nhưng về lý thuyết 1 người có thể vừa là GV vừa đăng ký làm HV — tuy hệ thống hiện chưa cho phép 2 vai trò cùng 1 email, nhưng `UNION` vẫn an toàn hơn về mặt thiết kế).
