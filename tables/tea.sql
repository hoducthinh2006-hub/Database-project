use DatabaseProject;

create table Bai_Kiem_Tra (
    MaBKT int primary key,
    TenBKT varchar(50) not null, 
    ThoiGian int not null,
    DiemToiDa int not null,
    SoLanLamToiDa int not null,
    NoiDungBKT text not null,
    MaBH int not null,
    foreign key(MaBH) references Bai_Hoc(MaBH)
);

create table Thanh_Toan (
    MaTT int primary key,
    ThoiGian timestamp default current_timestamp not null,
    PhuongThucTT enum('Tien Mat', 'Chuyen Khoan', 'The Tin Dung') not null,
    TrangThaiTT enum('Da Thanh Toan', 'Chua Thanh Toan') not null,
    HocPhi decimal(10, 2) not null,
    LoaiGiaoDich enum('Dang Xu Ly', 'Thanh Cong', 'That Bai') not null,
    MaDK int not null,
    foreign key(MaDK) references Dang_Ky(MaDK)
);

create table Tien_Do_Bai_Hoc (
    MaDK int not null,
    MaBH int not null,
    TrangThai enum('Chua Hoan Thanh', 'Dang Hoan Thanh', 'Da Hoan Thanh') not null,
    ThoiGianHoanThanh timestamp default current_timestamp not null,
    primary key(MaDK, MaBH),
    foreign key(MaBH) references Bai_Hoc(MaBH),
    foreign key(MaDK) references Dang_Ky(MaDK)
);

create table Ket_Qua (
    MaKQ int primary key,
    LanLam int not null,
    DiemSo int not null,
    ThoiGianLam int not null,
    MaDK int not null,
    foreign key(MaDK) references Dang_Ky(MaDK),
    MaBKT int not null,
    foreign key(MaBKT) references Bai_Kiem_Tra(MaBKT)
);