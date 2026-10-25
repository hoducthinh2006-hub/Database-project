# Kiến trúc hệ thống N9 — giải thích chi tiết cho người chưa học Backend/Frontend

Tài liệu này giải thích **toàn bộ cách web N9 hoạt động**: có những phần nào, mỗi file làm gì, và chúng nối với nhau ra sao. Viết cho người chưa học Backend/Frontend, nên phần đầu sẽ giải thích từ những khái niệm cơ bản nhất trước, sau đó mới đi vào từng file thật của dự án.

---

## 0. Trước tiên: một trang web "hoạt động" như thế nào?

Tưởng tượng một trang web giống như **một quán ăn**:

- **Bạn (trình duyệt / browser — Chrome, Edge...)** là khách bước vào quán, cầm thực đơn, gọi món.
- **Thực đơn + cách bày trí quán** chính là **giao diện (frontend)** — thứ bạn nhìn thấy và bấm vào.
- Khi bạn gọi món (bấm nút "Đăng nhập", "Thanh toán"...), quán không tự nấu ngay tại bàn — nó viết lại **1 tờ order** gửi xuống bếp. Tờ order này, trong web, gọi là **HTTP request** (yêu cầu).
- **Bếp** chính là **server (backend)** — nơi thật sự xử lý: kiểm tra order hợp lệ không, có đủ nguyên liệu không, nấu món.
- **Kho nguyên liệu** chính là **cơ sở dữ liệu (database)** — nơi lưu trữ LÂU DÀI mọi thứ (tài khoản, khóa học, điểm số...). Bếp phải vào kho lấy/cất nguyên liệu mỗi khi nấu.
- Nấu xong, bếp bưng món ra trả khách — đây là **HTTP response** (phản hồi).
- Order và món trả về đều viết theo **1 định dạng chung cả bếp lẫn khách đều hiểu** — trong web gọi là **JSON** (giống như order viết theo mẫu có sẵn: tên món, số lượng, ghi chú... thay vì viết văn xuôi lan man).

**Vài thuật ngữ sẽ gặp liên tục, nhớ trước:**

| Thuật ngữ | Nghĩa đơn giản |
|---|---|
| **Frontend** | Phần chạy TRONG trình duyệt của người dùng — HTML/CSS/JS. Người dùng nhìn thấy, bấm vào. |
| **Backend** | Phần chạy TRÊN máy chủ (server), người dùng không nhìn thấy code. Xử lý logic, kiểm tra quyền, đọc/ghi database. |
| **API** | "Thực đơn" các việc mà backend cho phép frontend yêu cầu, kèm đúng cách gọi (địa chỉ, kiểu dữ liệu gửi lên). |
| **Endpoint** | 1 "món" cụ thể trong API — ví dụ `POST /api/auth/login` là endpoint "đăng nhập". |
| **HTTP request/response** | Yêu cầu gửi đi / phản hồi gửi về giữa trình duyệt và server. |
| **JSON** | Định dạng văn bản để gửi dữ liệu có cấu trúc, dạng `{"ten": "Trà", "tuoi": 20}` — cả frontend và backend đều đọc được. |
| **Route (tuyến)** | 1 đường dẫn URL cụ thể trên server, gắn với 1 đoạn code xử lý riêng — ví dụ route `/api/courses` xử lý mọi thứ liên quan khóa học. |
| **Middleware** | Một "trạm kiểm tra" chạy TRƯỚC khi yêu cầu tới được route chính — ví dụ kiểm tra "bạn đã đăng nhập chưa" trước khi cho xem bài học. |
| **Database / CSDL** | Nơi lưu dữ liệu lâu dài, có cấu trúc bảng — ở đây dùng MySQL. |
| **Token / JWT** | Một "thẻ ra vào" được cấp sau khi đăng nhập thành công; trình duyệt gửi kèm thẻ này ở mọi yêu cầu sau đó để chứng minh "tôi đã đăng nhập, tôi là ai". |
| **Query (truy vấn)** | 1 câu lệnh SQL hỏi/ghi dữ liệu trong database (SELECT, INSERT, UPDATE...). |

---

## 1. Kiến trúc tổng thể — 3 tầng

N9 gồm đúng 3 "tầng" xếp chồng lên nhau, mỗi tầng 1 việc riêng:

```
┌─────────────────────────────────────────────────────────┐
│  TẦNG 1 — GIAO DIỆN (frontend)                            │
│  Thư mục: web/                                             │
│  Chạy TRONG trình duyệt của người dùng                     │
│  Việc: vẽ màn hình, bắt sự kiện bấm/gõ, gọi backend         │
└───────────────────────┬─────────────────────────────────┘
                         │ HTTP request/response (JSON)
                         │ qua internet / localhost
┌───────────────────────▼─────────────────────────────────┐
│  TẦNG 2 — XỬ LÝ (backend)                                  │
│  Thư mục: server/                                           │
│  Chạy TRÊN máy chủ (Node.js + Express)                      │
│  Việc: kiểm tra quyền, xử lý nghiệp vụ, đọc/ghi database     │
└───────────────────────┬─────────────────────────────────┘
                         │ câu lệnh SQL
                         │ qua kết nối MySQL
┌───────────────────────▼─────────────────────────────────┐
│  TẦNG 3 — DỮ LIỆU (database)                                │
│  Định nghĩa trong: sql/                                     │
│  Chạy trong MySQL Server (chương trình riêng, luôn bật sẵn)  │
│  Việc: lưu trữ LÂU DÀI mọi dữ liệu thật                      │
└─────────────────────────────────────────────────────────┘
```

Mỗi tầng **không biết chi tiết bên trong của tầng kia**, chỉ biết cách "nói chuyện" với tầng liền kề:
- Frontend không biết MySQL là gì, chỉ biết gọi `fetch(...)` tới 1 địa chỉ và nhận JSON về.
- Backend không quan tâm giao diện trông ra sao, chỉ biết nhận request, trả JSON đúng.
- Database không biết gì về web, chỉ biết trả lời đúng câu SQL được hỏi.

Đây là lý do 1 người có thể sửa giao diện (CSS) mà không làm hỏng logic thanh toán, hay đổi logic thanh toán mà không cần sửa 1 dòng HTML nào.

---

## 2. Tầng 1 — Giao diện (`web/`)

```
web/
├── index.html       ← khung trang duy nhất (toàn bộ web chỉ có 1 trang HTML!)
├── css/
│   └── style.css    ← mọi style (màu, bố cục, animation...)
└── js/
    ├── boot.js       ← chạy sớm nhất, chống "chớp" sai giao diện
    ├── api.js        ← "người đưa thư" — gửi/nhận dữ liệu với backend
    ├── galaxy.js     ← vẽ nền thiên hà động (trang trí)
    ├── motion.js     ← hệ thống animation dùng chung
    └── app.js        ← "bộ não" giao diện — ~2700 dòng, vẽ MỌI màn hình
```

### `index.html` — khung trang

Đây là file HTML DUY NHẤT của cả web. N9 là kiểu web gọi là **SPA (Single Page Application — ứng dụng 1 trang)**: dù bạn bấm "Khóa học", "Hồ sơ", "Quản trị"... trình duyệt **không tải lại trang mới**, chỉ có 1 thẻ `<main id="app"></main>` trống, và JavaScript (`app.js`) sẽ tự **vẽ lại nội dung bên trong thẻ đó** mỗi khi bạn chuyển trang — giống như thay tờ giấy trong 1 cái khung ảnh cố định, chứ không phải đổi cả cái khung.

`index.html` còn có nhiệm vụ **nạp các file CSS/JS theo đúng thứ tự** — thứ tự RẤT quan trọng:
```html
<script src="js/boot.js"></script>   <!-- 1. chạy sớm, set theme sáng/tối trước khi vẽ gì -->
...
<script src="js/api.js"></script>    <!-- 2. chuẩn bị "người đưa thư" trước -->
<script src="js/galaxy.js"></script> <!-- 3. nền trang trí -->
<script src="js/motion.js"></script> <!-- 4. hệ animation -->
<script src="js/app.js"></script>    <!-- 5. chạy SAU CÙNG — vì app.js cần dùng API.*, N9Motion.* đã có sẵn ở bước 2, 4 -->
```
Nếu đổi thứ tự (ví dụ để `app.js` nạp trước `api.js`), `app.js` sẽ gọi tới 1 hàm chưa tồn tại → lỗi ngay. Đây là lý do thứ tự `<script>` trong HTML quan trọng hơn người mới học thường nghĩ.

### `css/style.css` — toàn bộ giao diện

File CSS duy nhất, ~1300 dòng. Định nghĩa màu sắc (sáng/tối), bố cục, kiểu chữ, và toàn bộ hiệu ứng chuyển động. Không có logic gì cả, chỉ là "quy định trông ra sao".

### `js/boot.js` — chạy sớm nhất

File nhỏ nhất (14 dòng) nhưng chạy TRƯỚC TIÊN, ngay trong `<head>`, trước khi trình duyệt kịp vẽ bất cứ thứ gì. Việc duy nhất: đọc xem lần trước bạn chọn giao diện sáng hay tối (lưu trong trình duyệt), rồi áp ngay — để trang không bị "chớp trắng rồi mới chuyển tối" khi bạn đang dùng giao diện tối.

### `js/api.js` — "người đưa thư"

Đây là file **duy nhất trong frontend được phép nói chuyện với backend**. Mọi hàm trong này đều làm 1 việc: gửi 1 HTTP request tới địa chỉ backend, đợi trả lời, trả JSON về cho nơi gọi nó.

```js
// web/js/api.js — ví dụ 1 hàm thật trong file
studentPay: (maDK, phuongThuc) => req("POST", "/student/payments", { maDK, phuongThuc }),
```
Đọc hàm này: "khi học viên thanh toán, gửi 1 yêu cầu kiểu POST tới địa chỉ `/student/payments`, kèm theo mã đăng ký và phương thức thanh toán". `api.js` không biết (và không cần biết) backend xử lý thế nào bên trong — nó chỉ là người đưa thư, đưa đi rồi mang thư trả lời về.

Tách riêng file này ra có lý do: nếu sau này địa chỉ backend đổi (ví dụ deploy lên server khác), chỉ cần sửa 1 chỗ trong `api.js`, không phải sửa hàng chục chỗ rải rác trong `app.js`.

### `js/galaxy.js` — nền thiên hà động

Chỉ lo vẽ hiệu ứng nền (các ngôi sao, tinh vân chuyển động) lên 1 thẻ `<canvas>` khi giao diện tối được bật — thuần trang trí, không liên quan logic nghiệp vụ.

### `js/motion.js` — hệ animation dùng chung

Cung cấp các hàm animation (hiệu ứng mờ dần, trượt vào, gợn sóng khi bấm nút...) mà `app.js` gọi lại qua `window.N9Motion`. Tách riêng vì animation là một "mối quan tâm" độc lập với logic hiển thị dữ liệu — tự động tắt hết khi máy yếu hoặc người dùng bật "giảm chuyển động".

### `js/app.js` — bộ não của giao diện (file lớn nhất: ~2700 dòng)

Đây là file quan trọng nhất của frontend, làm tất cả những việc còn lại:

1. **Điều hướng (router):** quyết định khi URL/trạng thái đổi thì vẽ màn hình nào — trang chủ, danh mục khóa học, hồ sơ, trang học, trang quản trị...
2. **Vẽ giao diện bằng chuỗi HTML:** N9 không dùng framework (React/Vue...) — mỗi "màn hình" là 1 hàm JavaScript trả về 1 chuỗi HTML dài, ví dụ:
   ```js
   function viewHome() {
     return `<section class="hero">...</section>...`;
   }
   ```
   rồi gán chuỗi đó vào `<main id="app">`.
3. **Gọi `api.js`** để lấy dữ liệu thật (ví dụ danh sách khóa học), rồi nhét dữ liệu đó vào chuỗi HTML ở bước trên.
4. **Gắn sự kiện** (`onclick`, `onsubmit`...) sau khi vẽ xong, để khi người dùng bấm nút thì chạy đúng hàm xử lý.

Cách hoạt động ngắn gọn: **dữ liệu từ backend → chuỗi HTML → gắn vào trang → gắn sự kiện bấm.** Lặp lại chu trình này mỗi khi người dùng chuyển trang hay có dữ liệu mới.

---

## 3. Tầng 2 — Xử lý (`server/`)

```
server/
├── src/
│   ├── server.js            ← điểm khởi động, "cổng vào" duy nhất
│   ├── config/
│   │   ├── db.js             ← mở kết nối tới MySQL
│   │   └── env.js            ← đọc cấu hình từ file .env (mật khẩu, khóa bí mật...)
│   ├── middleware/
│   │   ├── auth.js           ← kiểm tra "bạn đã đăng nhập chưa / đúng vai trò chưa"
│   │   └── security.js       ← chặn tấn công (dò mật khẩu, gửi quá nhiều yêu cầu...)
│   ├── routes/                ← MỖI file = 1 nhóm chức năng, nhận request và trả JSON
│   │   ├── auth.routes.js      (đăng ký / đăng nhập / hồ sơ)
│   │   ├── courses.routes.js   (khóa học / bài học)
│   │   ├── quizzes.routes.js   (bài kiểm tra)
│   │   ├── student.routes.js   (trang học viên: tiến độ, xếp hạng, thanh toán...)
│   │   ├── teacher.routes.js   (bảng điều khiển giảng viên)
│   │   ├── admin.routes.js     (bảng điều khiển quản trị)
│   │   ├── reports.routes.js   (15 câu báo cáo của nhóm)
│   │   └── honors.routes.js    (trang Vinh danh)
│   └── utils/                 ← hàm dùng CHUNG cho nhiều route, tránh viết lặp
│       ├── http.js, validate.js, id.js, password.js, tx.js, access.js, enrollment.js, ranking.js
└── .env                      ← mật khẩu DB + khóa bí mật (KHÔNG commit lên git)
```

### `server.js` — điểm khởi động

Chạy lệnh `npm start` thì đây là file ĐẦU TIÊN được chạy. Việc của nó:

1. Đọc cấu hình (`config/env.js`) — nếu thiếu cấu hình quan trọng thì **dừng server ngay**, không để chạy thiếu an toàn.
2. Mở kết nối tới MySQL (`config/db.js`).
3. Gắn các "trạm kiểm tra" chung cho mọi request (`middleware/security.js`).
4. **Gắn từng nhóm route vào đúng địa chỉ gốc:**
   ```js
   // server/src/server.js
   api.use('/auth', require('./routes/auth.routes'));
   api.use('/courses', require('./routes/courses.routes'));
   api.use('/student', require('./routes/student.routes'));
   api.use('/admin', require('./routes/admin.routes'));
   // ...
   ```
   Đọc dòng này: "mọi request tới địa chỉ bắt đầu bằng `/api/auth/...` thì giao cho file `auth.routes.js` xử lý". Đây chính là chỗ nối giữa 1 địa chỉ URL và 1 file code cụ thể.
5. **Phục vụ luôn cả frontend:** `app.use(express.static(WEB_DIR))` — nghĩa là server này KHÔNG CHỈ xử lý API, mà còn gửi luôn file `index.html`/`style.css`/`app.js` cho trình duyệt khi bạn gõ `http://localhost:3000`. Vì vậy chỉ cần chạy đúng 1 server là có cả web lẫn API, không cần 2 server riêng.
6. Lắng nghe (listen) ở 1 cổng (mặc định 3000) — từ lúc này server "mở cửa" chờ nhận request.

### `config/db.js` — kết nối MySQL

Mở 1 **connection pool** (nhóm kết nối) tới MySQL bằng thư viện `mysql2`. "Pool" nghĩa là giữ sẵn vài kết nối mở, dùng chung cho nhiều request cùng lúc, thay vì mở/đóng kết nối mới liên tục (chậm).

### `config/env.js` — cấu hình môi trường

Đọc file `.env` (chứa mật khẩu DB, khóa bí mật JWT...) — file này **không bao giờ được đưa lên GitHub** vì chứa thông tin nhạy cảm. Nếu khóa bí mật JWT quá yếu/thiếu, file này buộc server phải **dừng ngay khi khởi động**, không để chạy "lỏng lẻo" mà không ai biết.

### `middleware/auth.js` — trạm kiểm tra đăng nhập/quyền

**Middleware** là đoạn code chạy XEN GIỮA lúc request tới và lúc route chính xử lý — giống bảo vệ đứng trước cửa bếp, kiểm tra thẻ ra vào trước khi cho khách vào trong.

```js
// ý tưởng: route nào cần đăng nhập thì gắn thêm "auth" vào trước
router.get('/me', auth, async (req, res) => { ... });
//                ^^^^ middleware chạy TRƯỚC hàm xử lý /me
```
`auth` đọc "thẻ ra vào" (JWT token) người dùng gửi kèm, kiểm tra hợp lệ không, tài khoản có đang bị khóa không — hợp lệ thì mới cho đi tiếp vào route thật, không thì chặn lại và trả lỗi ngay, route thật không bao giờ chạy tới.

File này còn có `teacherOnly`, `studentOnly`, `adminOnly` — các biến thể chỉ cho đúng 1 vai trò đi qua.

### `middleware/security.js` — chống tấn công

Chạy cho MỌI request, làm các việc: thêm tiêu đề bảo mật HTTP (chặn script lạ), giới hạn số request/phút từ 1 địa chỉ IP (chống spam), và đếm số lần đăng nhập sai để tạm khóa (chống dò mật khẩu).

### `routes/*.js` — nơi xử lý thật sự

Mỗi file là 1 nhóm chức năng, bên trong là nhiều "endpoint" — mỗi endpoint xử lý đúng 1 loại yêu cầu:

```js
// server/src/routes/auth.routes.js
router.post('/login', async (req, res) => {
  // 1. Lấy email/mật khẩu người dùng gửi lên (req.body)
  // 2. Tìm tài khoản trong DB khớp email đó
  // 3. So sánh mật khẩu (đã băm) có khớp không
  // 4. Khớp → tạo "thẻ ra vào" (JWT token), trả về cho frontend
  // 5. Không khớp → trả lỗi
});
```
Đây chính là nơi **nghiệp vụ thật sự diễn ra**: kiểm tra điều kiện, đọc/ghi database, tính toán — tất cả những gì người dùng không nhìn thấy nhưng quyết định web "thông minh" hay không.

### `utils/*.js` — hàm dùng chung

Nhiều route cần làm việc giống nhau (ví dụ: "kiểm tra học viên có quyền xem khóa này không") — thay vì viết lặp lại ở 5 chỗ, viết 1 lần trong `utils/access.js` rồi mọi route gọi lại hàm đó. Lợi ích: sửa 1 chỗ, mọi nơi dùng đều được sửa theo — không sợ 2 chỗ có quy tắc khác nhau.

| File | Làm gì |
|---|---|
| `http.js` | Định nghĩa lỗi chuẩn (400, 403, 404...) và cách trả lỗi — không bao giờ lộ chi tiết lỗi gốc của MySQL ra ngoài |
| `validate.js` | Kiểm tra dữ liệu người dùng gửi lên có hợp lệ không (email đúng định dạng, số trong khoảng cho phép...) |
| `id.js` | Tự sinh mã mới kiểu HV004, KH012... dựa trên mã lớn nhất hiện có |
| `password.js` | Băm mật khẩu (bcrypt), kiểm tra mật khẩu mới có đủ mạnh không |
| `tx.js` | Định nghĩa "transaction" (xem phần SQL bên dưới) dùng chung |
| `access.js` | 1 chỗ DUY NHẤT quyết định "học viên này có quyền xem khóa này không" |
| `enrollment.js` | Tự động chuyển trạng thái đăng ký khi học viên hoàn thành khóa, tự cấp chứng chỉ |
| `ranking.js` | Tính bảng xếp hạng (theo khóa, toàn hệ thống) |

---

## 4. Tầng 3 — Dữ liệu (`sql/` + MySQL)

MySQL là **một chương trình riêng, chạy nền trên máy**, hoàn toàn độc lập với Node.js — `server.js` chỉ là 1 trong vô số "khách hàng" có thể kết nối tới MySQL để hỏi/ghi dữ liệu.

```
sql/
├── 01_schema.sql    ← TẠO các bảng (CREATE TABLE) — chạy ĐẦU TIÊN
├── 02_seed_data.sql ← Dữ liệu mẫu ban đầu — chạy SAU 01
├── 03_views.sql     ← Tạo các "view" hỗ trợ — chạy SAU 02
├── 04_queries.sql   ← 15 câu truy vấn báo cáo của nhóm (phần bị chấm điểm)
└── 05_seed_demo.sql ← Dữ liệu demo nhiều hơn (tùy chọn, không bắt buộc chạy)
```

Các file này **không phải code chạy khi có người dùng** — chúng chỉ chạy 1 LẦN (hoặc vài lần khi cần làm mới dữ liệu) để DỰNG SẴN cấu trúc + dữ liệu trong MySQL, trước khi `server.js` khởi động. Khi web đang chạy, `server/src/routes/*.js` sẽ gửi các câu SQL (SELECT/INSERT/UPDATE) tới MySQL mỗi khi cần — MySQL luôn "đứng chờ sẵn" ở đó.

> Chi tiết các kỹ thuật SQL dùng trong code backend (transaction, UNION, subquery...) đã giải thích riêng ở `sql/05_code_sql_giaithich.md`.

---

## 5. Ba tầng NỐI với nhau như thế nào — sơ đồ chi tiết

```
Trình duyệt (web/js/app.js)
   │
   │ 1. Người dùng bấm nút "Đăng nhập"
   ▼
web/js/app.js gọi API.login(email, matKhau)
   │
   ▼
web/js/api.js gửi:  fetch("http://localhost:3000/api/auth/login", { method:"POST", body: {...} })
   │
   │   ═══════════ ranh giới: rời trình duyệt, đi qua mạng (hoặc localhost) ═══════════
   ▼
server/src/server.js nhận request, thấy đường dẫn bắt đầu "/api/auth"
   │  → chuyển cho server/src/routes/auth.routes.js xử lý
   ▼
auth.routes.js chạy middleware kiểm tra trước (security.js: chưa bị khóa do sai nhiều lần?)
   │
   ▼
auth.routes.js gửi câu SQL tới MySQL qua server/src/config/db.js:
      SELECT ... FROM HOC_VIEN WHERE Email = ?
   │
   │   ═══════════ ranh giới: rời Node.js, vào MySQL ═══════════
   ▼
MySQL tìm trong bảng HOC_VIEN, trả lại dòng dữ liệu khớp (hoặc rỗng)
   │
   ▼
auth.routes.js nhận lại dữ liệu, so sánh mật khẩu (bcrypt), tạo JWT token
   │
   ▼
server.js trả về response dạng JSON:  { "token": "...", "user": {...} }
   │
   │   ═══════════ quay lại trình duyệt ═══════════
   ▼
web/js/api.js nhận JSON, trả lại cho app.js
   │
   ▼
web/js/app.js lưu token, vẽ lại giao diện (giờ hiện tên người dùng, menu đã đăng nhập)
```

Toàn bộ quá trình trên — từ lúc bấm nút tới lúc giao diện đổi — thường chỉ mất vài chục mili-giây.

---

## 6. Ví dụ thực tế #1: "Chuyện gì xảy ra khi học viên Đăng nhập?"

Theo đúng từng bước, kèm TÊN FILE thật tại mỗi bước:

1. **`web/index.html`** đã hiện sẵn form đăng nhập (do `app.js` vẽ ra khi bấm nút "Đăng nhập" ở góc trên).
2. Người dùng gõ email + mật khẩu, bấm nút submit → **`web/js/app.js`** bắt sự kiện `onsubmit`, đọc giá trị trong ô nhập, gọi `API.login(email, matKhau)`.
3. **`web/js/api.js`** gửi 1 HTTP request kiểu `POST` tới `http://localhost:3000/api/auth/login`, kèm theo `{ email, matKhau }` dạng JSON trong phần thân (body) của request.
4. **`server/src/server.js`** đang lắng nghe ở cổng 3000, nhận được request này. Nó thấy đường dẫn bắt đầu bằng `/api/auth` nên chuyển toàn bộ cho **`server/src/routes/auth.routes.js`** xử lý.
5. Trước khi vào hàm xử lý thật, request phải đi qua **`server/src/middleware/security.js`**: kiểm tra IP này có đang bị tạm khóa vì đăng nhập sai quá nhiều lần không. Nếu bị khóa → trả lỗi ngay, dừng tại đây, các bước sau không chạy.
6. Không bị khóa → vào hàm `router.post('/login', ...)` trong `auth.routes.js`. Hàm này gửi 1 câu SQL tới MySQL (qua **`server/src/config/db.js`**) để tìm tài khoản có email vừa nhập, trong cả 3 bảng `HOC_VIEN`, `GIANG_VIEN`, `ADMIN` (dùng `UNION ALL`, xem thêm ở `sql/05_code_sql_giaithich.md` mục 2).
7. MySQL trả lại dòng dữ liệu đó (nếu có), bao gồm `MatKhauHash` — mật khẩu ĐÃ BĂM, không phải mật khẩu gốc.
8. `auth.routes.js` dùng **`server/src/utils/password.js`** để so sánh mật khẩu người dùng vừa gõ với `MatKhauHash` lấy từ DB. Khớp thì tiếp tục, không khớp thì trả lỗi "Email hoặc mật khẩu không đúng" (đồng thời ghi nhận 1 lần sai, dùng cho bước 5 ở lần đăng nhập sau).
9. Khớp → tạo 1 **JWT token** (dùng thư viện `jsonwebtoken`, với khóa bí mật đọc từ **`server/src/config/env.js`**) — token này mang theo thông tin "tôi là HV001, vai trò student".
10. `auth.routes.js` trả về JSON: `{ "token": "...", "user": { "ten": "...", "role": "student" } }`.
11. **`web/js/api.js`** nhận JSON này, trả lại cho **`web/js/app.js`**.
12. `app.js` lưu token vào bộ nhớ trình duyệt (`localStorage`) — để lần sau không cần đăng nhập lại — rồi vẽ lại giao diện: ẩn nút "Đăng nhập", hiện tên người dùng.
13. **Từ giờ về sau**, MỌI request khác `app.js` gửi đi (xem khóa học, thanh toán...) đều kèm theo token này trong header `Authorization` — đó là cách server biết "ai đang gọi", không cần gửi lại email/mật khẩu mỗi lần.

---

## 7. Ví dụ thực tế #2: "Chuyện gì xảy ra khi học viên bấm Thanh toán?"

Ví dụ này phức tạp hơn 1 chút, cho thấy những khái niệm quan trọng: **transaction** và **khóa dòng dữ liệu**.

1. Học viên đang ở trang khóa học, bấm "Thanh toán", chọn "Chuyển khoản" → **`web/js/app.js`** mở 1 hộp thoại (modal), gọi **`web/js/api.js`** để lấy mã QR chuyển khoản (`API.studentPayQr`).
2. Xem xong QR, học viên bấm "Gửi yêu cầu thanh toán" → `app.js` gọi `API.studentPay(maDK, "Chuyển khoản")`.
3. `api.js` gửi `POST /api/student/payments` kèm token (để server biết đây đúng là chủ của lượt đăng ký đó, không phải ai khác giả mạo).
4. **`server/src/server.js`** chuyển cho **`server/src/routes/student.routes.js`**.
5. Request đi qua **`server/src/middleware/auth.js`** trước: giải mã token, xác nhận đúng là học viên đã đăng nhập, tài khoản chưa bị khóa. Sai token hoặc hết hạn → chặn ngay tại đây.
6. Vào hàm xử lý thật. Vì thao tác này cần "đọc rồi mới quyết định ghi" (đọc xem đã có giao dịch thành công/đang chờ chưa, rồi mới ghi giao dịch mới), code mở **1 transaction** (qua **`server/src/utils/tx.js`**) và **khóa dòng dữ liệu đó lại** (`FOR UPDATE`) — để nếu học viên lỡ bấm 2 lần liên tiếp, lần thứ 2 phải ĐỢI lần thứ 1 xử lý xong mới được đọc, tránh tạo ra 2 giao dịch trùng nhau.
7. Trong transaction đó, code lần lượt: kiểm tra lượt đăng ký có hợp lệ không, có đang chờ duyệt sẵn rồi không (nếu có thì báo lỗi, không cho gửi trùng), rồi **ghi 1 dòng mới vào bảng `THANH_TOAN`** với trạng thái `pending` (đang chờ).
8. Mọi bước trên OK → **commit transaction** (lưu thật sự xuống MySQL). Nếu bất kỳ bước nào lỗi giữa chừng → **rollback** (huỷ hết, coi như chưa có gì xảy ra) — đây là lý do dùng transaction: không bao giờ để dữ liệu "nửa vời" (ví dụ ghi được giao dịch nhưng lại quên cập nhật trạng thái đăng ký).
9. `student.routes.js` trả JSON `{ "MaTT": "TT123", "trangThai": "pending" }` về cho frontend.
10. `app.js` nhận kết quả, hiện thông báo "Đã gửi yêu cầu — chờ admin xác nhận", đóng hộp thoại, vẽ lại trang để hiện đúng trạng thái "đang chờ duyệt".
11. **Sau đó, ở 1 phiên làm việc khác:** admin vào trang quản trị, bấm "Duyệt" cho giao dịch này → lại 1 chu trình tương tự từ bước 1-9, nhưng lần này gọi `routes/admin.routes.js`, đổi trạng thái giao dịch từ `pending` thành `success` — và từ lúc này, **`server/src/utils/access.js`** (hàm kiểm tra quyền xem khóa học) sẽ trả về "đã có quyền", học viên mới xem được video bài giảng.

---

## 8. Bảng tra nhanh — file nào nên sửa khi muốn làm gì

| Muốn làm gì | Sửa file nào |
|---|---|
| Đổi màu sắc, bố cục, hiệu ứng | `web/css/style.css` |
| Thêm/sửa 1 màn hình, 1 nút bấm | `web/js/app.js` |
| Thêm 1 cách gọi API mới từ frontend | `web/js/api.js` |
| Thêm logic xử lý mới ở backend (ví dụ 1 tính năng mới) | tạo/sửa file trong `server/src/routes/` |
| Đổi quy tắc "ai được xem gì" | `server/src/utils/access.js` |
| Đổi cấu trúc bảng dữ liệu | `sql/01_schema.sql` (rồi phải nạp lại DB) |
| Đổi mật khẩu DB, khóa bí mật | `server/.env` (không phải file code) |

---

## 9. Tóm tắt 1 câu cho mỗi tầng

- **`web/`** = những gì người dùng NHÌN THẤY và BẤM VÀO, chạy trong trình duyệt của họ.
- **`server/`** = "bộ não" xử lý mọi logic, kiểm tra quyền, nói chuyện với database — chạy trên máy chủ, người dùng không bao giờ thấy code này.
- **`sql/`** = bản thiết kế + dữ liệu của MySQL — nơi mọi thứ được LƯU TRỮ THẬT, tồn tại lâu dài kể cả khi tắt server.

Ba tầng nói chuyện với nhau bằng 2 "ngôn ngữ" khác nhau: **frontend ↔ backend** nói chuyện bằng HTTP request/response chứa JSON; **backend ↔ database** nói chuyện bằng câu lệnh SQL.
