# N9 — Nền tảng học trực tuyến

Bài tập lớn môn Cơ sở dữ liệu. Web quản lý khóa học trực tuyến: đăng ký học, học bài, làm bài kiểm tra, thanh toán, bảng xếp hạng, trang quản trị — xây bằng Node.js + Express + MySQL, giao diện HTML/CSS/JS thuần (không framework).

Muốn hiểu kiến trúc chi tiết (file nào làm gì, nối nhau ra sao) → đọc [`KIEN_TRUC_HE_THONG.md`](KIEN_TRUC_HE_THONG.md). Muốn hiểu các kỹ thuật SQL dùng trong code → đọc [`sql/05_code_sql_giaithich.md`](sql/05_code_sql_giaithich.md). Giải thích 15 câu truy vấn báo cáo → [`sql/04_queries_giaithich.md`](sql/04_queries_giaithich.md).

## Yêu cầu

- [Node.js](https://nodejs.org) 18 trở lên
- [MySQL](https://dev.mysql.com/downloads/mysql/) 8.0 trở lên (dự án dùng MySQL 8.4)

## Cài đặt

**1. Tải code về và cài thư viện**

```bash
git clone <đường-dẫn-repo-này>
cd BTL_CSDL/server
npm install
```

**2. Tạo cơ sở dữ liệu**

Đăng nhập MySQL rồi chạy lần lượt (thứ tự quan trọng):

```bash
mysql -u root -p < ../sql/01_schema.sql
mysql -u root -p < ../sql/02_seed_data.sql
mysql -u root -p < ../sql/03_views.sql
```

Muốn có nhiều dữ liệu mẫu hơn để demo (nhiều học viên, khóa học, giao dịch...), chạy thêm:

```bash
mysql -u root -p btl_csdl_khoahoc < ../sql/05_seed_demo.sql
```

**3. Cấu hình**

```bash
cp .env.example .env
```

Mở `.env`, điền:
- `DB_PASSWORD` — mật khẩu MySQL của bạn (nếu có)
- `JWT_SECRET` — chuỗi ngẫu nhiên dài ≥ 24 ký tự, tạo bằng:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```

Các biến còn lại trong `.env.example` đều có giá trị mặc định an toàn, không bắt buộc điền (xem chú thích trong file để biết thêm, ví dụ `BANK_*` để hiện mã QR chuyển khoản thật nếu muốn).

**4. Chạy**

```bash
npm start
```

Mở trình duyệt vào **http://localhost:3000** — web và API chạy chung 1 server, không cần mở thêm gì khác (không dùng Live Server hay mở thẳng file `index.html`).

## Tài khoản demo

Mật khẩu của mọi tài khoản demo là `123456`.

| Vai trò | Email |
|---|---|
| Admin | `admin@n9.vn` |
| Giảng viên | `khoa.tran@email.com` |
| Học viên | `an.nguyen@email.com` |

## Cấu trúc thư mục

```
web/      giao diện (HTML/CSS/JS thuần, không framework)
server/   backend Node.js + Express
sql/      schema, dữ liệu mẫu, view, 15 câu truy vấn báo cáo
baocao/   báo cáo đồ án (Word)
```

## Phát triển (dev mode)

```bash
cd server
npm run dev   # tự khởi động lại server mỗi khi lưu file
```

Sửa file trong `web/` thì chỉ cần Ctrl+F5 trên trình duyệt, không cần restart server. Sửa file trong `server/` thì mới cần restart (hoặc dùng `npm run dev` ở trên).
