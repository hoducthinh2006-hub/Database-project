// Chạy ngay trong <head>, trước khi trình duyệt vẽ: áp giao diện sáng/tối + tông màu đã lưu để trang không bị "chớp" sai màu.
// Đặt lớp "booting" (sidebar/thanh trên ẩn tới khi có nội dung) — js/motion.js gỡ lớp này, CSS tự mở lại sau ~1.8s nếu script hỏng.
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
