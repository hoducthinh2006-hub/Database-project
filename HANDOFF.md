# BÀN GIAO PHIÊN: Dự án N9 (BTL môn Cơ sở dữ liệu)

## 1. Tổng quan dự án
- **N9** là web quản lý khóa học trực tuyến. Đây là bài tập lớn môn CSDL của nhóm Trà / Lộc / Thịnh, người dùng là Sơn Trà (sinh viên CNTT, nói tiếng Việt).
- **Thư mục gốc:** `/mnt/E/CODE/BTL_CSDL` (cũng truy cập được qua `/home/sontra/Tai_Lieu/CODE/BTL_CSDL`, vì `Tai_Lieu` là symlink tới `/mnt/E`). Gồm `web/` (frontend), `server/` (backend), `sql/`, `baocao/`.
- **Stack:**
  - Frontend: HTML/CSS/JS thuần, không framework.
  - Backend: Node + Express (`npm start` = `node src/server.js`, cổng mặc định 3000).
  - CSDL: MySQL 8.4, tên DB thật là `btl_csdl_khoahoc`.
  - Cấu hình trong `server/.env`: `PORT`, `DB_*`, `JWT_SECRET`.
- **Phân quyền:** JWT + bcrypt, 3 vai trò `student`, `teacher`, `admin`. Middleware trong `server/src/middleware/auth.js`: `auth`, `optionalAuth`, `teacherOnly`, `studentOnly`, `adminOnly`.
- **Tài khoản demo:** mật khẩu của mọi tài khoản là `123456`.
  - Admin: `admin@n9.vn`
  - Giảng viên: `khoa.tran@email.com` (GV001), ngoài ra có `thu.le@email.com`, `que.pham@email.com`
  - Học viên: `an.nguyen@email.com` (HV001), ngoài ra có `ngoc.vu@email.com`, `anh.hoang@email.com`
  - Giảng viên do admin cấp, không đăng ký công khai. Học viên tự đăng ký.

## 2. Quy tắc làm việc với user (đọc kỹ)
- **Phân công BTL:** Claude xây app. Nhóm tự viết các câu SQL của đề bài (`sql/04_queries.sql`). Giảng viên chỉ chấm phần SQL.
- **"Guide not auto":** với lệnh phá hủy hoặc đụng DB thật, chỉ đưa lệnh cho user tự chạy, không tự chạy. Đừng tự `DROP`, reload hay sửa DB thật `btl_csdl_khoahoc`.
- **"Kill only own PIDs":**
  - Tuyệt đối không dùng `pkill` hay `kill $(pgrep -x msedge)` theo tên tiến trình.
  - Trong phiên này tôi lỡ tắt Edge thật của user bằng cách đó, và đã báo lỗi cho họ.
  - Khi test: chạy trình duyệt headless với `--user-data-dir` riêng trong scratchpad và `--remote-debugging-port` riêng.
  - Chỉ kill đúng PID mình tạo, hoặc tìm server theo cổng (`ss -ltnp | grep :3099`) rồi kiểm tra `/proc/PID/environ` trước khi kill.
- **Quy trình test:**
  - Không test trên DB thật. Clone sang `btl_csdl_sbx` bằng mysqldump, chạy server cổng 3099 với `DB_NAME=btl_csdl_sbx`.
  - Test bằng curl và Edge headless qua CDP.
  - Xong thì dọn: kill đúng server/profile, drop DB sandbox, xóa file tạm.
- **Văn phong:** user dùng tiếng Việt thân mật. Trả lời bằng tiếng Việt, ngắn gọn.

## 3. Việc đã làm trong phiên này (theo thứ tự)

1. **Nạp lại DB với schema mới.**
   - Lỗi gặp: `Table 'GIANG_VIEN' already exists`, nên bảng ADMIN không được tạo.
   - Cách xử lý: `DROP DATABASE IF EXISTS btl_csdl_khoahoc`, rồi nạp lại `01_schema.sql`, `02_seed_data.sql`, `03_views.sql`. User đã chạy và tôi đã kiểm tra lại.

2. **Sửa lệch ngày −1 trên toàn app.**
   - Nguyên nhân: mysql2 trả `Date`, `res.json()` đổi sang UTC nên lệch ngày ở múi giờ +7.
   - Cách sửa: thêm `dateStrings: true` trong `server/src/config/db.js`.

3. **Trang "Hồ sơ của tôi" (học viên và giảng viên).**
   - Trang cũ quá trống, nay có họ tên, ngày sinh, email, vai trò, số điện thoại, thống kê và cho chỉnh sửa.
   - Backend: `GET /api/auth/me` và `PUT /api/auth/me` trong `auth.routes.js`.
   - Học viên sửa được SĐT, ngày sinh. Giảng viên sửa được SĐT, ngày sinh, chuyên môn, trình độ. Admin bị 400 khi PUT. Họ tên và email không cho sửa.

4. **Giao diện admin giống mẫu "EduFlow" trong `~/Downloads`.** Phạm vi user chọn: làm cả hai (duyệt bảng thô và chạy báo cáo) và đổi giao diện sang sidebar.
   - Thêm 7 endpoint đọc dữ liệu thô, chỉ đọc, trong `admin.routes.js`: `/lessons`, `/enrollments`, `/quizzes`, `/results`, `/payments`, `/certificates`, `/reviews` (join lấy tên, LIMIT 500 với bảng lớn).
   - Viết lại `reports.routes.js`: `router.use(auth, adminOnly)`, 15 endpoint GET dùng đúng SQL đã chốt trong `sql/04_queries.sql`.
     - Tham số mặc định: `nam=2026`, `thang=8`, `tuNgay=2026-08-01`, `denNgay=2026-09-30`.
   - Frontend: `REPORTS` (có trường `doiTuong`), `REPORT_AUDIENCE`, `ADMIN_SECTIONS`, `viewAdmin` dạng sidebar.
   - Yêu cầu cuối của user về báo cáo:
     - Không ghi nhãn "15 truy vấn báo cáo".
     - Chia theo đối tượng admin / giảng viên / học viên.
     - Không ghi tên người phụ trách.
     - Mỗi truy vấn là một mục riêng trên sidebar.
     - Bấm vào là tự chạy, không có nút "Chạy".
     - Có chọn khoảng thời gian.

5. **Đổi tiêu đề hero** thành "Đừng ngủ khi đối thủ còn đang thức".

6. **Giao diện học viên chi tiết hơn** (user yêu cầu: "Khóa học của tôi", bảng xếp hạng, và những gì lấy được từ truy vấn).
   - Route mới `server/src/routes/student.routes.js` (`router.use(auth, studentOnly)`, mount ở `/api/student`):
     - `GET /overview`: khóa học (dùng các view `V_TIEN_DO`, `V_DIEM_TB`, `V_LAN_DANG_KY`), hạng của mình bằng `RANK() OVER`, bài tiếp theo, KPI và feed hoạt động.
     - `GET /leaderboard?maKH=` và `GET /leaderboard/global`.
     - `GET /results`.
     - `GET /payments` và `POST /payments` (thanh toán giả lập; 409 nếu đã trả, 400 nếu khóa miễn phí hoặc đã hủy).
     - `POST /reviews` (1–5 sao, upsert vì `DANH_GIA.MaDK` UNIQUE).
     - `POST /lessons/:maBH/complete` (idempotent, ghi `LICH_SU_HOC_TAP`, gọi `syncEnrollment`).
   - File mới `server/src/utils/enrollment.js` với `syncEnrollment(pool, maDK)`:
     - Điều kiện hoàn thành: học hết bài + làm hết quiz đang hoạt động + điểm TB tốt nhất ≥ 7 (hoặc khóa không có quiz).
     - Khi đạt thì chuyển sang `hoan_thanh` và tự cấp `CHUNG_CHI`.
     - Hoạt động đầu tiên chuyển `cho_xac_nhan` / `da_xac_nhan` sang `dang_hoc`.
   - `quizzes.routes.js`: gọi `syncEnrollment`, response nộp bài có thêm `trangThaiDangKy` và `capChungChi`.
   - `courses.routes.js`: `/:id/enrollment` bỏ `da_huy`, trả thêm mảng `daHoc`.
   - `web/js/api.js` thêm các hàm gọi API tương ứng (kể cả `report(id, params)`).
   - Frontend `viewLearn` có các tab: tổng quan, khóa học của tôi, bảng xếp hạng (podium + danh sách), kết quả, chứng chỉ, thanh toán. Còn có thẻ "Tiếp tục học", mục tiêu, timeline, biểu đồ điểm, gợi ý khóa, modal thanh toán và đánh giá, thanh tiến độ bài học, hiệu ứng chúc mừng khi nhận chứng chỉ.

7. **Hệ thống animation mượt** (CSS và `app.js`):
   - Keyframes và class: `.anim-in`, `.anim-row`, `.anim-fade`, `.rv` (reveal khi cuộn bằng IntersectionObserver). Fill-mode dùng `backwards`, không dùng `both`, để khỏi khóa transform.
   - Count-up số, thanh tiến độ tự chạy, tilt thẻ `.ccard`, ripple nút, skeleton loading, thanh `#topbar` loading, modal có animation đóng, confetti.
   - View Transitions API khi đổi theme và accent.
   - Tôn trọng `prefers-reduced-motion`.

8. **Nền thiên hà** cho chế độ tối (`web/js/galaxy.js`, canvas `#galaxy`):
   - Token tối đổi sang xanh-đen sâu: `--bg:#03040A; --surface:#0B1020; --ink:#E8EEFF`, cùng các token khác. Khi bật galaxy, bề mặt thành kính mờ (`html.galaxy-on:root`, backdrop-filter).
   - Thành phần: 3 lớp sao, tinh vân render sẵn rồi xoay và nhấp nháy, dải ngân hà, sao băng, vignette. Throttle ~30 fps, tạm dừng khi tab ẩn.
   - Lần đầu quá chậm, user phàn nàn "đứng im". Đã chỉnh `ROT=0.016`, tâm xoay chạy quanh quỹ đạo, tinh vân xoay riêng; đo được ≈8.6 px/s.
   - Nếu OS bật "giảm chuyển động" thì nền đứng yên. Đã thêm công tắc "🌠 Cho phép nền chuyển động" (chỉ hiện khi OS bật reduced-motion).
   - Có công tắc "🌌 Nền thiên hà" trong popup tông màu. localStorage dùng `n9-galaxy` và `n9-galaxy-motion`. API toàn cục: `window.N9Galaxy`.
   - Muốn nền nhanh hơn thì tăng `ROT` trong `galaxy.js` (0.03 là khá nhanh).

## 4. Sự cố và cách đã xử lý
| Sự cố | Cách xử lý |
|---|---|
| Edit báo "File has not been read yet" sau khi sửa file bằng Bash | Read lại file rồi Edit |
| Hai `@keyframes bob` trùng tên, animation vương miện đè animation badge hero | Đổi thành `crownBob` |
| Tràn ngang trên mobile ở tab tổng quan | `.dash-grid > *{min-width:0}` và `minmax(0,1fr)` trong media query |
| Thanh tab hiện scrollbar dọc 1px | `.tabs{scrollbar-width:none}` và ẩn `::-webkit-scrollbar` |
| Bảng xếp hạng mặc định chọn khóa trống | Ưu tiên khóa đầu tiên có điểm |
| **Tôi lỡ tắt Edge thật của user** bằng `kill $(pgrep -x msedge)` | Đã báo user (Ctrl+Shift+T để khôi phục tab), lưu memory "Kill only own PIDs"; các lần dọn sau chỉ kill theo cổng 3099 hoặc `--user-data-dir` riêng |

Lúc cuối phiên, CLI hiện thông báo "Bug report drafted: 1 review / 2 send / 0 dismiss". Đó là bản nháp báo lỗi về sự cố tắt Edge. Nó chưa gửi đi, user tự chọn. Không cần làm gì với nó.

## 5. Trạng thái hiện tại
- Mọi thay đổi chỉ ở code: **không đổi schema**, nên chỉ cần restart server rồi Ctrl+F5 là thấy.
- DB thật `btl_csdl_khoahoc` chưa bị đụng. Lần kiểm tra cuối có 5 bản ghi `DANG_KY` và 1 `CHUNG_CHI`.
- Mọi endpoint mới và UI đã test trên sandbox (curl, ảnh chụp sáng/tối/mobile, bắt lỗi JS: không có lỗi). Sandbox đã dọn sạch.
- Không có việc nào đang dở. User gõ "1" mà không rõ ý, tôi hỏi lại và chưa có trả lời.

## 6. Bản đồ file chính
- `web/index.html`: khung trang (sidebar + thanh trên), sprite biểu tượng, popup tông màu / thiên hà, nạp `api.js`, `galaxy.js`, `app.js`.
- `web/js/app.js` (~2000 dòng): toàn bộ view và logic, là một IIFE.
  - Điều hướng: `render(mode)`, `go` / `goCore` (có logic `sameView`).
  - Cache: `TEACH`, `ADMIN`, `STU`, `PROFILE`.
  - Các view: `viewAdmin`, `viewLearn`, hồ sơ.
- `web/js/api.js`: wrapper fetch tới API.
- `web/js/galaxy.js`: nền thiên hà (có `hold(key,on)` để tạm dừng khi đang mở hộp thoại / chuyển cảnh sáng-tối).
- `web/js/motion.js`: hệ chuyển động (mục 9) — `window.N9Motion`, `app.js` gọi qua biến `MO` (không nạp được thì app vẫn chạy).
- `web/css/style.css`: token thiết kế "Violet Glass" (xem mục 8), khung app, thành phần, dashboard, hệ animation, galaxy.
- `server/src/routes/`: `auth`, `courses`, `quizzes`, `admin`, `reports`, `student`, `teacher`…
- `server/src/utils/enrollment.js`: quy tắc hoàn thành khóa và cấp chứng chỉ.
- `server/src/utils/ranking.js`: quy tắc xếp hạng + điểm đánh giá có trọng số (một chỗ duy nhất); `server/src/routes/honors.routes.js`: API Vinh danh.
- `sql/`: `01_schema.sql`, `02_seed_data.sql`, `03_views.sql`, `04_queries.sql` (+ `04_queries_giaithich.md`), **`05_seed_demo.sql`** (dữ liệu demo phong phú, mục 10) và `05b_dich_ngay_ve_hom_nay.sql` (tuỳ chọn: dời mốc ngày về hôm nay).
- `baocao/Khung_BaoCao_BTL_CSDL.docx`: khung báo cáo.

## 7. Backend + bảo mật (20/10/2026) — đã xử lý hết danh sách lỗi của đợt kiểm tra code
Chỉ đổi code, **không đổi schema DB**. Hình dạng API cũ giữ nguyên (chỉ thêm trường). `sql/04_queries.sql` và `reports.routes.js` là SQL của nhóm nên không viết lại (chỉ kiểm tra tham số).

| Lỗi cũ | Cách xử lý |
|---|---|
| Video + khóa nháp lộ công khai | `GET /courses/:id`: khóa nháp/lưu trữ → 404 trừ chủ khóa + admin. Link video chỉ gửi cho admin / chủ khóa / học viên **đã đăng ký và (khóa miễn phí hoặc đã thanh toán)**; người khác nhận `VideoBaiGiang = null`, `coVideo`, và `quyen:{xem, lyDo, maDK}`. Trang chi tiết hiện khung khóa + nút đúng việc cần làm (đăng nhập / đăng ký / thanh toán). Quy tắc nằm ở một chỗ: `utils/access.js` |
| Không có đổi/quên mật khẩu | `POST /auth/change-password` (hỏi mật khẩu cũ, trả token mới, thu hồi mọi token cũ). Quên mật khẩu = admin bấm "Cấp lại MK" ở bảng Giảng viên/Học viên → mật khẩu tạm hiện một lần (`POST /admin/{teachers,students}/:id/reset-password`). Hồ sơ có panel "Bảo mật" |
| Token 7 ngày, khóa tài khoản không hiệu lực ngay | Token 24h (`JWT_EXPIRES`), chứa "dấu vân tay" mật khẩu (`pv`): đổi/cấp lại mật khẩu → token cũ chết. Mỗi yêu cầu tra DB (cache 5 giây, xóa cache khi admin đổi trạng thái) → khóa tài khoản có hiệu lực ngay. Frontend tự đăng xuất + báo lý do (`API.onSessionLost`) và kiểm tra phiên đã lưu lúc khởi động |
| Không giới hạn thử mật khẩu / spam | Đăng nhập sai ≥ 5 lần (theo IP+email) → khóa 15 phút (429 `LOGIN_LOCKED`); trần theo IP; đăng ký 15 lần/giờ/IP; API chung 300 yêu cầu/phút/IP; đổi mật khẩu sai 5 lần cũng bị khóa. Mật khẩu mới ≥ 8 ký tự, có chữ + số (tài khoản demo `123456` vẫn **đăng nhập** được) |
| Lộ `e.message` MySQL | `utils/http.js` (`fail`): lỗi MySQL → mã + câu tiếng Việt thân thiện (trùng, khóa ngoại, quá dài…), lỗi lạ → "Lỗi máy chủ" (chi tiết chỉ ghi log) |
| Chứng chỉ quá dễ | "Đánh dấu đã học" phải **mở bài** trước và học tối thiểu `LESSON_MIN_SECONDS` giây (nút có đếm ngược). Quiz: GET cấp `startToken` (JWT) → máy chủ tự tính giờ, từ chối nộp quá giờ/quá nhanh/dùng lại token, giãn cách giữa 2 lượt (`QUIZ_COOLDOWN_SECONDS`); **đáp án chỉ lộ khi đạt ≥ 7 hoặc hết lượt** |
| `nextCode` trùng, `syncEnrollment` không transaction | `utils/id.js` (`insertWithCode` tự thử lại khi trùng khóa), `utils/tx.js` (`withTx`), `syncEnrollment` trong transaction có `FOR UPDATE`; đăng ký/thanh toán/đánh giá cũng trong transaction |
| CORS mở, thiếu header bảo mật | CORS chỉ origin cho phép (`CORS_ORIGINS`; dev tự cho Live Server `:5500`); CSP (`script-src 'self'` — script inline đã chuyển ra `web/js/boot.js`), nosniff, X-Frame DENY, Referrer/Permissions-Policy, HSTS khi HTTPS, API `no-store` |
| Cấu hình yếu | `config/env.js`: **server từ chối khởi động nếu `JWT_SECRET` thiếu/< 24 ký tự/là chuỗi mẫu**; DB online xác minh chứng chỉ qua `DB_SSL_CA`; `multipleStatements=false` |
| `npm audit` | `npm audit --omit=dev` = 0 lỗ hổng |

Biến môi trường mới (đều có mặc định an toàn, xem `server/.env.example`): `JWT_SECRET` (**bắt buộc**), `JWT_EXPIRES`, `NODE_ENV`, `TRUST_PROXY`, `CORS_ORIGINS`, `LOGIN_MAX_FAILS`, `LOGIN_LOCK_MIN`, `RATE_LIMIT_API_PER_MIN`, `REGISTER_PER_HOUR`, `LESSON_MIN_SECONDS`, `QUIZ_COOLDOWN_SECONDS`, `QUIZ_MIN_SECONDS_PER_QUESTION`, `QUIZ_GRACE_SECONDS`, `BCRYPT_COST`, `DB_SSL_CA`.

Lưu ý khi chạy/deploy:
- Sau lần cập nhật này **token cũ không dùng được** → mọi người đăng nhập lại một lần (giao diện tự đưa về form đăng nhập).
- Deploy sau proxy (Railway/Render…): đặt `NODE_ENV=production` và `TRUST_PROXY=1` (nếu không, giới hạn tần suất sẽ coi mọi người là cùng một IP). DB online có TLS: `DB_SSL=true` + `DB_SSL_CA`.
- Demo trên lớp thấy nút "Đánh dấu đã học xong" đếm ngược vài chục giây và bài kiểm tra có giãn cách giữa 2 lượt là **cố ý**; muốn nhanh khi demo: `LESSON_MIN_SECONDS=3`, `QUIZ_COOLDOWN_SECONDS=2` (hoặc `0` để tắt).
- Đã test trên sandbox (clone DB): 177 kiểm thử API + 51 kiểm thử giao diện (Edge headless) + giới hạn tần suất — đều đạt; sandbox đã dọn.

Còn lại: điền dữ liệu vào báo cáo `.docx`. Chưa làm (ngoài phạm vi): quên mật khẩu qua email (cần dịch vụ gửi mail), 2FA, đăng nhập bằng cookie HttpOnly (hiện token nằm trong localStorage, được bảo vệ bằng CSP chặn script lạ).

## 8. Giao diện "Violet Glass" (20/10/2026) — đã xong
- Theo ảnh mẫu (kính mờ tím trên nền tối): khung app = **sidebar trái** + **thanh trên** (tìm kiếm Ctrl/⌘+K, chuông "việc cần làm", tông màu, sáng/tối, avatar) + nội dung; trang chủ có **cột phải** (Nổi bật, Xếp hạng đánh giá, Hoạt động, CTA). Điện thoại: sidebar thành ngăn kéo (☰).
- Sidebar theo vai trò: khách / học viên (+ mục "Đang học") / giảng viên (+ "Khóa học của tôi") / admin (nhóm gập được, thay cho sidebar lồng cũ). Mục "Xếp hạng đánh giá" = danh mục sắp theo đánh giá (`catState.sort`).
- `web/css/style.css` viết lại hoàn toàn: token màu ở đầu file (dark mặc định, `[data-theme=light]`, tông `[data-accent=ocean|rose|emerald|sunset|ruby]`), phần còn lại chỉ dùng biến. Biểu tượng = sprite `<symbol id="i-…">` trong `index.html`, gọi bằng `ico("tên")` trong `app.js`.
- `app.js`: khối "KHUNG ỨNG DỤNG" (`renderNav` → `renderSidebar` + `renderTopbar` + `wireNav`, `initSearch`, `initShell`); `iconize()` tự đổi emoji còn sót sang SVG; `wrapTables()` cho bảng cuộn ngang. Thanh tải mỏng đổi id `#topbar` → `#loadbar` (vì `.topbar` giờ là thanh trên).
- Sửa kèm: ô tìm không còn vẽ lại mỗi phím (gõ Telex không bị ngắt) + tìm không dấu; giảng viên đăng nhập thấy ngay khóa nháp; xóa cache khi đổi tài khoản (`resetCaches`); ngưỡng "Đạt" của bài kiểm tra = 7 (khớp quy tắc chứng chỉ).
- `galaxy.js`: thêm hằng `NEB` (độ đậm tinh vân, 0.5) để các tấm kính nổi hơn.
- Bản gốc trước khi đổi: thư mục `_backup_web_20261020/` (xóa được khi không cần).
- Đã test: sandbox (clone DB + cổng 3099) + Edge headless; ảnh tối/sáng ở 1440 / 1024 / 820 / 390 px; không tràn ngang, không lỗi JS; sandbox đã dọn.

## 9. Hệ chuyển động "motion v2" (20/10/2026) — đã xong
Yêu cầu của user: "hiệu ứng càng mượt càng tốt, có animation các thứ vào". Gồm `web/js/motion.js` (mới) + mục "16b" cuối `style.css` + vài hook trong `app.js`.

| Hiệu ứng | Cách làm |
|---|---|
| Mở đầu khi tải trang | `boot.js` đặt `html.booting` (sidebar/thanh trên ẩn); `MO.intro()` sau lần vẽ đầu: sidebar trượt vào, logo xoay, mục menu hiện so le, thanh trên trượt xuống. CSS tự mở lại sau 1.8s nếu script hỏng |
| Chuyển trang | trang cũ mờ + trôi lên (160ms) **trong lúc nạp dữ liệu**; khung chờ (skeleton) chỉ hiện nếu nạp > 300ms; mỗi lần điều hướng có số thứ tự (`navSeq`) nên bấm liên tiếp thì chỉ lần mới nhất được vẽ |
| Viên chọn trượt | sidebar (`#sbInd`) và tab/segment (`.pill-ind`) trượt giữa các mục. Sidebar cập nhật **tại chỗ** (`morphInto`) nên không phá node, giữ hover + animation |
| Thẻ → chi tiết | ảnh bìa "bay" từ thẻ sang khung đăng ký (`morphFrom/morphTo`, ghost `position:fixed`) |
| Đổi sáng/tối, tông màu | loang tròn từ nút vừa bấm (View Transitions + `clip-path`) |
| Hero trang chủ | chữ hiện từng từ (blur → nét), "Đừng ngủ" gradient chuyển động, viền cực quang quanh ô tìm (`@property --ang`), gợi ý tự gõ chữ bằng tên khóa học thật |
| Theo con trỏ (chỉ khi dùng chuột) | ánh sáng trên thẻ kính (`--mx/--my`), quầng sáng `#aurora` đi theo chuột (có quán tính), nút lớn "hút" nhẹ, thẻ khóa học nghiêng 3D (cũ) |
| Khác | nút chính có vệt sáng quét, hộp thoại lò xo + ô nhập hiện so le, toast trượt + thanh đếm giờ, menu nổi mở từ góc neo, biểu đồ đường vẽ nét, thanh tiến độ làm bài, ổ khóa nhấp nhô, mũi tên nhích khi rê vào nút |

An toàn / hiệu năng:
- Chỉ animate `transform`/`opacity` (riêng ảnh bay đổi `left/top/width/height` của đúng 1 phần tử `fixed`). Bản xoay 3D khi thẻ vào trang đã bỏ vì làm trình duyệt dựng bằng CPU giật.
- **"Giảm chuyển động" của hệ điều hành** → không hiệu ứng nào chạy (CSS tắt hết + `motion.js` không tạo animation / quầng sáng / loang).
- **Chế độ nhẹ** `html.fx-lite`: tự bật khi máy dựng hình bằng CPU (máy ảo, không GPU, SwiftShader/llvmpipe), RAM ≤ 2GB hoặc ≤ 2 nhân. Bỏ làm mờ nền hộp thoại, loang tròn, quầng sáng, chữ mờ dần; giữ trượt/mờ cơ bản. Người dùng đổi tay bằng công tắc **"Hiệu ứng nâng cao"** trong bảng tông màu (nhớ ở `localStorage n9-fx`).
- Nền thiên hà tạm dừng khi hộp thoại mở / đang loang sáng-tối (nằm sau lớp mờ, không ai thấy).
- Đã đo (headless Edge, dựng hình bằng CPU nên là mức tệ nhất): chuyển trang, mở chi tiết, cuộn, rê chuột đều 60fps như bản cũ; chế độ nhẹ còn mượt hơn bản cũ ở hộp thoại và đổi sáng/tối. Test: `uiflows` 51/51, khói motion 16/16, giảm chuyển động + không có `motion.js` + công tắc 20/20, không tràn ngang ở 390/1440px sáng/tối.
- Muốn xem đủ hiệu ứng khi kiểm thử bằng Edge headless: `localStorage.setItem('n9-fx','full')` rồi tải lại.

## 10. Xếp hạng · Vinh danh · dữ liệu demo (20/10/2026) — đã xong
**Xếp hạng (cuộc đua, một chỉ số, có ngưỡng)** — `utils/ranking.js`, dùng chung cho bảng khóa, bảng vàng, "hạng của tôi" (`/student/overview`):
- Điểm của một bài = điểm **cao nhất** trong các lần làm. Có **ngưỡng tối thiểu** mới có hạng (chống "1 bài 10 điểm đứng trên 20 bài 9 điểm"): trong khóa ≥ 2 bài kiểm tra (khóa chỉ có 1 bài thì 1); toàn nền tảng ≥ 3 bài (mọi lúc) / 2 (30 ngày) / 1 (7 ngày). Chưa đủ ngưỡng → hiện "Cần thêm N bài", không có hạng.
- Hòa điểm: theo khóa → tiến độ cao hơn → làm nhiều bài hơn → **ít lượt làm lại hơn**; toàn nền tảng → nhiều chứng chỉ hơn → nhiều bài hơn. Bằng hết thì **đồng hạng** (1, 1, 3…).
- Toàn nền tảng có 2 bảng × 3 khoảng thời gian: **Điểm cao** / **Chăm chỉ** (số bài học hoàn thành) × 7 ngày / 30 ngày / mọi lúc (`?tieuChi=&khoang=`). Học viên bị khóa không xuất hiện.
- **Xếp hạng khóa học** (trang chủ, danh mục "sắp theo đánh giá", mục "Nổi bật") dùng điểm đánh giá **có trọng số** `(v·R + 5·C)/(v + 5)` — khóa chỉ có 1–2 lượt 5 sao không còn đứng đầu. `GET /courses` có thêm `SoDanhGia`; thẻ khóa hiện "(số lượt)".

**Vinh danh (ghi nhận, không phải cuộc đua)** — trang `Vinh danh` (sidebar mọi vai trò) + thẻ ở cột phải trang chủ, API `GET /api/honors` (khách xem được phần giảng viên/khóa học; phần có tên học viên cần đăng nhập). Tính trực tiếp từ dữ liệu, **không thêm bảng**:
- Học viên: Thủ khoa tháng · Chăm chỉ nhất tháng · Chuỗi ngày học liên tục (≥ 3 ngày) · Điểm 10 tuyệt đối · Nhà sưu tầm chứng chỉ · Hoàn thành xuất sắc (TB ≥ 9).
- Giảng viên: Được yêu thích (điểm có trọng số, ≥ 3 đánh giá) · Lớp đông nhất · Truyền cảm hứng (nhiều chứng chỉ đã cấp).
- Khóa học: Đánh giá cao (≥ 3 đánh giá) · Nhiều người học nhất · Tỷ lệ hoàn thành cao nhất (≥ 5 lượt).
- Mỗi thẻ ghi rõ tiêu chí; người bị khóa không được vinh danh; kết quả được cache 30 giây.

**Dữ liệu demo `sql/05_seed_demo.sql`** (chỉ INSERT, một transaction, không đổi schema, mã trùng/email trùng → hoàn tác hết): +5 giảng viên, +35 học viên, +15 khóa học (kèm KH003 có 4 bài), 71 bài học, 26 bài kiểm tra, ~130 lượt đăng ký, ~380 lượt học, ~180 lượt làm bài, 97 giao dịch, 42 chứng chỉ, 49 đánh giá; có đủ tình huống (chờ thanh toán, đã hủy, thanh toán lỗi, khóa nháp/lưu trữ, giảng viên + học viên bị khóa, chuỗi ngày học, nhiều điểm 10, khóa 1–2 đánh giá…). Mật khẩu mọi tài khoản 123456. **Email demo không được trùng giữa học viên/giảng viên/admin** (đăng nhập tra cả 3 bảng, học viên được ưu tiên) — file đã kiểm tra bằng truy vấn cuối file. Mốc "hôm nay" của dữ liệu là 20/10/2026; sau vài ngày các bảng 7/30 ngày và chuỗi ngày sẽ trống, chạy `05b_dich_ngay_ve_hom_nay.sql` để kéo mọi mốc thời gian về hôm nay (an toàn, chạy lại được).
- Nạp vào DB thật (bạn tự chạy): `mysql -u root -p btl_csdl_khoahoc < sql/05_seed_demo.sql`. Xóa dữ liệu demo: dựng lại DB từ `01` → `03` (+ `02`) hoặc xóa theo mã `GV004+`, `HV004+`, `KH004+`… (đừng xóa lẻ từng bảng vì khóa ngoại).
- Test (sandbox, không nằm trong dự án): 44 kiểm thử quy tắc xếp hạng/vinh danh + 177 kiểm thử API + 26 kiểm thử giao diện mới + 51 luồng chính + hiệu ứng — đều đạt.

