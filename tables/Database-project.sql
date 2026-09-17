create database DatabaseProject;
use DatabaseProject;

create table Giang_Vien(
	MaGV int primary key,
    HoTen varchar(50) not null,
    NgaySinh date not null,
    SDT varchar(20) not null,
    Email varchar(50) not null,
    TrinhDo varchar(50) not null,
    ChuyenMon varchar(50) not null,
    unique(Email, CCCD, SDT)
);
create table Hoc_Vien(
	MaHV int primary key,
	HoTen varchar(50) not null,
    NgaySinh date not null,
    Email varchar(50) not null,
    SDT varchar(50) not null,
    NgayDK datetime default current_timestamp not null,
    TrangThaiTK enum('Dang Hoat Dong', 'Dang Bi Khoa') not null default 'Dang Hoat Dong',
    unique(Email, SDT, CCCD)
);
create table Chung_Chi(
	MaCC int primary key,
    MaDK int not null,
    MaHV int not null,
    NgayCap date not null,
    HieuLuc varchar(50)
);


