use btl;

create table Hoc_Vien(
MaHV int primary key auto_increment,
HoTen varchar(50) not null,
Email varchar(50) not null,
NgaySinh date not null,
SDT varchar(20) not null,
CCCD varchar(20) not null,
NgayDK datetime default current_timestamp, 
TrangThaiTK ENUM('DANG HOAT DONG', 'DANG BI KHOA'),
UNIQUE(Email, SDT, CCCD)
);

create table Giang_Vien(
MaGV int primary key,
HoTen varchar(50) not null,
Email varchar(50) not null,
NgaySinh date not null,
SDT varchar(20) not null,
TrinhDo ENUM('THAC SI', 'TIEN SI', 'CU NHAN') not null,
CCCD varchar(20) not null,
UNIQUE(Email, SDT, CCCD)
);

create table Khoa_Hoc(
MaKH int primary key,
TenKH varchar(50) not null,
HocPhi long not null,
MoTa text not null,
NgayTao datetime default current_timestamp,
TrangThai ENUM('DANG HOAT DONG', 'HET HAN') not null,
ThoiLuong int not null,
LinhVuc varchar(50) not null,
MaGV int,
foreign key(MaGV) references Giang_Vien(MaGV)
);

