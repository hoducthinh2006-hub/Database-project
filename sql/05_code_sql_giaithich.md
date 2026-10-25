# SQL trong code backend N9 — kỹ thuật cần biết

Tài liệu này KHÁC với `04_queries_giaithich.md`. File đó giải thích **15 câu truy vấn báo cáo** mà Trà/Lộc/Thịnh tự viết trong `04_queries.sql` — phần SQL bị chấm điểm.

File này giải thích SQL nằm **trong code backend** (`server/src/`) — do Claude viết để app chạy được (đăng nhập, đăng ký khóa, thanh toán, bảng xếp hạng, vinh danh...). Không bị chấm trực tiếp, nhưng vẫn là SQL thật chạy trên DB thật, và có thể bị hỏi khi bảo vệ đồ án ("sao trang này hiện được số liệu này?"). Đọc để hiểu và trả lời được.

---

## 1. Transaction + khóa dòng (`FOR UPDATE`)

Khi 1 thao tác cần sửa nhiều bước và không được để "nửa vời" nếu lỗi giữa chừng, code bọc trong 1 **transaction**: thành công thì lưu hết, lỗi thì huỷ hết.

```js
// server/src/utils/tx.js — nơi DUY NHẤT định nghĩa transaction, mọi chỗ khác gọi lại hàm này
async function withTx(pool, fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
```

**`FOR UPDATE`** đi kèm transaction để khoá dòng đang đọc, chặn 2 yêu cầu cùng lúc chỉnh cùng 1 dòng (race condition). Ví dụ thật — học viên bấm "Gửi yêu cầu thanh toán" 2 lần liên tiếp (double-click, hoặc mở 2 tab):

```sql
-- server/src/routes/student.routes.js — POST /payments
SELECT MaDK, MaHV, HocPhi, TTDangKy FROM DANG_KY WHERE MaDK = ? FOR UPDATE
```

Yêu cầu thứ 2 phải đợi yêu cầu thứ 1 commit/rollback xong mới được đọc dòng này, nên không thể có 2 giao dịch pending cùng tồn tại cho 1 lượt đăng ký (CSDL còn có trigger `trg_mot_lan_thanh_toan` làm lưới an toàn thứ hai, chặn ở tầng INSERT).

Dùng ở mọi chỗ "đọc rồi mới quyết định insert/update": đăng ký khóa học, nộp bài kiểm tra, gửi/duyệt/từ chối thanh toán, cấp chứng chỉ (`routes/admin.routes.js`, `routes/student.routes.js`, `routes/quizzes.routes.js`, `routes/courses.routes.js`, `utils/enrollment.js`).

---

## 2. UNION / UNION ALL

3 vai trò (học viên, giảng viên, admin) nằm ở **3 bảng khác nhau**. Lúc đăng nhập, server không biết email thuộc bảng nào nên dò cả 3 trong 1 truy vấn:

```sql
-- server/src/routes/auth.routes.js — POST /login
SELECT 'student' AS role, MaHV AS ma, HoTen, Email, MatKhauHash, TrangThaiTK FROM HOC_VIEN WHERE Email=?
UNION ALL SELECT 'teacher', MaGV, HoTen, Email, MatKhauHash, TrangThaiTK FROM GIANG_VIEN WHERE Email=?
UNION ALL SELECT 'admin', MaAD, HoTen, Email, MatKhauHash, 'active' FROM ADMIN WHERE Email=?
```

Dùng `UNION ALL` (không phải `UNION`) vì biết chắc email không trùng giữa 3 bảng (đã có ràng buộc ở tầng đăng ký) — `UNION ALL` nhanh hơn vì không phải lọc trùng.

Một chỗ khác: **dòng hoạt động gần đây** của học viên (trang "Học tập của tôi") gộp 4 nguồn khác hẳn nhau thành 1 dòng thời gian duy nhất:

```sql
-- server/src/routes/student.routes.js — GET /overview, feed hoạt động
(SELECT 'dang_ky' AS Loai, dk.NgayDangKy AS ThoiGian, kh.TenKH AS TieuDe, NULL AS PhuDe, kh.MaKH
   FROM DANG_KY dk JOIN KHOA_HOC kh ON kh.MaKH = dk.MaKH WHERE dk.MaHV = ?)
UNION ALL
(SELECT 'bai_hoc', ls.ThoiDiemHoc, bh.TenBH, kh.TenKH, kh.MaKH
   FROM LICH_SU_HOC_TAP ls JOIN DANG_KY dk ON dk.MaDK = ls.MaDK
   JOIN BAI_HOC bh ON bh.MaBH = ls.MaBH JOIN KHOA_HOC kh ON kh.MaKH = dk.MaKH
  WHERE dk.MaHV = ? AND ls.TrangThaiHoanThanh = 'hoan_thanh')
UNION ALL
(SELECT 'kiem_tra', kq.ThoiGianLam, bkt.TenBKT, CONCAT(kh.TenKH, ' · lần ', kq.LanLam, ' · ', kq.DiemSo, ' điểm'), kh.MaKH
   FROM KET_QUA kq JOIN DANG_KY dk ON dk.MaDK = kq.MaDK
   JOIN BAI_KIEM_TRA bkt ON bkt.MaBKT = kq.MaBKT JOIN BAI_HOC bh ON bh.MaBH = bkt.MaBH
   JOIN KHOA_HOC kh ON kh.MaKH = bh.MaKH
  WHERE dk.MaHV = ?)
UNION ALL
(SELECT 'chung_chi', CAST(cc.NgayCap AS DATETIME), kh.TenKH, NULL, kh.MaKH
   FROM CHUNG_CHI cc JOIN DANG_KY dk ON dk.MaDK = cc.MaDK JOIN KHOA_HOC kh ON kh.MaKH = dk.MaKH
  WHERE dk.MaHV = ?)
ORDER BY ThoiGian DESC LIMIT 12
```

4 bảng khác hẳn nhau về cấu trúc (đăng ký, học bài, làm bài kiểm tra, nhận chứng chỉ) nhưng gộp được thành 1 dòng thời gian vì mỗi nhánh `SELECT` trả đúng số cột, cùng kiểu, theo đúng thứ tự (cột `Loai` là chuỗi cố định để frontend biết hiện icon nào).

---

## 3. Subquery tương quan với `EXISTS`

Kiểm tra "có tồn tại dòng nào khớp điều kiện hay không" — nhanh hơn JOIN vì chỉ cần tìm thấy 1 dòng là dừng, không phải lấy hết rồi lọc trùng. Dùng nhiều nhất cho "đã thanh toán chưa / đang chờ duyệt chưa":

```sql
-- server/src/utils/access.js — studentEntitlement(): MỘT CHỖ DUY NHẤT quyết định "học viên có quyền xem khóa này không"
SELECT dk.MaDK, dk.TTDangKy, dk.HocPhi, dk.NgayDangKy,
       EXISTS(SELECT 1 FROM THANH_TOAN tt WHERE tt.MaDK = dk.MaDK AND tt.TrangThaiTT = 'success') AS DaTra,
       EXISTS(SELECT 1 FROM THANH_TOAN tt WHERE tt.MaDK = dk.MaDK AND tt.TrangThaiTT = 'pending') AS DangCho
FROM DANG_KY dk
WHERE dk.MaHV = ? AND dk.MaKH = ? AND dk.TTDangKy <> 'da_huy'
ORDER BY dk.NgayDangKy DESC, dk.MaDK DESC LIMIT 1
```

`tt.MaDK = dk.MaDK` bên trong `EXISTS` tham chiếu tới dòng `dk` của truy vấn ngoài — đây là **subquery tương quan** (correlated subquery): chạy lại 1 lần cho mỗi dòng `dk`, khác với subquery độc lập (chạy 1 lần duy nhất, không phụ thuộc dòng ngoài).

Toàn bộ quyền xem video, làm bài kiểm tra, trang "Khóa học của tôi"... đều gọi lại đúng 1 hàm này (`access.js`) thay vì mỗi chỗ tự viết điều kiện riêng — tránh 2 nơi định nghĩa "đã thanh toán" khác nhau.

---

## 4. Subquery vô hướng (scalar subquery) trong SELECT

Trả về **đúng 1 giá trị** cho mỗi dòng, đặt ngay trong danh sách cột — dùng khi cần đếm/lấy số liệu từ bảng khác mà không muốn JOIN rồi GROUP BY (sẽ làm nhân dòng nếu JOIN 1-nhiều).

```sql
-- server/src/routes/admin.routes.js — GET /overview
SELECT
  (SELECT COUNT(*) FROM HOC_VIEN)   AS SoHocVien,
  (SELECT COUNT(*) FROM GIANG_VIEN) AS SoGiangVien,
  (SELECT COUNT(*) FROM KHOA_HOC)   AS SoKhoaHoc,
  (SELECT COUNT(*) FROM KHOA_HOC WHERE TrangThai='published') AS SoKhoaHocCongKhai,
  (SELECT COUNT(*) FROM DANG_KY)    AS SoDangKy
```

5 con số độc lập, không liên quan gì nhau — nếu JOIN 5 bảng này lại rồi COUNT thì số sẽ sai (nhân chéo). Viết 5 subquery riêng là cách đúng và cũng dễ đọc hơn.

Một ví dụ khác — mỗi khóa học hiện "số bài học" ngay trong danh sách khóa:

```sql
-- server/src/routes/admin.routes.js — GET /courses
SELECT kh.MaKH, kh.TenKH, kh.TrangThai, kh.HocPhi, kh.NgayTao, gv.HoTen AS TenGV,
       (SELECT COUNT(*) FROM BAI_HOC bh WHERE bh.MaKH = kh.MaKH) AS SoBaiHoc,
       COUNT(DISTINCT dk.MaDK) AS SoLuotDangKy
FROM KHOA_HOC kh JOIN GIANG_VIEN gv ON gv.MaGV = kh.MaGV
LEFT JOIN DANG_KY dk ON dk.MaKH = kh.MaKH
GROUP BY kh.MaKH, ...
```

`SoBaiHoc` là subquery vô hướng (không bị ảnh hưởng bởi GROUP BY ngoài), còn `SoLuotDangKy` là `COUNT(DISTINCT ...)` qua JOIN — 2 cách khác nhau cho 2 loại số liệu.

---

## 5. JOIN với VIEW của nhóm

Nhóm đã viết sẵn 4 view trong `03_views.sql` (`V_TIEN_DO`, `V_DIEM_TB`, `V_HOAN_THANH`, `V_LAN_DANG_KY`) để không phải lặp lại công thức tính tiến độ/điểm TB ở nhiều nơi. Code backend JOIN thẳng vào các view này như JOIN 1 bảng bình thường:

```sql
-- server/src/routes/student.routes.js — GET /overview
SELECT dk.MaDK, dk.MaKH, kh.TenKH, ..., gv.HoTen AS TenGV,
       dk.HocPhi, dk.NgayDangKy, dk.TTDangKy,
       lan.LanDangKy,
       td.TongSoBai, td.SoBaiHoanThanh, COALESCE(td.TienDoPhanTram, 0) AS TienDoPhanTram,
       dtb.DiemTrungBinh AS DiemTB,
       ...
FROM DANG_KY dk
JOIN KHOA_HOC kh        ON kh.MaKH = dk.MaKH
JOIN GIANG_VIEN gv      ON gv.MaGV = kh.MaGV
JOIN V_TIEN_DO td       ON td.MaDK = dk.MaDK       -- view: tiến độ học (%)
JOIN V_LAN_DANG_KY lan  ON lan.MaDK = dk.MaDK       -- view: đây là lần đăng ký thứ mấy của HV với khóa này
LEFT JOIN V_DIEM_TB dtb ON dtb.MaDK = dk.MaDK       -- view: điểm TB các bài kiểm tra
WHERE dk.MaHV = ?
```

`V_DIEM_TB` dùng `LEFT JOIN` (có thể chưa làm bài kiểm tra nào → NULL), còn `V_TIEN_DO`/`V_LAN_DANG_KY` dùng `JOIN` thường vì mọi `DANG_KY` chắc chắn có dòng tương ứng trong 2 view đó. Đây là lý do thực tế nên hiểu khi thầy cô hỏi "view của các em dùng ở đâu" — không chỉ nằm trong `03_views.sql`, mà được gọi lại khắp các trang của app.

---

## 6. GROUP BY + HAVING + hàm tổng hợp

Ví dụ thật — bảng "Giảng viên" trong trang quản trị, mỗi dòng là 1 GV kèm số khóa/số học viên/tổng doanh thu, tính từ việc gộp 3 bảng rồi nhóm theo GV:

```sql
-- server/src/routes/admin.routes.js — GET /teachers
SELECT gv.MaGV, gv.HoTen, gv.Email, gv.ChuyenMon, gv.TrinhDo, gv.TrangThaiTK,
       COUNT(DISTINCT kh.MaKH) AS SoKhoaHoc,
       COUNT(DISTINCT dk.MaHV) AS SoHocVien,
       COALESCE(SUM(CASE WHEN tt.TrangThaiTT = 'success' AND tt.LoaiGiaoDich = 'thanh_toan' THEN dk.HocPhi END), 0) AS TongDoanhThu
FROM GIANG_VIEN gv
LEFT JOIN KHOA_HOC kh ON kh.MaGV = gv.MaGV
LEFT JOIN DANG_KY dk  ON dk.MaKH = kh.MaKH
LEFT JOIN THANH_TOAN tt ON tt.MaDK = dk.MaDK
GROUP BY gv.MaGV, gv.HoTen, gv.Email, gv.ChuyenMon, gv.TrinhDo, gv.TrangThaiTK
ORDER BY gv.MaGV
```

Toàn dùng `LEFT JOIN` vì GV mới tạo chưa có khóa/học viên/doanh thu vẫn phải hiện ra (JOIN thường sẽ làm GV đó biến mất khỏi kết quả). `COUNT(DISTINCT ...)` để không đếm trùng khi 1 GV có nhiều khóa × nhiều học viên. `SUM(CASE WHEN ... THEN ... END)` là cách cộng có điều kiện — chỉ cộng học phí của giao dịch thành công, không phải mọi học phí.

`HAVING` thì đã có sẵn ở câu #4 của nhóm trong `04_queries.sql` (`HAVING COUNT(kh.MaKH) >= 2` — giảng viên dạy từ 2 khóa trở lên) nên không lặp lại ở đây, chỉ cần nhớ: `HAVING` lọc SAU khi đã GROUP BY (lọc trên kết quả gộp), còn `WHERE` lọc TRƯỚC khi gộp (lọc từng dòng gốc).

---

## 7. Tham số hóa truy vấn (dấu `?`)

Mọi câu SQL trong code — kể cả 15 câu báo cáo khi gắn vào backend — đều dùng dấu `?` thay vì nối chuỗi trực tiếp giá trị người dùng nhập vào:

```js
// ĐÚNG — mysql2 tự escape giá trị, không thể chèn SQL độc hại
pool.query('SELECT * FROM HOC_VIEN WHERE Email = ?', [email]);

// SAI — nếu làm thế này, ai gõ email dạng  ' OR '1'='1  sẽ phá được câu lệnh
pool.query(`SELECT * FROM HOC_VIEN WHERE Email = '${email}'`);
```

Đây là cách chống **SQL injection**. `?` là chỗ trống (placeholder); thư viện `mysql2` sẽ tự đặt giá trị vào đúng chỗ VÀ tự thêm dấu nháy/escape ký tự đặc biệt, nên giá trị người dùng nhập không bao giờ được hiểu là một phần của câu lệnh SQL, dù họ gõ gì vào ô input.

Kể cả ở `reports.routes.js` (chạy 15 câu của nhóm), tham số năm/tháng/ngày đều được validate kiểu số/định dạng ngày TRƯỚC khi đưa vào `?`, phòng trường hợp ai đó tự gọi thẳng API với giá trị lạ.

---

## 8. Vì sao bảng xếp hạng KHÔNG dùng `RANK() OVER` mà tính bằng JavaScript

Câu #10 của nhóm (`xephang-hocvien` trong `04_queries.sql`) dùng window function thật của SQL:

```sql
RANK() OVER (PARTITION BY dk.MaKH ORDER BY vdt.DiemTrungBinh DESC) AS XepHang
```

Đây là SQL chuẩn, 1 câu xử lý xong toàn bộ — đúng tinh thần bài tập. Nhưng bảng xếp hạng SỐNG trên giao diện (học viên dùng hàng ngày) lại được tính bằng JavaScript trong `server/src/utils/ranking.js`:

```js
// server/src/utils/ranking.js
function assignRanks(sorted, key) {
  let prev = null, rank = 0;
  sorted.forEach((r, i) => {
    const k = key(r);
    if (k !== prev) { rank = i + 1; prev = k; }
    r.Hang = rank;
  });
  return sorted;
}
```

Lý do: `RANK() OVER` chỉ so sánh được **1 tiêu chí** (ví dụ điểm TB) và tự quyết định đồng hạng dựa đúng trên tiêu chí đó. Bảng xếp hạng thật của app cần nhiều quy tắc hơn SQL thuần làm gọn được:
- Đồng điểm thì xét tiếp "ai tiến độ cao hơn", rồi "ai làm nhiều bài hơn", rồi "ai làm ÍT LƯỢT hơn" (đạt cùng điểm mà ít phải làm lại) — 4 tầng tiêu chí phụ.
- Có **ngưỡng tối thiểu** (phải làm ≥ 2 bài kiểm tra mới được xếp hạng) — người chưa đạt ngưỡng vẫn hiện trong danh sách nhưng KHÔNG có số hạng.
- Cùng 1 hàm `assignRanks()` dùng lại cho cả bảng xếp hạng theo khóa, bảng vàng toàn hệ thống, và trang Vinh danh — nếu viết bằng SQL thì phải lặp lại `RANK() OVER` phức tạp ở nhiều câu khác nhau, dễ lệch quy tắc giữa các trang.

Nói cách khác: `RANK() OVER` (câu #10, SQL) và `assignRanks()` (JS) giải quyết CÙNG một bài toán xếp hạng nhưng ở 2 tầng khác nhau — SQL cho 1 báo cáo tĩnh, JS cho 1 tính năng sống cần logic nghiệp vụ linh hoạt hơn những gì 1 câu SQL nên gánh.

---

## 9. Bảng tổng kết — file nào, kỹ thuật nào

| File | Vai trò | Kỹ thuật SQL nổi bật |
|---|---|---|
| `routes/reports.routes.js` | Chạy **15 câu của nhóm** (gắn `?` thay số cứng) | Không phải SQL của Claude — chỉ "gắn dây" |
| `routes/student.routes.js` | Tổng quan học tập, xếp hạng theo khóa, thanh toán, đánh giá | UNION ALL (feed hoạt động), EXISTS, subquery vô hướng, JOIN với VIEW, FOR UPDATE |
| `routes/admin.routes.js` | Thống kê, quản lý GV/HV/khóa, duyệt thanh toán, 7 bảng dữ liệu thô | Subquery vô hướng, GROUP BY + SUM(CASE WHEN), FOR UPDATE |
| `routes/courses.routes.js` | Danh mục khóa học, đăng ký học, CRUD bài học | JOIN với VIEW, FOR UPDATE |
| `routes/quizzes.routes.js` | Bài kiểm tra, nộp bài, chấm điểm | FOR UPDATE, transaction |
| `routes/auth.routes.js` | Đăng ký, đăng nhập, hồ sơ | UNION ALL (dò 3 bảng vai trò), subquery vô hướng (check trùng email) |
| `routes/teacher.routes.js` | Bảng điều khiển giảng viên | EXISTS, subquery vô hướng |
| `routes/honors.routes.js` | Trang Vinh danh | Gọi lại `ranking.js`, vài GROUP BY/HAVING riêng cho danh hiệu |
| `utils/ranking.js` | **Nguồn SQL + JS duy nhất** cho mọi bảng xếp hạng | JOIN, GROUP BY, và `assignRanks()` bằng JS thay cho `RANK() OVER` |
| `utils/enrollment.js` | Tự động chuyển trạng thái đăng ký + cấp chứng chỉ | FOR UPDATE, transaction |
| `utils/access.js` | 1 chỗ duy nhất: "ai được xem gì" | EXISTS (subquery tương quan) |
| `utils/id.js` | Sinh mã tự tăng (HV001, KH002...) | `SELECT MAX(...)` + transaction |
| `utils/tx.js` | Định nghĩa transaction dùng chung | Không có SQL, nhưng mọi transaction trong app đi qua đây |
