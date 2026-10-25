/* Lớp gọi API tới backend N9.
 * - Khi mở web qua chính server (http://localhost:3000) hoặc sau khi deploy:
 *   API cùng origin → BASE = "".
 * - Khi mở bằng Live Server (cổng 5500) hoặc mở file trực tiếp:
 *   trỏ sang backend local http://localhost:3000.
 * Lỗi ném ra có thêm: err.code (mã máy đọc được), err.status, err.retryAfter (giây, nếu bị giới hạn tần suất). */
window.API = (function () {
  const isLive = location.port === "5500" || location.protocol === "file:";
  const BASE = isLive ? "http://localhost:3000" : "";
  // phiên đăng nhập không còn dùng được (hết hạn / bị thu hồi / tài khoản bị khóa hoặc xóa) → app.js đăng xuất và mời đăng nhập lại
  const SESSION_LOST = ["NO_TOKEN", "TOKEN_EXPIRED", "TOKEN_INVALID", "TOKEN_REVOKED", "ACCOUNT_GONE", "ACCOUNT_SUSPENDED"];
  let onSessionLost = null;

  function getToken() { try { return localStorage.getItem("n9-token") || ""; } catch (e) { return ""; } }

  async function req(method, path, body) {
    const headers = { "Content-Type": "application/json" };
    const t = getToken();
    if (t) headers["Authorization"] = "Bearer " + t;
    let res;
    try {
      res = await fetch(BASE + "/api" + path, {
        method, headers, body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw new Error("Không kết nối được máy chủ. Hãy chạy backend (npm run dev).");
    }
    let data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      const err = new Error((data && data.error) || ("Lỗi " + res.status));
      err.status = res.status; err.code = data && data.code; err.retryAfter = data && data.retryAfter;
      if (t && SESSION_LOST.includes(err.code) && onSessionLost) onSessionLost(err);
      throw err;
    }
    return data;
  }

  return {
    setToken: (t) => { try { t ? localStorage.setItem("n9-token", t) : localStorage.removeItem("n9-token"); } catch (e) {} },
    onSessionLost: (fn) => { onSessionLost = fn; },
    register: (d) => req("POST", "/auth/register", d),
    login: (d) => req("POST", "/auth/login", d),
    getProfile: () => req("GET", "/auth/me"),
    updateProfile: (d) => req("PUT", "/auth/me", d),
    changePassword: (matKhauCu, matKhauMoi) => req("POST", "/auth/change-password", { matKhauCu, matKhauMoi }),
    listCourses: () => req("GET", "/courses"),
    getCourse: (id) => req("GET", "/courses/" + id),
    createCourse: (d) => req("POST", "/courses", d),
    updateCourse: (id, d) => req("PUT", "/courses/" + id, d),
    deleteCourse: (id) => req("DELETE", "/courses/" + id),
    addLesson: (id, d) => req("POST", "/courses/" + id + "/lessons", d),
    updateLesson: (maBH, d) => req("PUT", "/courses/lessons/" + maBH, d),
    deleteLesson: (maBH) => req("DELETE", "/courses/lessons/" + maBH),
    // đăng ký khóa học
    getEnrollment: (maKH) => req("GET", "/courses/" + maKH + "/enrollment"),
    enroll: (maKH) => req("POST", "/courses/" + maKH + "/enroll"),
    // bài kiểm tra (nộp bài phải kèm startToken nhận được khi mở bài)
    listQuizzes: (maKH) => req("GET", "/quizzes/course/" + maKH),
    getQuiz: (maBKT) => req("GET", "/quizzes/" + maBKT),
    submitQuiz: (maBKT, answers, startToken) => req("POST", "/quizzes/" + maBKT + "/submit", { answers, startToken }),
    createQuiz: (maBH, d) => req("POST", "/quizzes/lesson/" + maBH, d),
    updateQuiz: (maBKT, d) => req("PUT", "/quizzes/" + maBKT, d),
    deleteQuiz: (maBKT) => req("DELETE", "/quizzes/" + maBKT),
    // học tập của học viên
    studentOverview: () => req("GET", "/student/overview"),
    studentBoard: (maKH) => req("GET", "/student/leaderboard?maKH=" + encodeURIComponent(maKH)),
    // tieuChi: "diem" | "chamchi"; khoang: "tuan" | "thang" | "tatca"
    studentGlobalBoard: (tieuChi, khoang) => req("GET", "/student/leaderboard/global?tieuChi=" + encodeURIComponent(tieuChi || "diem") + "&khoang=" + encodeURIComponent(khoang || "tatca")),
    honors: () => req("GET", "/honors"),
    studentResults: () => req("GET", "/student/results"),
    studentPayments: () => req("GET", "/student/payments"),
    studentPay: (maDK, phuongThuc) => req("POST", "/student/payments", { maDK, phuongThuc }),
    studentPayQr: (maDK) => req("GET", "/student/payments/" + maDK + "/qr"),
    studentReview: (maDK, diem, nhanXet) => req("POST", "/student/reviews", { maDK, diem, nhanXet }),
    openLesson: (maBH) => req("POST", "/student/lessons/" + maBH + "/open"),
    completeLesson: (maBH) => req("POST", "/student/lessons/" + maBH + "/complete"),
    // bảng điều khiển giảng viên
    teacherOverview: () => req("GET", "/teacher/overview"),
    courseStudents: (maKH) => req("GET", "/teacher/courses/" + maKH + "/students"),
    teacherReviews: () => req("GET", "/teacher/reviews"),
    // bảng điều khiển quản trị
    adminOverview: () => req("GET", "/admin/overview"),
    adminTeachers: () => req("GET", "/admin/teachers"),
    adminCreateTeacher: (d) => req("POST", "/admin/teachers", d),
    adminSetTeacherStatus: (id, status) => req("PUT", "/admin/teachers/" + id + "/status", { status }),
    adminStudents: () => req("GET", "/admin/students"),
    adminSetStudentStatus: (id, status) => req("PUT", "/admin/students/" + id + "/status", { status }),
    adminResetPassword: (kind, id) => req("POST", "/admin/" + kind + "/" + id + "/reset-password"), // kind: "teachers" | "students"
    adminCourses: () => req("GET", "/admin/courses"),
    adminSetCourseStatus: (id, status) => req("PUT", "/admin/courses/" + id + "/status", { status }),
    // trình duyệt dữ liệu thô (chỉ xem)
    adminLessons: () => req("GET", "/admin/lessons"),
    adminEnrollments: () => req("GET", "/admin/enrollments"),
    adminQuizzes: () => req("GET", "/admin/quizzes"),
    adminResults: () => req("GET", "/admin/results"),
    adminPayments: () => req("GET", "/admin/payments"),
    adminApprovePayment: (maTT) => req("POST", "/admin/payments/" + maTT + "/approve"),
    adminRejectPayment: (maTT, lyDo) => req("POST", "/admin/payments/" + maTT + "/reject", { lyDo }),
    adminCertificates: () => req("GET", "/admin/certificates"),
    adminReviews: () => req("GET", "/admin/reviews"),
    // báo cáo — 15 truy vấn
    report: (id, params) => req("GET", "/reports/" + id + (params ? "?" + new URLSearchParams(params).toString() : "")),
  };
})();
