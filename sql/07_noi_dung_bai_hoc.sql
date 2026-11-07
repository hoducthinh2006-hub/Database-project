-- =====================================================================
-- (TUỲ CHỌN) Nội dung thật cho GIÁO TRÌNH + BÀI THỰC HÀNH của 5 bài học trong 02_seed_data.sql
-- (thay cho các dòng giữ chỗ "Giáo trình bài 1..."). Chỉ UPDATE văn bản nên chạy lúc nào cũng được,
-- chạy lại nhiều lần vẫn an toàn, không cần nạp lại CSDL.
-- =====================================================================
USE btl_csdl_khoahoc;
SET NAMES utf8mb4;

UPDATE BAI_HOC SET
GiaoTrinh = 'GIỚI THIỆU PYTHON VÀ CÀI ĐẶT MÔI TRƯỜNG

1. Python là gì?
Python là ngôn ngữ lập trình bậc cao, cú pháp ngắn gọn, dễ đọc. Python được dùng rất nhiều trong phát triển web, phân tích dữ liệu, trí tuệ nhân tạo và tự động hóa công việc.

2. Cài đặt Python
- Tải bản Python 3.x từ trang python.org.
- Khi cài, nhớ tick vào ô "Add Python to PATH" để gõ được lệnh python ở mọi nơi.
- Kiểm tra: mở terminal, gõ  python --version  và xem phiên bản hiện ra.

3. Chương trình đầu tiên
  print("Hello, World!")
Hàm print() in nội dung trong ngoặc ra màn hình. Văn bản đặt trong dấu nháy kép gọi là chuỗi (string).',
ThucHanh = 'BÀI THỰC HÀNH 1
1. Cài Python và chụp màn hình kết quả lệnh python --version.
2. Tạo file hello.py, in ra một dòng chào có tên của bạn.
3. Chạy file bằng lệnh  python hello.py  và kiểm tra kết quả.
Mở rộng: in thêm hai dòng giới thiệu lớp và mã sinh viên.'
WHERE MaBH = 'BH001';

UPDATE BAI_HOC SET
GiaoTrinh = 'BIẾN, KIỂU DỮ LIỆU VÀ TOÁN TỬ

1. Biến
Biến là tên dùng để lưu một giá trị. Python không cần khai báo kiểu, chỉ cần gán:
  tuoi = 20
  ten = "An"

2. Các kiểu dữ liệu cơ bản
- int: số nguyên (7)
- float: số thực (3.14)
- str: chuỗi ("xin chào")
- bool: đúng/sai (True, False)
Dùng type(x) để xem kiểu của biến x.

3. Toán tử
- Số học: +  -  *  /  //(chia nguyên)  %(chia dư)  **(lũy thừa)
- So sánh: ==  !=  <  >  <=  >=
- Ép kiểu: int("5"), float("2.5"), str(10)

Ví dụ: 7 // 2 cho kết quả 3, còn 7 % 2 cho kết quả 1.',
ThucHanh = 'BÀI THỰC HÀNH 2
Viết chương trình nhập hai số a và b (dùng input() rồi ép kiểu về số), sau đó in ra tổng, hiệu, tích, thương và phần dư của a chia b.
Gợi ý: a = int(input("Nhập a: "))
Mở rộng: tính chu vi và diện tích hình tròn khi biết bán kính.'
WHERE MaBH = 'BH002';

UPDATE BAI_HOC SET
GiaoTrinh = 'CẤU TRÚC ĐIỀU KHIỂN: IF / FOR / WHILE

1. Rẽ nhánh với if
  diem = 8
  if diem >= 8:
      print("Giỏi")
  elif diem >= 5:
      print("Đạt")
  else:
      print("Chưa đạt")
Lưu ý: Python dùng thụt lề (4 khoảng trắng) để xác định khối lệnh.

2. Vòng lặp for
  for i in range(1, 6):
      print(i)
range(1, 6) sinh các số từ 1 đến 5.

3. Vòng lặp while
  n = 3
  while n > 0:
      print(n)
      n = n - 1
Cẩn thận để điều kiện dừng được thỏa, nếu không vòng lặp chạy mãi.',
ThucHanh = 'BÀI THỰC HÀNH 3
1. In bảng cửu chương của một số nhập từ bàn phím.
2. Tính tổng các số chẵn từ 1 đến 100.
3. Viết chương trình đoán số: máy chọn số 1-10, người chơi nhập đến khi đoán đúng.'
WHERE MaBH = 'BH003';

UPDATE BAI_HOC SET
GiaoTrinh = 'SELECT, WHERE VÀ CÁC TOÁN TỬ

1. Lấy dữ liệu với SELECT
  SELECT * FROM KHOA_HOC;                -- lấy mọi cột
  SELECT TenKH, HocPhi FROM KHOA_HOC;    -- chỉ lấy 2 cột

2. Lọc dòng với WHERE
  SELECT * FROM KHOA_HOC WHERE HocPhi > 500000;
Các toán tử: =  <>  <  >  <=  >=  AND  OR  NOT  BETWEEN  IN  LIKE

3. Tìm theo mẫu với LIKE
  SELECT * FROM KHOA_HOC WHERE TenKH LIKE "%Python%";
Dấu % đại diện cho một chuỗi ký tự bất kỳ.

4. Sắp xếp và giới hạn
  SELECT * FROM KHOA_HOC ORDER BY HocPhi DESC LIMIT 3;',
ThucHanh = 'BÀI THỰC HÀNH SQL 1
Với bảng KHOA_HOC, viết truy vấn:
1. Liệt kê tên và học phí các khóa miễn phí (HocPhi = 0).
2. Liệt kê khóa có tên chứa chữ "Python".
3. Lấy 2 khóa có học phí cao nhất.'
WHERE MaBH = 'BH004';

UPDATE BAI_HOC SET
GiaoTrinh = 'JOIN NHIỀU BẢNG

Dữ liệu được tách ra nhiều bảng để tránh lặp. Muốn xem thông tin ghép lại thì dùng JOIN, nối các bảng qua khóa ngoại.

1. INNER JOIN: chỉ giữ các dòng khớp ở cả hai bảng
  SELECT kh.TenKH, gv.HoTen
  FROM KHOA_HOC kh
  JOIN GIANG_VIEN gv ON gv.MaGV = kh.MaGV;

2. LEFT JOIN: giữ mọi dòng của bảng bên trái, dòng không khớp có giá trị NULL
  SELECT kh.TenKH, dk.MaDK
  FROM KHOA_HOC kh
  LEFT JOIN DANG_KY dk ON dk.MaKH = kh.MaKH;
Dùng thêm WHERE dk.MaDK IS NULL để tìm khóa chưa có ai đăng ký.

3. Nối ba bảng: viết hai mệnh đề JOIN liên tiếp.',
ThucHanh = 'BÀI THỰC HÀNH SQL 2
1. Liệt kê tên học viên và tên khóa họ đã đăng ký (nối HOC_VIEN, DANG_KY, KHOA_HOC).
2. Liệt kê các khóa chưa có học viên nào đăng ký.
3. Đếm số lượt đăng ký của từng khóa, sắp xếp giảm dần.'
WHERE MaBH = 'BH005';

SELECT MaBH, TenBH, LEFT(GiaoTrinh, 40) AS GiaoTrinh, LEFT(ThucHanh, 40) AS ThucHanh FROM BAI_HOC WHERE MaBH IN ('BH001','BH002','BH003','BH004','BH005');
