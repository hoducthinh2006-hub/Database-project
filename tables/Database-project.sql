-- create database DatabaseProject;
use DatabaseProject;

create table Giang_Vien(
	MaGV int primary key,
    HoTen varchar(50) not null,
    Email varchar(50) not null,
    TrinhDo varchar(50) not null,
    ChuyenMon varchar(50) not null,
    CCCD varchar(50) not null,
    unique(Email, CCCD)
);

