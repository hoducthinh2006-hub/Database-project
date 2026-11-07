-- =====================================================================
-- (TUỲ CHỌN) THÊM NỘI DUNG CHO 9 KHÓA HỌC: 38 bài học mới (có giáo trình + bài thực hành) và
-- 11 bài kiểm tra mới (mỗi bài 4 câu trắc nghiệm, thời gian 12 phút).
--   Khóa: Python cơ bản, SQL, Figma, JavaScript, React, Node.js, Power BI, MySQL nâng cao, CSDL & ER.
--
-- THỨ TỰ NẠP:  01 → 02 → 03 → 05 → 06 → 07 → 08 (file này).  Chạy SAU 05 và 06 để bao trùm cả các lượt đăng ký của chúng.
-- CHỈ CHẠY MỘT LẦN (chèn bằng mã cố định BH072+, BKT027+ nên chạy lần hai sẽ báo trùng khóa chính;
-- muốn chạy lại thì nạp lại CSDL từ đầu).
--
-- GIỮ DỮ LIỆU NHẤT QUÁN: thêm bài học làm tổng số bài của khóa tăng, nên các lượt đăng ký ĐÃ HOÀN THÀNH ở 9 khóa
-- này được ghi thêm "đã học xong" các bài mới và điểm cho các bài kiểm tra mới (7.5 hoặc 10/10, đều đạt), để vẫn
-- là 100% và vẫn xứng đáng có chứng chỉ. Các lượt ĐANG HỌC giữ nguyên, tiến độ tự giảm vì khóa dài hơn.
-- =====================================================================
USE btl_csdl_khoahoc;
SET NAMES utf8mb4;

START TRANSACTION;

-- Thứ tự bài tiếp theo của từng khóa (tính lúc chạy, không phụ thuộc có nạp 05 hay chưa)
SET @t_KH001 = (SELECT COALESCE(MAX(ThuTu), 0) FROM BAI_HOC WHERE MaKH = 'KH001');
SET @t_KH002 = (SELECT COALESCE(MAX(ThuTu), 0) FROM BAI_HOC WHERE MaKH = 'KH002');
SET @t_KH003 = (SELECT COALESCE(MAX(ThuTu), 0) FROM BAI_HOC WHERE MaKH = 'KH003');
SET @t_KH004 = (SELECT COALESCE(MAX(ThuTu), 0) FROM BAI_HOC WHERE MaKH = 'KH004');
SET @t_KH006 = (SELECT COALESCE(MAX(ThuTu), 0) FROM BAI_HOC WHERE MaKH = 'KH006');
SET @t_KH007 = (SELECT COALESCE(MAX(ThuTu), 0) FROM BAI_HOC WHERE MaKH = 'KH007');
SET @t_KH008 = (SELECT COALESCE(MAX(ThuTu), 0) FROM BAI_HOC WHERE MaKH = 'KH008');
SET @t_KH017 = (SELECT COALESCE(MAX(ThuTu), 0) FROM BAI_HOC WHERE MaKH = 'KH017');
SET @t_KH018 = (SELECT COALESCE(MAX(ThuTu), 0) FROM BAI_HOC WHERE MaKH = 'KH018');

-- 1) BÀI HỌC MỚI
INSERT INTO BAI_HOC (MaBH, MaKH, TenBH, ThuTu, ThoiLuong, GiaoTrinh, ThucHanh, VideoBaiGiang) VALUES
('BH072', 'KH001', N'Hàm trong Python', @t_KH001 + 1, 35, N'HÀM TRONG PYTHON

1. Định nghĩa hàm
  def chao(ten):
      return "Xin chào " + ten
Hàm gom một đoạn lệnh để dùng lại nhiều lần. Từ khóa def khai báo hàm, return trả kết quả về.

2. Tham số
- Tham số bắt buộc: def tong(a, b)
- Tham số có giá trị mặc định: def tinh(a, he_so=2)

3. Gọi hàm
  print(chao("An"))
Nên đặt tên hàm theo động từ và mỗi hàm chỉ làm một việc.', N'Viết hàm la_so_chan(n) trả về True nếu n là số chẵn.
Viết hàm tinh_trung_binh(a, b, c) trả về trung bình cộng ba số.
Gọi cả hai hàm và in kết quả ra màn hình.', NULL),
('BH073', 'KH001', N'Danh sách (list) và tuple', @t_KH001 + 2, 30, N'DANH SÁCH VÀ TUPLE

1. List: tập hợp có thứ tự, sửa được
  ds = [5, 3, 8]
  ds.append(10)      # thêm cuối
  ds.remove(3)       # xóa phần tử có giá trị 3
  print(ds[0])       # phần tử đầu tiên (chỉ số bắt đầu từ 0)

2. Duyệt và cắt lát
  for x in ds: print(x)
  ds[1:3]            # lấy phần tử vị trí 1 đến 2

3. Tuple: giống list nhưng không sửa được
  toa_do = (10, 20)', N'Cho ds = [4, 9, 2, 7]. Tìm số lớn nhất và nhỏ nhất mà không dùng max() và min().
Sắp xếp ds tăng dần bằng phương thức sort() rồi in ra.', NULL),
('BH074', 'KH001', N'Từ điển (dict) và tập hợp (set)', @t_KH001 + 3, 30, N'TỪ ĐIỂN VÀ TẬP HỢP

1. Dict lưu cặp khóa - giá trị
  sv = {"ten": "An", "tuoi": 20}
  print(sv["ten"])
  sv["lop"] = "CNTT1"
  for k, v in sv.items(): print(k, v)

2. Set là tập hợp không trùng lặp
  s = {1, 2, 2, 3}     # chỉ còn 1, 2, 3
  s.add(4)
Set hữu ích để loại bỏ phần tử trùng.', N'Đếm số lần xuất hiện của từng ký tự trong một chuỗi bằng dict.
Cho một list có phần tử trùng, dùng set để lấy danh sách không trùng.', NULL),
('BH075', 'KH001', N'Xử lý chuỗi', @t_KH001 + 4, 25, N'XỬ LÝ CHUỖI

Một số phương thức hay dùng:
- upper(), lower(): đổi chữ hoa, chữ thường
- strip(): bỏ khoảng trắng hai đầu
- split(","): tách chuỗi thành list
- replace("a", "b"): thay thế
- f-string: f"Xin chào {ten}"

Ví dụ:
  s = "  Python  "
  print(s.strip().upper())   # PYTHON', N'Nhập họ tên, chuẩn hóa: bỏ khoảng trắng thừa, viết hoa chữ cái đầu mỗi từ (dùng title()).
Đếm số từ trong một câu bằng split().', NULL),
('BH076', 'KH001', N'Đọc và ghi file', @t_KH001 + 5, 35, N'ĐỌC VÀ GHI FILE

1. Mở file bằng with (tự đóng file khi xong)
  with open("ds.txt", "w", encoding="utf-8") as f:
      f.write("An")
      f.write(" - CNTT1")

2. Đọc file
  with open("ds.txt", encoding="utf-8") as f:
      for dong in f:
          print(dong.strip())

Các chế độ: "r" đọc, "w" ghi đè, "a" ghi nối thêm.', N'Ghi 5 tên học viên vào file ten.txt, mỗi tên một dòng.
Đọc lại file và in số dòng cùng nội dung.', NULL),
('BH077', 'KH002', N'GROUP BY và hàm gộp', @t_KH002 + 1, 35, N'GROUP BY VÀ HÀM GỘP

Hàm gộp tính một giá trị từ nhiều dòng: COUNT, SUM, AVG, MIN, MAX.

1. Gộp toàn bảng
  SELECT COUNT(*) FROM DANG_KY;

2. Gộp theo nhóm
  SELECT MaKH, COUNT(*) AS SoLuot
  FROM DANG_KY
  GROUP BY MaKH;

Quy tắc: mọi cột trong SELECT mà không nằm trong hàm gộp phải có mặt trong GROUP BY.', N'1. Đếm số lượt đăng ký của từng khóa học.
2. Tính tổng học phí đã thu theo từng tháng.
3. Tìm điểm cao nhất của từng bài kiểm tra.', NULL),
('BH078', 'KH002', N'HAVING: lọc sau khi gộp', @t_KH002 + 2, 25, N'HAVING LỌC KẾT QUẢ SAU KHI GỘP

WHERE lọc từng dòng TRƯỚC khi gộp. HAVING lọc nhóm SAU khi gộp.

  SELECT MaGV, COUNT(*) AS SoKhoa
  FROM KHOA_HOC
  GROUP BY MaGV
  HAVING COUNT(*) >= 2;

Thứ tự thực thi: FROM, WHERE, GROUP BY, HAVING, SELECT, ORDER BY.
Không dùng được hàm gộp trong WHERE, phải dùng HAVING.', N'Liệt kê các khóa học có từ 5 lượt đăng ký trở lên.
Liệt kê học viên có điểm trung bình trên 8.', NULL),
('BH079', 'KH002', N'Truy vấn con (subquery)', @t_KH002 + 3, 35, N'TRUY VẤN CON

Truy vấn con là câu SELECT nằm trong một câu SELECT khác.

1. Trong WHERE
  SELECT TenKH FROM KHOA_HOC
  WHERE HocPhi > (SELECT AVG(HocPhi) FROM KHOA_HOC);

2. Với IN / NOT IN
  SELECT HoTen FROM HOC_VIEN
  WHERE MaHV NOT IN (SELECT MaHV FROM DANG_KY);

3. Với EXISTS: kiểm tra có tồn tại dòng thỏa điều kiện hay không.', N'Tìm khóa học có học phí thấp hơn học phí trung bình.
Tìm học viên đã đăng ký ít nhất một khóa có học phí trên 500000.', NULL),
('BH080', 'KH002', N'CASE WHEN: phân loại dữ liệu', @t_KH002 + 4, 30, N'CASE WHEN

CASE giúp tạo cột mới theo điều kiện, giống if-else.

  SELECT TenKH,
         CASE WHEN HocPhi = 0 THEN "Miễn phí"
              WHEN HocPhi < 500000 THEN "Giá thấp"
              ELSE "Giá cao" END AS NhomGia
  FROM KHOA_HOC;

Dùng với hàm gộp để đếm có điều kiện:
  SUM(CASE WHEN TTDangKy = "hoan_thanh" THEN 1 ELSE 0 END)', N'Phân loại điểm: từ 8 là Giỏi, từ 6.5 là Khá, từ 5 là Đạt, còn lại là Chưa đạt.
Đếm số lượt hoàn thành và chưa hoàn thành của mỗi khóa trong một câu truy vấn.', NULL),
('BH081', 'KH002', N'Hàm ngày giờ', @t_KH002 + 5, 25, N'HÀM NGÀY GIỜ TRONG MYSQL

- CURRENT_DATE, NOW(): ngày và thời điểm hiện tại
- YEAR(d), MONTH(d), DAY(d): lấy thành phần
- DATE_ADD(d, INTERVAL 30 DAY): cộng thêm 30 ngày
- DATEDIFF(d1, d2): số ngày giữa hai ngày
- DATE_FORMAT(d, "%Y-%m"): định dạng ngày

Ví dụ: thống kê theo tháng
  SELECT DATE_FORMAT(NgayDangKy, "%Y-%m") AS Thang, COUNT(*)
  FROM DANG_KY GROUP BY Thang;', N'Đếm số lượt đăng ký theo từng tháng trong năm 2026.
Tìm các lượt đăng ký đã quá 90 ngày kể từ ngày đăng ký.', NULL),
('BH082', 'KH003', N'Màu sắc và Typography', @t_KH003 + 1, 30, N'MÀU SẮC VÀ TYPOGRAPHY

1. Màu sắc
- Màu chính (primary): màu nhận diện, dùng cho nút và điểm nhấn.
- Màu phụ (secondary) và màu trung tính (xám, trắng, đen).
- Màu trạng thái: xanh thành công, đỏ lỗi, vàng cảnh báo.
Kiểm tra độ tương phản chữ và nền để dễ đọc.

2. Typography
- Chọn 1 đến 2 họ phông chữ cho cả sản phẩm.
- Thiết lập thang cỡ chữ: tiêu đề lớn, tiêu đề nhỏ, nội dung, chú thích.', N'Chọn một bảng 5 màu cho ứng dụng đặt lịch học. Tạo Color Style trong Figma.
Tạo Text Style cho 4 cấp: H1, H2, Body, Caption.', NULL),
('BH083', 'KH003', N'Thiết kế Design System', @t_KH003 + 2, 40, N'DESIGN SYSTEM

Design System là bộ quy tắc và thành phần dùng chung để giao diện nhất quán.

1. Style: màu, chữ, hiệu ứng đổ bóng.
2. Component: nút, ô nhập, thẻ, thanh điều hướng.
3. Variant: một component có nhiều biến thể (kích thước, trạng thái).
4. Đặt tên rõ ràng, ví dụ: Button/Primary/Large.

Lợi ích: sửa một component thì mọi nơi dùng nó tự cập nhật.', N'Tạo component Button có 3 variant: Primary, Secondary, Disabled.
Dùng Button vừa tạo vào hai màn hình khác nhau và thử đổi màu chính.', NULL),
('BH084', 'KH003', N'Lưới bố cục và responsive', @t_KH003 + 3, 35, N'LƯỚI BỐ CỤC VÀ RESPONSIVE

1. Layout Grid
- Desktop: 12 cột, khoảng cách 24px.
- Tablet: 8 cột. Mobile: 4 cột.

2. Khoảng cách theo bội số của 8 (8, 16, 24, 32) để bố cục đều.

3. Constraints và Auto layout giúp phần tử co giãn khi đổi kích thước khung.

4. Thiết kế mobile first: bắt đầu từ màn hình nhỏ rồi mở rộng.', N'Thiết kế trang chủ một khóa học trên 3 kích thước: mobile, tablet, desktop.
Dùng Layout Grid và Auto layout để các khối tự co giãn.', NULL),
('BH085', 'KH003', N'Case study: ứng dụng học tập trên mobile', @t_KH003 + 4, 45, N'CASE STUDY ỨNG DỤNG HỌC TẬP

Quy trình thiết kế một ứng dụng hoàn chỉnh:
1. Xác định người dùng và mục tiêu.
2. Vẽ luồng người dùng (user flow): đăng nhập, chọn khóa, học bài, làm kiểm tra.
3. Phác thảo wireframe nhanh.
4. Dựng giao diện chi tiết bằng Design System đã có.
5. Tạo prototype, thử nghiệm với 3 đến 5 người dùng và ghi lại phản hồi.', N'Thiết kế 5 màn hình: đăng nhập, danh sách khóa, chi tiết khóa, màn hình học, kết quả.
Nối prototype và nhờ một bạn dùng thử, ghi lại 3 điểm cần cải thiện.', NULL),
('BH086', 'KH004', N'Hàm mũi tên và phạm vi biến', @t_KH004 + 1, 30, N'HÀM MŨI TÊN VÀ SCOPE

1. Hàm mũi tên
  const binhPhuong = (x) => x * x;
Ngắn gọn hơn hàm thường, không tạo this riêng.

2. Phạm vi biến
- var: phạm vi hàm (nên tránh)
- let: phạm vi khối, gán lại được
- const: phạm vi khối, không gán lại

3. Closure: hàm nhớ được biến ở nơi nó được tạo.', N'Viết hàm mũi tên tinhTong(a, b) và hàm kiemTraChan(n).
Viết hàm taoBoDem() trả về một hàm tăng biến đếm mỗi lần gọi (closure).', NULL),
('BH087', 'KH004', N'Mảng: map, filter, reduce', @t_KH004 + 2, 40, N'XỬ LÝ MẢNG VỚI MAP, FILTER, REDUCE

  const so = [1, 2, 3, 4, 5];
  so.map(x => x * 2);            // [2, 4, 6, 8, 10]
  so.filter(x => x % 2 === 0);   // [2, 4]
  so.reduce((t, x) => t + x, 0); // 15

- map: biến đổi từng phần tử, trả mảng mới
- filter: giữ phần tử thỏa điều kiện
- reduce: gộp mảng thành một giá trị
Các hàm này không làm thay đổi mảng gốc.', N'Cho mảng điểm [6, 9, 4, 8, 10]. Dùng filter lấy điểm đạt (từ 5), map đổi sang thang 4, reduce tính điểm trung bình.', NULL),
('BH088', 'KH004', N'Promise và async/await', @t_KH004 + 3, 40, N'BẤT ĐỒNG BỘ TRONG JAVASCRIPT

Tác vụ chờ (gọi mạng, đọc file) không được chặn chương trình.

1. Promise có 3 trạng thái: pending, fulfilled, rejected.
  fetch(url).then(res => res.json()).catch(err => console.log(err));

2. async/await viết gọn hơn
  async function lay() {
      try {
          const res = await fetch(url);
          return await res.json();
      } catch (e) { console.log(e); }
  }', N'Viết hàm async doiGiayRoiIn(giay) dùng setTimeout bọc trong Promise.
Gọi liên tiếp 3 lần và in thứ tự kết quả.', NULL),
('BH089', 'KH004', N'Gọi API với fetch', @t_KH004 + 4, 35, N'GỌI API VỚI FETCH

1. GET: lấy dữ liệu
  const res = await fetch("/api/courses");
  const ds = await res.json();

2. POST: gửi dữ liệu
  await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, matKhau })
  });

3. Luôn kiểm tra res.ok và xử lý lỗi mạng bằng try/catch.', N'Gọi một API công khai bất kỳ, hiển thị 5 kết quả đầu lên trang HTML.
Thêm thông báo Đang tải và thông báo lỗi khi gọi thất bại.', NULL),
('BH090', 'KH006', N'Props và truyền dữ liệu', @t_KH006 + 1, 30, N'PROPS TRONG REACT

Props là dữ liệu cha truyền cho component con, chỉ đọc.

  function TheKhoaHoc({ ten, hocPhi }) {
    return <div><h3>{ten}</h3><p>{hocPhi} đ</p></div>;
  }
  <TheKhoaHoc ten="Python" hocPhi={499000} />

- Không sửa props trong component con.
- children: nội dung đặt giữa thẻ mở và thẻ đóng.
- Danh sách cần thuộc tính key duy nhất cho mỗi phần tử.', N'Tạo component TheKhoaHoc và hiển thị danh sách 5 khóa học từ một mảng dữ liệu bằng map.', NULL),
('BH091', 'KH006', N'useEffect và gọi API', @t_KH006 + 2, 40, N'HOOK USEEFFECT

useEffect chạy tác vụ phụ sau khi render: gọi API, đặt timer, lắng nghe sự kiện.

  useEffect(() => {
    fetch("/api/courses").then(r => r.json()).then(setDs);
  }, []);

- Mảng phụ thuộc rỗng []: chỉ chạy một lần khi component xuất hiện.
- Có biến trong mảng: chạy lại khi biến đó đổi.
- Trả về một hàm để dọn dẹp khi component bị gỡ.', N'Hiển thị danh sách khóa học từ API, có trạng thái loading và error.
Thêm ô tìm kiếm lọc danh sách theo tên.', NULL),
('BH092', 'KH006', N'Điều hướng với React Router', @t_KH006 + 3, 35, N'REACT ROUTER

  <BrowserRouter>
    <Routes>
      <Route path="/" element={<TrangChu />} />
      <Route path="/khoa-hoc/:id" element={<ChiTiet />} />
    </Routes>
  </BrowserRouter>

- Link thay cho thẻ a để không tải lại trang.
- useParams lấy tham số trên đường dẫn.
- useNavigate chuyển trang bằng code.
- Route bảo vệ: kiểm tra đăng nhập rồi mới hiển thị.', N'Dựng 3 trang: Trang chủ, Danh sách khóa, Chi tiết khóa (lấy id từ đường dẫn).', NULL),
('BH093', 'KH006', N'Quản lý state với Context', @t_KH006 + 4, 40, N'CONTEXT

Context truyền dữ liệu qua nhiều tầng component mà không cần truyền props từng cấp.

  const AuthContext = createContext(null);
  function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    return <AuthContext.Provider value={{ user, setUser }}>{children}</AuthContext.Provider>;
  }
  const { user } = useContext(AuthContext);

Dùng cho dữ liệu toàn cục: người dùng đăng nhập, giao diện sáng tối.', N'Tạo AuthContext lưu thông tin người dùng, hiển thị tên ở thanh trên cùng và nút Đăng xuất.', NULL),
('BH094', 'KH007', N'Middleware trong Express', @t_KH007 + 1, 30, N'MIDDLEWARE

Middleware là hàm xử lý yêu cầu trước khi tới route.

  app.use((req, res, next) => {
    console.log(req.method, req.url);
    next();
  });

- Phải gọi next() để chuyển tiếp, hoặc trả phản hồi để kết thúc.
- Thứ tự khai báo quyết định thứ tự chạy.
- Dùng cho: ghi log, đọc JSON (express.json()), xác thực, giới hạn tần suất.', N'Viết middleware ghi log thời gian xử lý từng yêu cầu.
Viết middleware chặn yêu cầu không có header Authorization.', NULL),
('BH095', 'KH007', N'Xác thực bằng JWT', @t_KH007 + 2, 40, N'XÁC THỰC JWT

1. Đăng nhập thành công: server ký token chứa mã người dùng và vai trò.
  jwt.sign({ id, role }, SECRET, { expiresIn: "24h" })

2. Client gửi kèm mỗi yêu cầu: Authorization: Bearer <token>.

3. Server kiểm tra:
  jwt.verify(token, SECRET)
Token sai chữ ký hoặc hết hạn sẽ bị từ chối.

Lưu ý: nội dung token chỉ được mã hóa base64, không được giấu, nên không đưa mật khẩu vào token.', N'Làm hai API: POST /login trả token, GET /me chỉ cho phép khi có token hợp lệ.', NULL),
('BH096', 'KH007', N'Kết nối MySQL từ Node', @t_KH007 + 3, 35, N'KẾT NỐI MYSQL

  const pool = mysql.createPool({
    host: "localhost", user: "root", database: "btl_csdl_khoahoc",
    waitForConnections: true, connectionLimit: 10
  });
  const [rows] = await pool.query("SELECT * FROM KHOA_HOC WHERE MaKH = ?", [maKH]);

- Dùng connection pool để tái sử dụng kết nối.
- Luôn truyền tham số bằng dấu ? thay vì ghép chuỗi, để chống SQL Injection.', N'Viết API GET /courses/:id trả thông tin một khóa học, trả 404 nếu không có.', NULL),
('BH097', 'KH007', N'Xử lý lỗi và kiểm tra dữ liệu', @t_KH007 + 4, 30, N'XỬ LÝ LỖI

1. Bọc route async bằng try/catch, trả mã HTTP đúng:
- 400: dữ liệu sai
- 401: chưa đăng nhập
- 403: không đủ quyền
- 404: không tìm thấy
- 500: lỗi hệ thống

2. Không trả nguyên thông báo lỗi của CSDL cho client, chỉ ghi log ở server.
3. Kiểm tra dữ liệu đầu vào (kiểu, độ dài, định dạng) trước khi chạm CSDL.', N'Thêm kiểm tra cho API đăng ký: email hợp lệ, mật khẩu từ 8 ký tự, trả lỗi 400 kèm thông báo rõ ràng.', NULL),
('BH098', 'KH008', N'Làm sạch dữ liệu với Power Query', @t_KH008 + 1, 35, N'POWER QUERY

Power Query làm sạch và biến đổi dữ liệu trước khi đưa vào mô hình.

Các thao tác thường gặp:
- Loại bỏ dòng trống và trùng lặp
- Đổi kiểu dữ liệu (văn bản, số, ngày)
- Tách cột, gộp cột
- Điền giá trị thiếu (Fill Down)
- Unpivot: chuyển cột thành dòng
Mỗi bước được ghi lại, có thể chạy lại khi dữ liệu cập nhật.', N'Nhập file doanh số có dòng trống và định dạng ngày sai, làm sạch và đưa vào mô hình.', NULL),
('BH099', 'KH008', N'Mô hình dữ liệu và quan hệ', @t_KH008 + 2, 35, N'MÔ HÌNH DỮ LIỆU

Mô hình hình sao: một bảng sự kiện (Fact) ở giữa nối với các bảng chiều (Dimension).
- Fact: Doanh số (ngày, mã sản phẩm, số lượng, tiền)
- Dimension: Sản phẩm, Khách hàng, Ngày

Quan hệ một-nhiều từ Dimension sang Fact, chiều lọc đi từ Dimension xuống Fact.
Tạo bảng Ngày riêng để phân tích theo thời gian.', N'Dựng mô hình hình sao cho dữ liệu bán hàng gồm 1 bảng sự kiện và 3 bảng chiều.', NULL),
('BH100', 'KH008', N'Hàm DAX: CALCULATE và FILTER', @t_KH008 + 3, 40, N'DAX CƠ BẢN

- Measure (thước đo) tính theo ngữ cảnh lọc của biểu đồ.
  Tong Doanh So = SUM(Fact[ThanhTien])

- CALCULATE thay đổi ngữ cảnh lọc:
  DS Mien Bac = CALCULATE([Tong Doanh So], KhuVuc[Vung] = "Miền Bắc")

- Tỷ lệ: DIVIDE(tử, mẫu) an toàn khi mẫu bằng 0.
- Cùng kỳ năm trước: SAMEPERIODLASTYEAR.', N'Tạo 3 measure: Tổng doanh số, Doanh số cùng kỳ năm trước, Tỷ lệ tăng trưởng.', NULL),
('BH101', 'KH008', N'Thiết kế dashboard', @t_KH008 + 4, 35, N'THIẾT KẾ DASHBOARD

1. Bắt đầu từ câu hỏi người xem cần trả lời.
2. Đặt thẻ KPI quan trọng ở góc trên bên trái.
3. Chọn đúng biểu đồ: đường cho xu hướng, cột cho so sánh, tròn chỉ khi ít hơn 5 phần.
4. Dùng ít màu, nhất quán, tránh trang trí thừa.
5. Thêm bộ lọc (slicer) theo thời gian và khu vực.', N'Dựng dashboard một trang gồm 3 thẻ KPI, 1 biểu đồ đường theo tháng, 1 biểu đồ cột theo khu vực và slicer thời gian.', NULL),
('BH102', 'KH017', N'Chỉ mục kép và thứ tự cột', @t_KH017 + 1, 40, N'CHỈ MỤC KÉP

  CREATE INDEX idx_dk ON DANG_KY (MaKH, NgayDangKy);

Quy tắc cột trái nhất: chỉ mục (a, b, c) dùng được cho điều kiện lọc theo a, hoặc a và b, hoặc a, b và c. Lọc chỉ theo b thì không dùng được.

- Đặt cột lọc bằng (=) trước, cột khoảng (BETWEEN, >) sau.
- Chỉ mục phủ (covering index): chứa đủ cột câu truy vấn cần, không phải đọc bảng.
- Mỗi chỉ mục làm chậm INSERT và UPDATE, không tạo thừa.', N'Tạo chỉ mục phù hợp cho truy vấn đếm lượt đăng ký của một khóa trong một tháng và so sánh thời gian trước và sau.', NULL),
('BH103', 'KH017', N'EXPLAIN đọc kế hoạch thực thi', @t_KH017 + 2, 40, N'EXPLAIN

  EXPLAIN SELECT * FROM DANG_KY WHERE MaKH = "KH001";

Các cột quan trọng:
- type: cách truy cập. Tốt: const, eq_ref, ref. Xấu: ALL (quét toàn bảng).
- key: chỉ mục thực tế được dùng.
- rows: số dòng ước tính phải đọc.
- Extra: Using index (tốt), Using filesort hoặc Using temporary (cần xem lại).', N'Chạy EXPLAIN cho ba câu truy vấn bất kỳ, chỉ ra câu nào quét toàn bảng và cách khắc phục.', NULL),
('BH104', 'KH017', N'Tối ưu JOIN và subquery', @t_KH017 + 3, 35, N'TỐI ƯU TRUY VẤN

- Có chỉ mục trên cột nối ở bảng được nối vào.
- Chỉ SELECT cột cần, tránh SELECT *.
- Lọc sớm bằng WHERE để giảm số dòng cần nối.
- Thay subquery tương quan nặng bằng JOIN hoặc bảng tạm khi cần.
- Không bọc cột trong hàm ở WHERE (YEAR(cot) = 2026), hãy viết cột >= ... AND cột < ... để dùng được chỉ mục.', N'Viết lại câu truy vấn đếm đăng ký theo tháng dùng khoảng ngày thay cho YEAR và MONTH, so sánh bằng EXPLAIN.', NULL),
('BH105', 'KH017', N'Transaction và mức cô lập', @t_KH017 + 4, 40, N'TRANSACTION

Tính chất ACID: Atomicity, Consistency, Isolation, Durability.

  START TRANSACTION;
  UPDATE ... ;
  INSERT ... ;
  COMMIT;   -- hoặc ROLLBACK khi có lỗi

Mức cô lập: READ UNCOMMITTED, READ COMMITTED, REPEATABLE READ (mặc định của MySQL), SERIALIZABLE.
SELECT ... FOR UPDATE khóa dòng để tránh hai người cùng sửa một dữ liệu. Giao dịch quá lâu gây khóa chờ và deadlock.', N'Mô phỏng hai phiên Workbench cùng sửa một dòng, quan sát khóa chờ và cách COMMIT giải phóng.', NULL),
('BH106', 'KH018', N'Phân tích yêu cầu và xác định thực thể', @t_KH018 + 1, 35, N'XÁC ĐỊNH THỰC THỂ

Từ mô tả bài toán, tìm các danh từ chính chính là ứng viên thực thể.
Ví dụ: Học viên đăng ký khóa học do giảng viên phụ trách và có thể làm bài kiểm tra.
Thực thể: Học viên, Khóa học, Giảng viên, Bài kiểm tra.

Với mỗi thực thể xác định:
- Thuộc tính (cột)
- Khóa chính (định danh duy nhất)
Động từ trong mô tả gợi ý các mối quan hệ.', N'Đọc mô tả hệ thống thư viện và liệt kê thực thể, thuộc tính, khóa chính.', NULL),
('BH107', 'KH018', N'Quan hệ 1-1, 1-N, N-N', @t_KH018 + 2, 35, N'CÁC LOẠI QUAN HỆ

- 1-1: một đối tượng ứng với đúng một đối tượng khác (đăng ký và chứng chỉ).
- 1-N: một bên có nhiều bên kia (giảng viên và khóa học).
- N-N: hai bên đều có nhiều (học viên và khóa học).

Quan hệ N-N không biểu diễn trực tiếp được trong bảng, phải tách thành bảng trung gian (ví dụ ĐĂNG KÝ) chứa hai khóa ngoại.
Bảng trung gian có thể có thêm thuộc tính riêng như ngày đăng ký, học phí.', N'Vẽ ER cho hệ thống bán hàng gồm Khách hàng, Đơn hàng, Sản phẩm, xác định quan hệ và bảng trung gian.', NULL),
('BH108', 'KH018', N'Chuyển ER sang lược đồ quan hệ', @t_KH018 + 3, 40, N'QUY TẮC CHUYỂN ĐỔI

1. Mỗi thực thể thành một bảng, thuộc tính thành cột, định danh thành khóa chính.
2. Quan hệ 1-N: đặt khóa ngoại ở phía N.
3. Quan hệ 1-1: đặt khóa ngoại ở một trong hai bảng và đặt ràng buộc UNIQUE.
4. Quan hệ N-N: tạo bảng trung gian với hai khóa ngoại, khóa chính có thể là cặp hai khóa hoặc một mã riêng.
5. Thêm ràng buộc: NOT NULL, CHECK, DEFAULT, UNIQUE.', N'Chuyển sơ đồ ER bài trước thành các câu lệnh CREATE TABLE đầy đủ khóa chính và khóa ngoại.', NULL),
('BH109', 'KH018', N'Chuẩn hóa 1NF, 2NF, 3NF', @t_KH018 + 4, 40, N'CHUẨN HÓA

- 1NF: mỗi ô một giá trị đơn, không có nhóm lặp.
- 2NF: đã 1NF và mọi cột không khóa phụ thuộc vào toàn bộ khóa (quan trọng với khóa ghép).
- 3NF: đã 2NF và không có phụ thuộc bắc cầu giữa các cột không khóa.

Mục đích: tránh dư thừa và các lỗi khi thêm, sửa, xóa dữ liệu.
Đôi khi cố ý nới chuẩn (lưu dư) để tăng tốc truy vấn, nhưng phải hiểu và ghi rõ đánh đổi.', N'Cho bảng ĐƠN HÀNG(MaDH, MaKH, TenKH, DiaChiKH, MaSP, TenSP, SoLuong), chuẩn hóa đến 3NF và nêu từng bước tách.', NULL);

-- 2) BÀI KIỂM TRA MỚI (câu hỏi lưu JSON trong NoiDungBKT, dap = vị trí đáp án đúng tính từ 0)
INSERT INTO BAI_KIEM_TRA (MaBKT, MaBH, TenBKT, NoiDungBKT, ThoiGian, TrangThai, SoLanLamToiDa) VALUES
('BKT027', 'BH073', N'Kiểm tra: Hàm và danh sách', N'[
 {
  "q": "Từ khóa nào dùng để định nghĩa hàm trong Python?",
  "opt": [
   "function",
   "def",
   "fun",
   "define"
  ],
  "dap": 1
 },
 {
  "q": "Chỉ số phần tử đầu tiên của list là bao nhiêu?",
  "opt": [
   "0",
   "1",
   "-1",
   "Tùy list"
  ],
  "dap": 0
 },
 {
  "q": "Lệnh nào thêm phần tử vào cuối list?",
  "opt": [
   "add()",
   "insert_last()",
   "append()",
   "push()"
  ],
  "dap": 2
 },
 {
  "q": "Tuple khác list ở điểm nào?",
  "opt": [
   "Tuple sắp xếp được",
   "Tuple không sửa được sau khi tạo",
   "Tuple chỉ chứa số",
   "Tuple chạy nhanh gấp đôi"
  ],
  "dap": 1
 }
]', 12, 'active', 3),
('BKT028', 'BH076', N'Kiểm tra: Chuỗi và file', N'[
 {
  "q": "Phương thức nào bỏ khoảng trắng ở hai đầu chuỗi?",
  "opt": [
   "trim()",
   "strip()",
   "cut()",
   "clean()"
  ],
  "dap": 1
 },
 {
  "q": "Chế độ mở file nào ghi nối thêm vào cuối file?",
  "opt": [
   "r",
   "w",
   "a",
   "x"
  ],
  "dap": 2
 },
 {
  "q": "Kết quả của dòng: len({1, 2, 2, 3})?",
  "opt": [
   "4",
   "3",
   "2",
   "Lỗi"
  ],
  "dap": 1
 },
 {
  "q": "Cách nào đảm bảo file được đóng đúng khi xử lý xong?",
  "opt": [
   "Dùng with open(...)",
   "Dùng try mà không close",
   "Không cần làm gì",
   "Dùng del"
  ],
  "dap": 0
 }
]', 12, 'active', NULL),
('BKT029', 'BH078', N'Kiểm tra: GROUP BY và HAVING', N'[
 {
  "q": "Mệnh đề nào dùng để lọc nhóm sau khi gộp?",
  "opt": [
   "WHERE",
   "HAVING",
   "FILTER",
   "LIMIT"
  ],
  "dap": 1
 },
 {
  "q": "Hàm nào đếm số dòng?",
  "opt": [
   "SUM()",
   "TOTAL()",
   "COUNT()",
   "NUMBER()"
  ],
  "dap": 2
 },
 {
  "q": "Thứ tự thực thi đúng của câu truy vấn có WHERE và GROUP BY là?",
  "opt": [
   "GROUP BY rồi WHERE",
   "WHERE rồi GROUP BY",
   "Cùng lúc",
   "Tùy trình biên dịch"
  ],
  "dap": 1
 },
 {
  "q": "Câu nào hợp lệ?",
  "opt": [
   "SELECT MaKH, COUNT(*) FROM DANG_KY GROUP BY MaKH",
   "SELECT MaKH, COUNT(*) FROM DANG_KY",
   "SELECT COUNT(*) FROM DANG_KY WHERE COUNT(*) > 2",
   "SELECT * GROUP BY MaKH"
  ],
  "dap": 0
 }
]', 12, 'active', 2),
('BKT030', 'BH080', N'Kiểm tra: Subquery và CASE', N'[
 {
  "q": "Subquery vô hướng trả về?",
  "opt": [
   "Nhiều bảng",
   "Đúng một giá trị",
   "Một cột nhiều dòng",
   "Không gì cả"
  ],
  "dap": 1
 },
 {
  "q": "NOT IN dễ cho kết quả rỗng ngoài ý muốn khi nào?",
  "opt": [
   "Khi truy vấn con có NULL",
   "Khi bảng rỗng",
   "Khi dùng ORDER BY",
   "Không bao giờ"
  ],
  "dap": 0
 },
 {
  "q": "CASE WHEN dùng để?",
  "opt": [
   "Tạo bảng",
   "Phân loại giá trị theo điều kiện",
   "Xóa dữ liệu",
   "Tạo chỉ mục"
  ],
  "dap": 1
 },
 {
  "q": "Hàm DATEDIFF(d1, d2) trả về?",
  "opt": [
   "Số ngày giữa hai ngày",
   "Ngày lớn hơn",
   "Số tháng",
   "Chuỗi định dạng"
  ],
  "dap": 0
 }
]', 12, 'active', NULL),
('BKT031', 'BH083', N'Kiểm tra: Design System', N'[
 {
  "q": "Variant trong Figma dùng để?",
  "opt": [
   "Nhập văn bản",
   "Gom nhiều biến thể của một component",
   "Xuất file PDF",
   "Vẽ biểu đồ"
  ],
  "dap": 1
 },
 {
  "q": "Khoảng cách nên theo bội số của?",
  "opt": [
   "3",
   "5",
   "8",
   "7"
  ],
  "dap": 2
 },
 {
  "q": "Lợi ích chính của Design System?",
  "opt": [
   "Giảm dung lượng file",
   "Giao diện nhất quán và dễ bảo trì",
   "Tăng tốc độ mạng",
   "Không cần thiết kế"
  ],
  "dap": 1
 },
 {
  "q": "Layout Grid desktop thường dùng bao nhiêu cột?",
  "opt": [
   "4",
   "8",
   "12",
   "20"
  ],
  "dap": 2
 }
]', 12, 'active', 2),
('BKT032', 'BH087', N'Kiểm tra: Mảng và bất đồng bộ', N'[
 {
  "q": "Hàm nào biến đổi từng phần tử và trả về mảng mới?",
  "opt": [
   "filter",
   "map",
   "reduce",
   "find"
  ],
  "dap": 1
 },
 {
  "q": "Từ khóa nào khai báo biến không thể gán lại?",
  "opt": [
   "var",
   "let",
   "const",
   "static"
  ],
  "dap": 2
 },
 {
  "q": "await chỉ dùng được bên trong?",
  "opt": [
   "Hàm async",
   "Vòng lặp for",
   "Hàm mũi tên bất kỳ",
   "Khối if"
  ],
  "dap": 0
 },
 {
  "q": "Promise không có trạng thái nào sau đây?",
  "opt": [
   "pending",
   "fulfilled",
   "rejected",
   "paused"
  ],
  "dap": 3
 }
]', 12, 'active', 3),
('BKT033', 'BH091', N'Kiểm tra: Hook và Router', N'[
 {
  "q": "Mảng phụ thuộc rỗng trong useEffect có nghĩa là?",
  "opt": [
   "Chạy mỗi lần render",
   "Chạy một lần khi component xuất hiện",
   "Không bao giờ chạy",
   "Chạy khi props đổi"
  ],
  "dap": 1
 },
 {
  "q": "Props trong React là?",
  "opt": [
   "Dữ liệu chỉ đọc cha truyền cho con",
   "Biến toàn cục",
   "Hàm của trình duyệt",
   "Kiểu dữ liệu"
  ],
  "dap": 0
 },
 {
  "q": "Hook nào dùng để đọc Context?",
  "opt": [
   "useState",
   "useEffect",
   "useContext",
   "useRef"
  ],
  "dap": 2
 },
 {
  "q": "Component nào dùng thay thẻ a để không tải lại trang?",
  "opt": [
   "Link",
   "Anchor",
   "Href",
   "Route"
  ],
  "dap": 0
 }
]', 12, 'active', 3),
('BKT034', 'BH095', N'Kiểm tra: Express và JWT', N'[
 {
  "q": "Hàm next() trong middleware dùng để?",
  "opt": [
   "Kết thúc chương trình",
   "Chuyển sang middleware hoặc route kế tiếp",
   "Khởi động lại server",
   "Đóng kết nối"
  ],
  "dap": 1
 },
 {
  "q": "Mã HTTP khi người dùng chưa đăng nhập là?",
  "opt": [
   "200",
   "401",
   "404",
   "500"
  ],
  "dap": 1
 },
 {
  "q": "Vì sao dùng dấu ? khi truy vấn?",
  "opt": [
   "Chạy nhanh hơn gấp 10 lần",
   "Chống SQL Injection",
   "Bắt buộc của MySQL",
   "Để in log"
  ],
  "dap": 1
 },
 {
  "q": "Nên đưa mật khẩu vào nội dung JWT không?",
  "opt": [
   "Có, để tiện",
   "Không, vì nội dung token ai cũng đọc được",
   "Chỉ khi mã hóa MD5",
   "Chỉ với admin"
  ],
  "dap": 1
 }
]', 12, 'active', NULL),
('BKT035', 'BH099', N'Kiểm tra: Mô hình và DAX', N'[
 {
  "q": "Mô hình hình sao gồm?",
  "opt": [
   "Một bảng sự kiện nối các bảng chiều",
   "Hai bảng ngang hàng",
   "Một bảng duy nhất",
   "Bảng không quan hệ"
  ],
  "dap": 0
 },
 {
  "q": "Hàm nào thay đổi ngữ cảnh lọc trong DAX?",
  "opt": [
   "SUM",
   "CALCULATE",
   "COUNT",
   "RELATED"
  ],
  "dap": 1
 },
 {
  "q": "Biểu đồ nào phù hợp nhất để xem xu hướng theo thời gian?",
  "opt": [
   "Biểu đồ tròn",
   "Biểu đồ đường",
   "Bảng số",
   "Bản đồ"
  ],
  "dap": 1
 },
 {
  "q": "Hàm DIVIDE tốt hơn dấu / ở điểm nào?",
  "opt": [
   "Xử lý an toàn khi mẫu bằng 0",
   "Chạy nhanh hơn 100 lần",
   "Cho kết quả nguyên",
   "Không khác gì"
  ],
  "dap": 0
 }
]', 12, 'active', 3),
('BKT036', 'BH103', N'Kiểm tra: Tối ưu MySQL', N'[
 {
  "q": "Giá trị type nào trong EXPLAIN cho thấy quét toàn bảng?",
  "opt": [
   "ref",
   "const",
   "ALL",
   "eq_ref"
  ],
  "dap": 2
 },
 {
  "q": "Chỉ mục (a, b, c) dùng được cho điều kiện nào?",
  "opt": [
   "Chỉ lọc theo b",
   "Chỉ lọc theo c",
   "Lọc theo a",
   "Không dùng được"
  ],
  "dap": 2
 },
 {
  "q": "Chữ I trong ACID là?",
  "opt": [
   "Isolation",
   "Integrity",
   "Index",
   "Insert"
  ],
  "dap": 0
 },
 {
  "q": "Vì sao nên tránh YEAR(cot) = 2026 trong WHERE?",
  "opt": [
   "Cú pháp sai",
   "Bọc hàm làm không dùng được chỉ mục",
   "Chạy quá nhanh",
   "Trả kết quả sai"
  ],
  "dap": 1
 }
]', 12, 'active', 2),
('BKT037', 'BH109', N'Kiểm tra: Thiết kế CSDL', N'[
 {
  "q": "Quan hệ N-N được biểu diễn bằng?",
  "opt": [
   "Một cột",
   "Bảng trung gian với hai khóa ngoại",
   "Một khóa chính",
   "Một view"
  ],
  "dap": 1
 },
 {
  "q": "Dạng chuẩn nào loại bỏ phụ thuộc bắc cầu?",
  "opt": [
   "1NF",
   "2NF",
   "3NF",
   "Không có"
  ],
  "dap": 2
 },
 {
  "q": "Với quan hệ 1-N, khóa ngoại đặt ở bảng nào?",
  "opt": [
   "Phía 1",
   "Phía N",
   "Cả hai",
   "Không cần"
  ],
  "dap": 1
 },
 {
  "q": "Khóa chính có đặc điểm nào?",
  "opt": [
   "Có thể trùng",
   "Định danh duy nhất và không NULL",
   "Luôn là số",
   "Luôn là chữ"
  ],
  "dap": 1
 }
]', 12, 'active', NULL);

-- 3) Các lượt đăng ký ĐÃ HOÀN THÀNH: ghi nhận đã học xong các bài mới (học trong ngày đăng ký)
SET @ls = (SELECT COALESCE(MAX(CAST(SUBSTRING(MaLSHT, 3) AS UNSIGNED)), 0) FROM LICH_SU_HOC_TAP);
INSERT INTO LICH_SU_HOC_TAP (MaLSHT, MaDK, MaBH, ThoiDiemHoc, TienDoTangThem, TrangThaiHoanThanh)
SELECT CONCAT('LS', IF(x.n < 1000, LPAD(x.n, 3, '0'), CAST(x.n AS CHAR))), x.MaDK, x.MaBH, x.Tg, 0, 'hoan_thanh'
FROM (
  SELECT @ls + ROW_NUMBER() OVER (ORDER BY dk.MaDK, bh.ThuTu) AS n, dk.MaDK, bh.MaBH,
         TIMESTAMP(dk.NgayDangKy, '09:00:00') + INTERVAL (bh.ThuTu * 37) MINUTE AS Tg
  FROM DANG_KY dk
  JOIN BAI_HOC bh ON bh.MaKH = dk.MaKH
  WHERE dk.TTDangKy = 'hoan_thanh' AND bh.MaBH IN ('BH072', 'BH073', 'BH074', 'BH075', 'BH076', 'BH077', 'BH078', 'BH079', 'BH080', 'BH081', 'BH082', 'BH083', 'BH084', 'BH085', 'BH086', 'BH087', 'BH088', 'BH089', 'BH090', 'BH091', 'BH092', 'BH093', 'BH094', 'BH095', 'BH096', 'BH097', 'BH098', 'BH099', 'BH100', 'BH101', 'BH102', 'BH103', 'BH104', 'BH105', 'BH106', 'BH107', 'BH108', 'BH109')
) x;

-- 4) ... và điểm các bài kiểm tra mới (7.5 hoặc 10 trên 10, cả hai đều đạt)
SET @kq = (SELECT COALESCE(MAX(CAST(SUBSTRING(MaKQ, 3) AS UNSIGNED)), 0) FROM KET_QUA);
INSERT INTO KET_QUA (MaKQ, MaDK, MaBKT, LanLam, DiemSo, ThoiGianLam)
SELECT CONCAT('KQ', IF(x.n < 1000, LPAD(x.n, 3, '0'), CAST(x.n AS CHAR))), x.MaDK, x.MaBKT, 1, x.Diem, x.Tg
FROM (
  SELECT @kq + ROW_NUMBER() OVER (ORDER BY dk.MaDK, bkt.MaBKT) AS n, dk.MaDK, bkt.MaBKT,
         IF(CRC32(CONCAT(dk.MaDK, bkt.MaBKT)) % 3 = 0, 7.50, 10.00) AS Diem,
         TIMESTAMP(dk.NgayDangKy, '20:00:00') + INTERVAL (CRC32(CONCAT(bkt.MaBKT, dk.MaDK)) % 60) MINUTE AS Tg
  FROM DANG_KY dk
  JOIN BAI_HOC bh ON bh.MaKH = dk.MaKH
  JOIN BAI_KIEM_TRA bkt ON bkt.MaBH = bh.MaBH
  WHERE dk.TTDangKy = 'hoan_thanh' AND bkt.MaBKT IN ('BKT027', 'BKT028', 'BKT029', 'BKT030', 'BKT031', 'BKT032', 'BKT033', 'BKT034', 'BKT035', 'BKT036', 'BKT037')
) x;

-- 5) Chia lại phần trăm tiến độ của mỗi bài đã học xong cho các khóa này (100 / số bài, cắt bỏ phần lẻ để tổng không quá 100)
UPDATE LICH_SU_HOC_TAP ls
JOIN BAI_HOC bh ON bh.MaBH = ls.MaBH
JOIN (SELECT MaKH, COUNT(*) AS n FROM BAI_HOC GROUP BY MaKH) t ON t.MaKH = bh.MaKH
SET ls.TienDoTangThem = TRUNCATE(100 / t.n, 2)
WHERE ls.TrangThaiHoanThanh = 'hoan_thanh' AND bh.MaKH IN ('KH001', 'KH002', 'KH003', 'KH004', 'KH006', 'KH007', 'KH008', 'KH017', 'KH018');

COMMIT;

-- Kiểm tra nhanh
SELECT kh.MaKH, kh.TenKH, COUNT(DISTINCT bh.MaBH) AS SoBai, COUNT(DISTINCT bkt.MaBKT) AS SoBaiKiemTra
FROM KHOA_HOC kh
LEFT JOIN BAI_HOC bh ON bh.MaKH = kh.MaKH
LEFT JOIN BAI_KIEM_TRA bkt ON bkt.MaBH = bh.MaBH
GROUP BY kh.MaKH, kh.TenKH ORDER BY kh.MaKH;
