/* Chạy ngay trong <head>, TRƯỚC khi trình duyệt vẽ: áp giao diện sáng/tối + tông màu đã lưu để trang không bị "chớp" sai màu.
 * (Tách thành tệp riêng thay vì viết thẳng trong HTML để chính sách bảo mật CSP có thể cấm script chèn sẵn.)
 * Đồng thời đặt lớp "booting": sidebar/thanh trên ẩn cho tới khi có nội dung rồi mới trượt vào (js/motion.js gỡ lớp này;
 * CSS cũng tự mở lại sau ~1.8s nên nếu script hỏng thì trang vẫn hiện đủ). Người bật "giảm chuyển động" không có phần mở đầu. */
(function () {
  try {
    var d = document.documentElement, t = localStorage.getItem("n9-theme"), a = localStorage.getItem("n9-accent");
    d.setAttribute("data-theme", t === "light" ? "light" : "dark");
    if (a && a !== "pine" && a !== "violet") d.setAttribute("data-accent", a);
  } catch (e) {}
  try {
    if (!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) && typeof Element.prototype.animate === "function") document.documentElement.classList.add("booting");
  } catch (e) {}
})();
