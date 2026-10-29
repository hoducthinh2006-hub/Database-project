(function () {
  "use strict";

  /* ============ biểu tượng (sprite <symbol> nằm trong index.html) ============ */
  const ico = (n, cls = "") => `<svg class="ico ico-${n}${cls ? " " + cls : ""}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  // bỏ dấu tiếng Việt để gõ "thiet ke" vẫn tìm ra "Thiết kế"
  const fold = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

  /* ============ ánh xạ dữ liệu DB -> hiển thị ============ */
  const THEMES = {
    code:   { icon: "code",  g: ["#7C5CFF", "#4F8BFF"], c: "#B4A3FF" },
    data:   { icon: "db",    g: ["#22D3EE", "#6366F1"], c: "#5EE9F7" },
    design: { icon: "brush", g: ["#F472B6", "#8B5CF6"], c: "#FF8FC8" },
    lang:   { icon: "globe", g: ["#34D399", "#22A6F0"], c: "#5EEAB4" },
    biz:    { icon: "trend", g: ["#FBBF24", "#F472B6"], c: "#FCD34D" },
    other:  { icon: "book",  g: ["#A78BFA", "#6366F1"], c: "#C4B5FD" },
  };
  function themeKey(c) {
    const f = fold((c.LinhVuc || "") + " " + (c.TenKH || ""));
    if (/\b(sql|mysql|power bi|csdl)\b|du lieu/.test(f)) return "data";
    if (/thiet ke|figma|logo|\bui\b|\bux\b/.test(f)) return "design";
    if (/ngoai ngu|tieng anh|english|giao tiep/.test(f)) return "lang";
    if (/kinh doanh|marketing|ban hang|tai chinh/.test(f)) return "biz";
    if (/lap trinh|cong nghe|cntt|python|javascript|\bweb\b|code/.test(f)) return "code";
    return "other";
  }
  const themeOf = (c) => { const t = THEMES[themeKey(c)]; return { icon: t.icon, g: t.g, grad: `linear-gradient(135deg,${t.g[0]},${t.g[1]})`, glyph: ico(t.icon, "glyph-ico") }; };
  const LEVEL_LABEL = { co_ban: "Cơ bản", trung_cap: "Trung cấp", nang_cao: "Nâng cao" };
  const levelOf = (c) => LEVEL_LABEL[c.TrinhDo] || c.TrinhDo || "—";

  /* ============ helpers ============ */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const app = $("#app");
  const vnd = (n) => (Number(n) || 0).toLocaleString("vi-VN") + "₫";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // Điểm đánh giá thang 0-10 — hiện "x/10", nguyên thì khỏi phần thập phân, TB (AVG) thì giữ 1 số lẻ
  const ratingTxt = (n) => { const x = Number(n) || 0; return `${Number.isInteger(x) ? x : x.toFixed(1)}/10`; };
  function toast(msg) {
    const t = $("#toast"); t.innerHTML = ico("info") + `<span>${esc(msg)}</span>`;
    t.classList.remove("show"); void t.offsetWidth; t.classList.add("show"); // gỡ rồi thêm lại để hiệu ứng trượt lên + thanh đếm giờ chạy lại ở mỗi thông báo
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 2600);
  }
  function ytEmbed(url) {
    if (!url) return null;
    const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/);
    return m ? "https://www.youtube.com/embed/" + m[1] : null;
  }
  // skeleton shimmer thay cho chữ "Đang tải…": toàn trang (go) và gọn (trong tab)
  const loadingHTML = () => `<div class="wrap skel" aria-busy="true" aria-label="Đang tải"><div class="sk sk-hero"></div><div class="sk-grid"><div class="sk sk-card"></div><div class="sk sk-card"></div><div class="sk sk-card"></div></div></div>`;
  const inlineLoading = () => `<div class="sk-inline" aria-busy="true"><div class="sk sk-line"></div><div class="sk sk-line"></div><div class="sk sk-line"></div></div>`;

  /* ============ animation helpers ============ */
  const REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  // hệ chuyển động nằm ở js/motion.js; nếu tệp đó không nạp được thì dùng bản "không làm gì" để app vẫn chạy bình thường
  const NOOP = () => {};
  const galaxyHold = (on) => { if (window.N9Galaxy && N9Galaxy.hold) N9Galaxy.hold("modal", on); };
  const MO = window.N9Motion || { intro: () => document.documentElement.classList.remove("booting"), leave: () => Promise.resolve(), sideIndicator: NOOP, pills: NOOP, morphFrom: NOOP, morphCancel: NOOP, morphTo: NOOP, reveal: (fn) => fn(), centerOf: () => [innerWidth / 2, 0], typewriter: NOOP, afterRender: NOOP, init: NOOP };
  const topbar = {
    t: null,
    el() { return $("#loadbar"); },
    start() { const b = this.el(); if (!b) return; clearTimeout(this.t); b.style.transition = "none"; b.style.opacity = 1; b.style.width = "0%"; void b.offsetWidth; b.style.transition = ""; b.style.width = "72%"; },
    done() { const b = this.el(); if (!b) return; b.style.width = "100%"; this.t = setTimeout(() => { b.style.opacity = 0; this.t = setTimeout(() => { b.style.transition = "none"; b.style.width = "0%"; }, 260); }, 240); },
  };
  function confetti(n = 70) {
    if (REDUCED) return;
    const box = document.createElement("div"); box.className = "confetti";
    const cols = ["#A78BFA", "#6366F1", "#F472B6", "#34D399", "#FBBF24", "#60A5FA"];
    for (let i = 0; i < n; i++) {
      const p = document.createElement("i");
      p.style.cssText = `left:${Math.random() * 100}%;background:${cols[i % cols.length]};width:${6 + Math.random() * 6}px;height:${8 + Math.random() * 8}px;--dx:${((Math.random() - 0.5) * 260) | 0}px;--rot:${(Math.random() * 900 - 450) | 0}deg;--d:${(2 + Math.random() * 1.8).toFixed(2)}s;--dl:${(Math.random() * 0.5).toFixed(2)}s`;
      box.appendChild(p);
    }
    document.body.appendChild(box); setTimeout(() => box.remove(), 4800);
  }
  // các khối "ngoài cùng" vào trang so le; hàng con (dòng bảng, mục timeline...) chảy theo sau khối cha
  const ANIM_BLOCKS = ".hero-badge,.home-hero .lead,.composer,.cat-chips,.tiles > *,.rail > *,.learn-hero,.admin-hero,.prof-head,.sec-head,.detail-hero > *,.progress-panel,.tabs,.chips,.seg,.board-head,.board-filters,.hcard,.my-rank,.podium,.resume-card,.kpis > *,.dash-grid > *,.panel,.course-grid > *,.resume-grid > *,.cert-grid > *,.lock-grid > *,.lc-card,.unpaid,.todo-quiz,.qres-card,.mng-row,.lesson-bar,.curr-sec,.empty-state,.rank-list,.quiz-bar,.quiz-result,.qq-card,.instr,.cert,.cert-locked,.searchbar,.cat-bar";
  const ANIM_ROWS = ".hc-it,.tl-item,.goal,.score-row,.rank-row,.data-table tbody tr,.lesson-row,.pay-row,.quiz-item,.rev-card,.review-row,.mq-row";
  const COUNT_SEL = ".lh-stats b,.kpi b,.stat-row b,.pod-score,.qr-score,.sr-val,.score-pill";
  const revealIO = "IntersectionObserver" in window
    ? new IntersectionObserver((list) => list.forEach((en) => {
        if (!en.isIntersecting) return;
        const el = en.target; revealIO.unobserve(el); el.classList.add("in");
        setTimeout(() => el.classList.remove("rv", "in"), 800);
      }), { rootMargin: "0px 0px -6% 0px" })
    : null;
  function playEnter(mode) {
    if (REDUCED) return;
    // đổi tab trong cùng trang: giữ nguyên hero/thanh tab, chỉ nội dung bên dưới chuyển động
    const skip = mode === "content" ? ".learn-hero,.admin-hero,.ltabs,.tabs,.prof-head,.detail-hero,.progress-panel,.chips,.seg,.home-hero,.searchbar,.cat-bar" : "";
    const ok = (el) => !(skip && el.closest(skip));
    const vh = window.innerHeight;
    let i = 0;
    $$(ANIM_BLOCKS, app).forEach((el) => {
      if (!ok(el) || el.parentElement.closest(".anim-in,.rv")) return;
      if (revealIO && el.getBoundingClientRect().top > vh * 0.98) { el.classList.add("rv"); revealIO.observe(el); return; } // dưới màn hình → hiện khi cuộn tới
      el.style.setProperty("--i", Math.min(i++, 12)); el.classList.add("anim-in");
    });
    $$(ANIM_ROWS, app).forEach((el) => {
      if (!ok(el) || el.classList.contains("anim-in")) return;
      const host = el.closest(".anim-in");
      if (!host && el.closest(".rv")) return;
      const idx = el.parentElement ? [...el.parentElement.children].indexOf(el) : 0;
      el.style.setProperty("--j", Math.min(idx, 10));
      el.style.setProperty("--b", host ? (host.style.getPropertyValue("--i") || 0) : 0);
      el.classList.add(el.tagName === "TR" ? "anim-fade" : "anim-row");
    });
    countUps(skip);
  }
  // số đếm từ 0 lên giá trị thật: hỗ trợ "12", "9.5", "80%", "1.648.000₫"
  function countUps(skip) {
    if (REDUCED) return;
    $$(COUNT_SEL, app).forEach((el) => {
      if (skip && el.closest(skip)) return;
      const n = [...el.childNodes].find((x) => x.nodeType === 3 && x.nodeValue.trim());
      if (!n) return;
      const m = n.nodeValue.trim().match(/^([^\d]*)([\d.,]+)(\D*)$/);
      if (!m) return;
      const isVnd = m[3].includes("₫"), pre = m[1], suf = m[3];
      let target, dec = 0;
      if (isVnd) target = Number(m[2].replace(/\./g, ""));
      else { target = parseFloat(m[2].replace(",", ".")); const p = m[2].split("."); dec = p[1] ? p[1].length : 0; }
      if (!isFinite(target) || target === 0) return;
      const fmt = (v) => pre + (isVnd ? Math.round(v).toLocaleString("vi-VN") : v.toFixed(dec)) + suf;
      const t0 = performance.now() + 260, dur = 1000;
      n.nodeValue = fmt(0);
      const run = (t) => {
        if (!n.isConnected) return;
        const k = Math.min(1, Math.max(0, (t - t0) / dur)), e = 1 - Math.pow(1 - k, 3);
        n.nodeValue = fmt(target * e);
        if (k < 1) requestAnimationFrame(run); else n.nodeValue = fmt(target);
      };
      requestAnimationFrame(run);
    });
  }
  const fmtTime = (s) => { s = Math.max(0, s | 0); const m = (s / 60) | 0; const r = s % 60; return `${m}:${String(r).padStart(2, "0")}`; };
  const MONTH_SHORT = (ym) => { const p = String(ym).split("-"); return p.length === 2 ? `Th.${Number(p[1])}` : ym; };
  function barChart(rows) {
    if (!rows || !rows.length) return `<div class="empty-state sm"><p class="muted">Chưa có dữ liệu doanh thu.</p></div>`;
    const max = Math.max(1, ...rows.map((r) => Number(r.DoanhThu) || 0));
    return `<div class="bar-chart">${rows.map((r) => {
      const v = Number(r.DoanhThu) || 0, h = Math.max(4, Math.round((v / max) * 100));
      return `<div class="bar-col" title="${esc(MONTH_SHORT(r.Thang))}: ${vnd(v)}">
        <span class="bar-val">${v ? vnd(v) : ""}</span>
        <div class="bar-rect" style="height:${h}%"></div>
        <span class="bar-label">${esc(MONTH_SHORT(r.Thang))}</span>
      </div>`;
    }).join("")}</div>`;
  }
  const STATUS_LABEL = {
    draft: ["Nháp", "muted"], published: ["Công khai", "ok"], archived: ["Lưu trữ", "muted"],
    active: ["Hoạt động", "ok"], suspended: ["Đã khóa", "no"], inactive: ["Ngừng", "muted"],
    success: ["Thành công", "ok"], pending: ["Đang chờ", "muted"], failed: ["Thất bại", "no"], cancelled: ["Đã hủy", "no"],
    con_hieu_luc: ["Còn hiệu lực", "ok"], het_hieu_luc: ["Hết hiệu lực", "muted"],
  };
  function statusBadge(s) { const [l, cls] = STATUS_LABEL[s] || [s, "muted"]; return `<span class="pill ${cls}">${esc(l)}</span>`; }
  const ENROLL_LABEL = { cho_xac_nhan: "Chờ xác nhận", da_xac_nhan: "Đã xác nhận", dang_hoc: "Đang học", hoan_thanh: "Hoàn thành", da_huy: "Đã huỷ" };
  function enrollStatusBadge(s) { const cls = s === "hoan_thanh" ? "ok" : s === "da_huy" ? "no" : "muted"; return `<span class="pill ${cls}">${esc(ENROLL_LABEL[s] || s)}</span>`; }
  // bảng tự sinh cột từ key của dòng đầu tiên — dùng cho kết quả 15 truy vấn báo cáo (mỗi câu trả về cột khác nhau)
  function autoTable(rows) {
    if (!rows || !rows.length) return `<div class="empty-state sm"><p class="muted">Không có dữ liệu phù hợp với tham số đã chọn.</p></div>`;
    const cols = Object.keys(rows[0]);
    return `<div class="tbl-wrap"><table class="data-table"><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>
      ${rows.map((r) => `<tr>${cols.map((c) => `<td>${r[c] == null ? "—" : esc(r[c])}</td>`).join("")}</tr>`).join("")}
    </tbody></table></div>`;
  }

  /* ============ state ============ */
  const nav = { view: "home", param: null, tab: "curr", lesson: null, mtab: "overview", atab: "overview", ltab: "overview", htab: null };
  let COURSES = [];       // danh sách khóa học từ API
  let detailCache = null; // chi tiết khóa đang mở (kèm lessons)
  let QUIZ = null;        // trạng thái bài kiểm tra đang làm
  const TEACH = { overview: null, reviews: null, studentsByCourse: {} }; // cache bảng điều khiển giảng viên
  const ADMIN = { // cache bảng điều khiển quản trị
    overview: null, teachers: null, students: null, courses: null,
    lessons: null, enrollments: null, quizzes: null, results: null,
    payments: null, certificates: null, reviews: null, reportState: null,
  };
  let PROFILE = null;     // hồ sơ đầy đủ (SDT, ngày sinh, thống kê...) — nạp lại mỗi lần vào trang Hồ sơ
  // cache "Học tập của tôi" (học viên) — xóa bằng stuReset() mỗi khi dữ liệu đổi (đăng ký, học bài, làm bài, thanh toán, đánh giá)
  const STU = { overview: null, board: {}, global: {}, results: null, payments: null, boardMode: "course", boardCourse: null, cfilter: "all", gCrit: "diem", gSpan: "tatca" };
  let pendingLesson = null; // bài cần mở sẵn khi vào trang chi tiết khóa (nút "Học tiếp")
  function stuReset() { STU.overview = null; STU.board = {}; STU.global = {}; STU.results = null; STU.payments = null; setTimeout(prefetchStudent, 0); }
  // sidebar + chuông cần số liệu học tập ở MỌI trang → nạp nền khi vừa bị xóa cache
  function prefetchStudent() {
    if (!isStudent() || STU.overview || STU._busy) return;
    STU._busy = true;
    API.studentOverview().then((ov) => { if (!STU.overview) STU.overview = ov; }).catch(() => {}).then(() => { STU._busy = false; renderNav(); if (nav.view === "home") render(); });
  }
  // xóa mọi dữ liệu đệm gắn với tài khoản (đăng nhập/đăng xuất/đổi tài khoản) để không lộ số liệu của người trước
  function resetCaches() {
    STU.overview = null; STU.board = {}; STU.global = {}; STU.results = null; STU.payments = null; STU.boardCourse = null; STU.cfilter = "all";
    TEACH.overview = null; TEACH.reviews = null; TEACH.studentsByCourse = {};
    Object.keys(ADMIN).forEach((k) => { ADMIN[k] = null; });
    PROFILE = null; detailCache = null; HONOR = null;
  }
  const isStudent = () => !!AUTH.user && AUTH.user.role === "student";
  const enrolledSet = () => new Set(((STU.overview && STU.overview.courses) || []).filter((c) => c.TTDangKy !== "da_huy").map((c) => c.MaKH));

  /* ============ AUTH (qua API) ============ */
  const AUTH = {
    user: null,
    load() { try { const u = localStorage.getItem("n9-user"); if (u) this.user = JSON.parse(u); } catch (e) {} },
    set(user, token) { this.user = user; try { localStorage.setItem("n9-user", JSON.stringify(user)); } catch (e) {} API.setToken(token); },
    clear() { this.user = null; try { localStorage.removeItem("n9-user"); } catch (e) {} API.setToken(""); },
  };

  /* ============ KHUNG ỨNG DỤNG: sidebar · thanh trên · tìm kiếm · thông báo ============ */
  const NAV_RUN = {};            // id mục sidebar → hàm chạy khi bấm (đăng ký lại mỗi lần vẽ sidebar)
  const GROUP_OPEN = new Set();  // các nhóm báo cáo đang được mở tay trong sidebar quản trị
  function initialsOf(name) { const p = String(name || "").trim().split(/\s+/).filter(Boolean); if (!p.length) return "?"; const a = p.length > 1 ? p[p.length - 2][0] : p[0][0]; return (a + p[p.length - 1][0]).toUpperCase(); }

  const sbItem = (id, icon, label, on, run, badge) => {
    NAV_RUN[id] = run;
    const b = badge && typeof badge === "object" ? badge : { n: badge };
    return `<button class="sb-item${on ? " active" : ""}" data-nav="${id}"${on ? ' aria-current="page"' : ""}>${ico(icon)}<span>${esc(label)}</span>${b.n ? `<b class="sb-count${b.alert ? " alert" : ""}">${b.n}</b>` : ""}</button>`;
  };
  function sidebarHTML(role) {
    const v = nav.view;
    const home = sbItem("home", "home", "Trang chủ", v === "home", () => go("home"));
    const explore = (on) => sbItem("catalog", "compass", "Khám phá khóa học", on, () => { catState.cat = "all"; catState.q = ""; go("catalog"); });
    const prof = sbItem("profile", "user", "Hồ sơ của tôi", v === "profile", () => go("profile"));
    const honor = sbItem("honor", "crown", "Vinh danh", v === "honor", () => go("honor"));
    if (role === "student") {
      const k = (STU.overview && STU.overview.kpi) || {};
      const L = (...t) => v === "learn" && t.includes(nav.ltab);
      return home + explore(v === "catalog" || v === "detail")
        + sbItem("l-overview", "book", "Học tập của tôi", L("overview", "courses", "results"), () => { STU.overview = null; go("learn", null, "overview"); })
        + sbItem("l-board", "trophy", "Bảng xếp hạng", L("board"), () => go("learn", null, "board"))
        + honor
        + sbItem("l-certs", "award", "Chứng chỉ", L("certs"), () => go("learn", null, "certs"), k.ChungChi || 0)
        + sbItem("l-pay", "card", "Thanh toán", L("pay"), () => go("learn", null, "pay"), k.ChoThanhToan ? { n: k.ChoThanhToan, alert: true } : 0)
        + prof;
    }
    if (role === "teacher") {
      const M = (...t) => v === "manage" && t.includes(nav.mtab);
      return home + explore(v === "catalog" || v === "detail")
        + sbItem("m-overview", "chart", "Tổng quan giảng dạy", M("overview"), () => go("manage", null, "overview"))
        + sbItem("m-courses", "layers", "Khóa học của tôi", M("courses") || v === "manageLessons", () => go("manage", null, "courses"), myCourses().length)
        + sbItem("m-reviews", "star", "Đánh giá từ học viên", M("reviews"), () => go("manage", null, "reviews"))
        + honor + prof;
    }
    if (role === "admin") {
      const ov = ADMIN.overview || {}, cnt = { teachers: ov.SoGiangVien, students: ov.SoHocVien, courses: ov.SoKhoaHoc };
      return honor + ADMIN_SECTIONS.map((g, gi) => {
        const collapsible = gi >= 4;                                   // 3 nhóm báo cáo: gập cho gọn, tự mở khi đang xem
        const act = v === "admin" && g.items.some((it) => it[0] === nav.atab);
        const open = !collapsible || act || GROUP_OPEN.has(gi);
        const head = collapsible ? `<button class="sb-ghead" data-grp="${gi}">${esc(g.group)}${ico("chev-d")}</button>` : `<div class="sb-sec" style="padding-top:12px">${esc(g.group)}</div>`;
        return `<div class="sb-group${open ? " open" : ""}">${head}<div class="sb-gbody">${g.items.map(([id, ic, l]) => sbItem("a-" + id, ic, l, v === "admin" && nav.atab === id, () => go("admin", null, id), cnt[id])).join("")}</div></div>`;
      }).join("");
    }
    return home + explore(v === "detail" || (v === "catalog" && catState.sort !== "rating"))
      + sbItem("rank", "trophy", "Xếp hạng đánh giá", v === "catalog" && catState.sort === "rating", () => { catState.sort = "rating"; catState.cat = "all"; catState.q = ""; go("catalog"); })
      + honor;
  }
  function recentHTML(role) {
    if (role === "student") {
      const list = activeCourses().slice(0, 4);
      if (!list.length) return "";
      return `<div class="sb-sec"><span>Đang học</span>${ico("sparkle")}</div>` + list.map((c) => {
        const nb = c.BaiTiepTheo, pct = Math.round(c.TienDoPhanTram || 0), when = ago(c.HoatDongCuoi || c.NgayDangKy);
        return `<button class="rc-item" data-resume="${c.MaKH}:${nb ? nb.MaBH : ""}"><b>${esc(c.TenKH)}</b><span>${c.SoBaiHoanThanh}/${c.TongSoBai} bài${when ? " · " + when : ""}</span><span class="rc-bar"><i style="width:${pct}%"></i></span></button>`;
      }).join("");
    }
    if (role === "teacher") {
      const list = myCourses().slice(0, 4);
      if (!list.length) return "";
      return `<div class="sb-sec"><span>Khóa học của tôi</span>${ico("sparkle")}</div>` + list.map((c) => `<button class="rc-item" data-lessons="${c.MaKH}"><b>${esc(c.TenKH)}</b><span>${esc((STATUS_LABEL[c.TrangThai] || [c.TrangThai])[0])} · ${c.SoBaiHoc || 0} bài</span></button>`).join("");
    }
    if (!role) {
      const list = topRated(4);
      if (!list.length) return "";
      return `<div class="sb-sec"><span>Nổi bật</span>${ico("sparkle")}</div>` + list.map((c) => `<button class="rc-item" data-open="${c.MaKH}"><b>${esc(c.TenKH)}</b><span>${esc(c.TenGV || "")}${c.DiemTB != null ? " · " + ratingTxt(c.DiemTB) : ""}</span></button>`).join("");
    }
    return "";
  }
  function footHTML(role) {
    const btn = (id, label, run) => { NAV_RUN[id] = run; return `<button class="btn btn-ghost" data-nav="${id}">${label} ${ico("arrow-r")}</button>`; };
    if (role === "student") return btn("f-all", "Xem tất cả khóa học", () => go("learn", null, "courses"));
    if (role === "teacher") return btn("f-all", "Quản lý khóa học", () => go("manage", null, "courses"));
    if (role === "admin") return btn("f-home", "Xem trang chủ", () => go("home"));
    return btn("f-login", "Đăng nhập để học", () => openAuth("signin"));
  }
  /* Cập nhật khối HTML TẠI CHỖ khi cấu trúc không đổi (chỉ khác lớp active / chữ / số đếm): không hủy node nên giữ được hover,
   * thanh trượt đang chạy và animation mở đầu; khác cấu trúc (thêm/bớt mục) thì thay cả khối như cũ. */
  function sameShape(a, b) {
    if (a.childNodes.length !== b.childNodes.length) return false;
    for (let i = 0; i < a.childNodes.length; i++) {
      const x = a.childNodes[i], y = b.childNodes[i];
      if (x.nodeType !== y.nodeType) return false;
      if (x.nodeType === 1 && (x.tagName !== y.tagName || !sameShape(x, y))) return false;
    }
    return true;
  }
  function patchNode(a, b) {
    for (let i = 0; i < a.childNodes.length; i++) {
      const x = a.childNodes[i], y = b.childNodes[i];
      if (x.nodeType === 3) { if (x.nodeValue !== y.nodeValue) x.nodeValue = y.nodeValue; continue; }
      if (x.nodeType !== 1) continue;
      [...x.attributes].forEach((at) => { if (!y.hasAttribute(at.name)) x.removeAttribute(at.name); });
      [...y.attributes].forEach((at) => { if (x.getAttribute(at.name) !== at.value) x.setAttribute(at.name, at.value); });
      patchNode(x, y);
    }
  }
  function morphInto(el, html) {
    if (!el || el._html === html) return;
    const tpl = document.createElement("template"); tpl.innerHTML = html;
    if (el.childNodes.length && sameShape(el, tpl.content)) patchNode(el, tpl.content); else el.innerHTML = html;
    el._html = html;
  }
  function renderSidebar(role) {
    Object.keys(NAV_RUN).forEach((k) => delete NAV_RUN[k]);
    const navEl = $("#sbNav"); if (!navEl) return;
    navEl.className = "sb-nav" + (role === "admin" ? " scroll" : "");
    // thanh trượt (#sbInd) nằm ngoài vùng được cập nhật nên không bị phá mỗi lần chuyển trang
    if (!$("#sbItems", navEl)) navEl.innerHTML = '<i class="sb-ind" id="sbInd" aria-hidden="true"></i><div class="sb-items" id="sbItems"></div>';
    morphInto($("#sbItems", navEl), sidebarHTML(role));
    morphInto($("#sbRecent"), role === "admin" ? "" : recentHTML(role));
    morphInto($("#sbFoot"), footHTML(role));
    MO.sideIndicator();
  }

  // việc cần làm → hiện ở chuông thông báo
  function notifItems() {
    const u = AUTH.user; if (!u) return [];
    if (u.role === "student") return goalItems();
    if (u.role === "teacher") {
      const d = myCourses().filter((c) => c.TrangThai === "draft");
      return d.length ? [{ ic: "clock", t: `${d.length} khóa học đang ở trạng thái nháp — chờ admin duyệt để công khai`, a: "Xem", at: `data-nav-go="manage:courses"` }] : [];
    }
    if (u.role === "admin") {
      const n = (ADMIN.overview || {}).soKhoaChoDuyet;
      return n ? [{ ic: "clock", t: `${n} khóa học đang chờ duyệt (nháp)`, a: "Duyệt", at: `data-nav-go="admin:courses"` }] : [];
    }
    return [];
  }
  function renderTopbar(u, role) {
    const ta = $("#topAction");
    ta.innerHTML = role === "student" ? `<button class="btn btn-ghost" data-go="catalog">${ico("plus")} Khóa học mới</button>`
      : role === "teacher" ? `<button class="btn btn-primary" data-add-course>${ico("plus")} Thêm khóa học</button>` : "";
    const n = notifItems().length;
    $("#bellWrap").innerHTML = u ? `<button class="icon-btn" id="bellBtn" aria-label="Thông báo" aria-haspopup="true">${ico("bell")}${n ? `<span class="bell-n">${n}</span>` : ""}</button><div class="pop bell-pop" id="bellPop" hidden></div>` : "";
    const na = $("#navAuth");
    if (u) {
      const badge = role === "teacher" ? "Giảng viên" : role === "admin" ? "Quản trị viên" : "Học viên";
      na.innerHTML = `<div class="avatar-wrap">
        <button class="avatar ${role === "admin" ? "ava-admin" : ""}" id="avaBtn" title="${esc(u.ten)}" aria-haspopup="true">${esc(initialsOf(u.ten))}</button>
        <div class="pop avatar-menu" id="avaMenu" hidden>
          <div class="am-head"><span class="avatar sm">${esc(initialsOf(u.ten))}</span><div><b>${esc(u.ten)}</b><span>${badge}</span></div></div>
          ${role === "teacher" ? `<button class="menu-item" data-go="manage">${ico("layers")} Trang quản lý</button>` : ""}
          ${role === "admin" ? `<button class="menu-item" data-go="admin">${ico("shield")} Trang quản trị</button>` : ""}
          ${role === "student" ? `<button class="menu-item" data-go="learn">${ico("book")} Học tập của tôi</button>` : ""}
          ${role !== "admin" ? `<button class="menu-item" data-go="profile">${ico("user")} Hồ sơ của tôi</button>` : ""}
          <button class="menu-item danger" data-signout>${ico("logout")} Đăng xuất</button>
        </div></div>`;
    } else {
      na.innerHTML = `<button class="btn-auth ghost" data-auth="signin">Đăng nhập</button><button class="btn-auth solid" data-auth="signup">Đăng ký</button>`;
    }
  }
  function drawBell() {
    const p = $("#bellPop"); if (!p) return;
    const items = notifItems();
    p.innerHTML = `<div class="bp-head"><span>Việc cần làm</span><span class="muted" style="font-size:.76rem;font-weight:500">${items.length ? items.length + " mục" : ""}</span></div>`
      + (items.length ? items.map((g) => `<div class="bp-item"><span class="bp-ic">${ico(g.ic)}</span><p>${esc(g.t)}</p><button class="btn btn-ghost btn-sm" ${g.at}>${esc(g.a)}</button></div>`).join("")
        : `<div class="bp-empty">${ico("check-circle")}<p style="margin-top:8px">Bạn đã xong hết việc cần làm.</p></div>`);
    p.onclick = (e) => { if (e.target.closest("button[data-resume],button[data-ltab],button[data-pay],button[data-review],button[data-nav-go]")) p.hidden = true; };
    wire();
  }
  function renderNav() {
    const u = AUTH.user, role = u ? u.role : null;
    renderSidebar(role); renderTopbar(u, role); wireNav();
  }
  function closeAvatarMenu() { const m = $("#avaMenu"); if (m) m.hidden = true; }
  function closePops() { ["#avaMenu", "#bellPop", "#palPop", "#gsPop"].forEach((s) => { const e = $(s); if (e) e.hidden = true; }); }
  function openSide() { document.body.classList.add("side-open"); }
  function closeSide() { document.body.classList.remove("side-open"); }
  function wireNav() {
    $$("#sbNav [data-nav], #sbFoot [data-nav]").forEach((b) => b.onclick = () => { closeSide(); const f = NAV_RUN[b.dataset.nav]; if (f) f(); });
    $$("#sbNav [data-grp]").forEach((b) => b.onclick = () => { const g = +b.dataset.grp; GROUP_OPEN.has(g) ? GROUP_OPEN.delete(g) : GROUP_OPEN.add(g); renderNav(); });
    $$("#sbRecent [data-resume]").forEach((b) => b.onclick = () => { closeSide(); const [k, l] = b.dataset.resume.split(":"); pendingLesson = l || null; go("detail", k); });
    $$("#sbRecent [data-lessons]").forEach((b) => b.onclick = () => { closeSide(); go("manageLessons", b.dataset.lessons); });
    $$("#sbRecent [data-open]").forEach((b) => b.onclick = () => { closeSide(); go("detail", b.dataset.open); });
    $$("#topAction [data-go], #navAuth [data-go]").forEach((b) => b.onclick = () => { closePops(); go(b.dataset.go); });
    $$("#topAction [data-add-course]").forEach((b) => b.onclick = () => openCourseForm());
    $$("[data-auth]").forEach((b) => b.onclick = () => openAuth(b.dataset.auth));
    $$("[data-signout]").forEach((b) => b.onclick = () => signout());
    const ab = $("#avaBtn"); if (ab) ab.onclick = (e) => { e.stopPropagation(); const m = $("#avaMenu"), was = m.hidden; closePops(); m.hidden = !was; };
    const bb = $("#bellBtn"); if (bb) bb.onclick = (e) => { e.stopPropagation(); const p = $("#bellPop"), was = p.hidden; closePops(); p.hidden = !was; if (was) drawBell(); };
  }
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".avatar-wrap")) { const m = $("#avaMenu"); if (m) m.hidden = true; }
    if (!e.target.closest(".bell-wrap")) { const p = $("#bellPop"); if (p) p.hidden = true; }
  });

  /* tìm kiếm toàn cục (Ctrl/⌘ + K): chỉ cập nhật khung gợi ý, KHÔNG vẽ lại ô nhập → gõ Telex/VNI không bị ngắt */
  function initSearch() {
    const inp = $("#gSearchInput"), pop = $("#gsPop"); if (!inp || !pop) return;
    const kb = $(".gsearch kbd"); if (kb && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)) kb.textContent = "⌘ K";
    let items = [], idx = -1;
    const open = () => { pop.hidden = false; inp.setAttribute("aria-expanded", "true"); };
    const close = () => { pop.hidden = true; inp.setAttribute("aria-expanded", "false"); idx = -1; };
    const submit = () => { catState.q = inp.value.trim(); catState.cat = "all"; close(); inp.blur(); go("catalog"); };
    const mark = () => items.forEach((el, i) => el.classList.toggle("active", i === idx));
    const draw = () => {
      const q = inp.value.trim(), t = fold(q);
      const hits = (t ? COURSES.filter((c) => fold(`${c.TenKH} ${c.TenGV || ""} ${c.LinhVuc || ""}`).includes(t)) : topRated(4)).slice(0, 6);
      pop.innerHTML = `<div class="gs-label">${t ? "Khóa học" : "Gợi ý cho bạn"}</div>`
        + (hits.length ? hits.map((c) => { const th = themeOf(c); return `<button class="gs-item" role="option" data-gs-open="${c.MaKH}"><span class="gs-th" style="background:${th.grad}">${th.glyph}</span><span class="gs-tx"><b>${esc(c.TenKH)}</b><span>${esc(c.TenGV || "")} · ${esc(c.LinhVuc || "")}</span></span>${c.DiemTB != null ? `<span class="gs-rate">${ratingTxt(c.DiemTB)}</span>` : ""}</button>`; }).join("")
          : `<div class="gs-empty">Không tìm thấy khóa học phù hợp.</div>`)
        + (t ? `<button class="gs-all" data-gs-all>${ico("search")} Xem tất cả kết quả cho “${esc(q)}” ${ico("arrow-r")}</button>` : "");
      items = $$(".gs-item, .gs-all", pop); idx = -1;
    };
    pop.onclick = (e) => {
      const b = e.target.closest("[data-gs-open],[data-gs-all]"); if (!b) return;
      if (b.dataset.gsOpen) { const k = b.dataset.gsOpen; close(); inp.blur(); go("detail", k); } else submit();
    };
    inp.addEventListener("focus", () => { closePops(); draw(); open(); });
    inp.addEventListener("input", () => { draw(); open(); });
    inp.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (pop.hidden) { draw(); open(); } if (items.length) { idx = (idx + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length; mark(); } }
      else if (e.key === "Enter") { e.preventDefault(); if (idx >= 0 && items[idx]) items[idx].click(); else submit(); }
      else if (e.key === "Escape") { close(); inp.blur(); }
    });
    document.addEventListener("click", (e) => { if (!e.target.closest("#gSearch")) close(); });
    document.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); inp.focus(); inp.select(); } });
  }
  function initShell() {
    $("#hamBtn").onclick = openSide;
    $("#sbClose").onclick = closeSide;
    $("#sideScrim").onclick = closeSide;
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeSide(); closePops(); } });
    initSearch();
  }

  /* ============ modal ============ */
  function openModal(html) {
    const r = $("#modalRoot"); r.innerHTML = `<div class="modal-overlay" id="ovl" role="dialog" aria-modal="true" tabindex="-1">${html}</div>`;
    document.body.style.overflow = "hidden"; iconize(r); wrapTables(r);
    galaxyHold(true); // nền thiên hà nằm sau lớp làm mờ → dừng vẽ lại cho hộp thoại mượt
    const o = $("#ovl"); o.onclick = (e) => { if (e.target.id === "ovl") closeModal(); };
    o.focus({ preventScroll: true });
  }
  // đóng có hiệu ứng mờ dần; nếu trong lúc đó đã mở modal khác thì không xóa nhầm (so sánh phần tử overlay)
  function closeModal() {
    const root = $("#modalRoot"), o = $("#ovl");
    if (!o || REDUCED) { root.innerHTML = ""; document.body.style.overflow = ""; galaxyHold(false); return; }
    if (o.classList.contains("closing")) return;
    o.classList.add("closing");
    setTimeout(() => { if ($("#ovl") === o) { root.innerHTML = ""; document.body.style.overflow = ""; galaxyHold(false); } }, 190);
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
  function openConfirm(title, msg, onYes) {
    openModal(`<div class="modal-card sm"><h2 class="modal-title">${title}</h2><p class="muted" style="margin-bottom:20px">${msg}</p>
      <div class="form-actions"><button class="btn btn-ghost" data-close>Hủy</button><button class="btn btn-danger" id="confirmYes">Xóa</button></div></div>`);
    $$("[data-close]").forEach((b) => b.onclick = closeModal);
    $("#confirmYes").onclick = onYes;
  }

  /* ============ đăng nhập / đăng ký ============ */
  function openAuth(mode) {
    mode = mode === "signup" ? "signup" : "signin";
    const tab = (m, l) => `<button class="auth-tab ${mode === m ? "active" : ""}" data-authtab="${m}">${l}</button>`;
    const nameField = mode === "signup" ? `<div class="field"><label>Họ và tên</label><input id="auTen" placeholder="VD: Nguyễn Văn A" autocomplete="name"></div>` : "";
    const teacherNote = mode === "signup" ? `<div class="auth-note">${ico("board")} Tài khoản giảng viên do N9 trực tiếp cấp sau khi hợp tác — không đăng ký công khai tại đây.</div>` : "";
    openModal(`
      <div class="modal-card auth-card">
        <button class="modal-close" data-close aria-label="Đóng">✕</button>
        <div class="auth-brand"><svg class="mark" viewBox="0 0 40 40" aria-hidden="true"><rect class="mk-bg" width="40" height="40" rx="12"/><text class="mk-txt" x="21" y="27.5" text-anchor="middle"><tspan class="mk-n">N</tspan><tspan class="mk-9">9</tspan></text></svg>N9</div>
        <div class="auth-tabs">${tab("signin", "Đăng nhập")}${tab("signup", "Đăng ký")}</div>
        <div class="auth-err" id="auErr" hidden></div>
        <form id="authForm" novalidate>
          ${nameField}
          <div class="field"><label>Email</label><input id="auEmail" type="email" placeholder="ban@email.com" autocomplete="email"></div>
          <div class="field"><label>Mật khẩu</label><input id="auPass" type="password" placeholder="${mode === "signup" ? "Tối thiểu 8 ký tự, gồm chữ và số" : "Nhập mật khẩu"}" autocomplete="${mode === "signup" ? "new-password" : "current-password"}"></div>
          <button class="btn btn-primary btn-block btn-lg" type="submit" id="auSubmit">${mode === "signup" ? "Tạo tài khoản" : "Đăng nhập"}</button>
        </form>
        ${teacherNote}
        <div class="auth-switch">${mode === "signin" ? `Chưa có tài khoản? <button type="button" data-authtab="signup">Đăng ký ngay</button>` : `Đã có tài khoản? <button type="button" data-authtab="signin">Đăng nhập</button>`}</div>
      </div>`);
    $$("[data-close]").forEach((b) => b.onclick = closeModal);
    $$("[data-authtab]").forEach((b) => b.onclick = () => openAuth(b.dataset.authtab));
    $("#authForm").onsubmit = (e) => { e.preventDefault(); mode === "signup" ? doSignup() : doSignin(); };
  }
  function authErr(msg) { const e = $("#auErr"); if (e) { e.textContent = msg; e.hidden = false; } }
  // chính sách mật khẩu MỚI (khớp máy chủ): 8–72 byte, có cả chữ lẫn số. Đăng nhập thì không kiểm tra (tài khoản cũ vẫn vào được).
  function pwProblem(p) {
    if (p.length < 8) return "Mật khẩu phải từ 8 ký tự trở lên.";
    if (new TextEncoder().encode(p).length > 72) return "Mật khẩu quá dài (tối đa 72 byte).";
    if (!/[A-Za-zÀ-ỹ]/.test(p) || !/\d/.test(p)) return "Mật khẩu cần có cả chữ và số.";
    return "";
  }
  async function doSignin() {
    const email = $("#auEmail").value.trim(), matKhau = $("#auPass").value;
    if (!email || !matKhau) return authErr("Vui lòng nhập email và mật khẩu.");
    const btn = $("#auSubmit"); btn.disabled = true; btn.textContent = "Đang đăng nhập...";
    try {
      const { token, user } = await API.login({ email, matKhau });
      resetCaches(); AUTH.set(user, token); closeModal(); renderNav();
      COURSES = await API.listCourses().catch(() => COURSES); // nạp lại theo quyền mới (giảng viên thấy cả khóa nháp của mình)
      toast(`Xin chào ${user.ten.split(" ").pop()}! 👋`);
      await go(landingFor(user.role));
    } catch (err) { authErr(err.message); btn.disabled = false; btn.textContent = "Đăng nhập"; }
  }
  function landingFor(role) { return role === "teacher" ? "manage" : role === "admin" ? "admin" : "home"; }
  async function doSignup() {
    const hoTen = $("#auTen").value.trim(), email = $("#auEmail").value.trim(), matKhau = $("#auPass").value;
    if (!hoTen) return authErr("Vui lòng nhập họ tên.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return authErr("Email không hợp lệ.");
    const pwErr = pwProblem(matKhau); if (pwErr) return authErr(pwErr);
    const btn = $("#auSubmit"); btn.disabled = true; btn.textContent = "Đang tạo...";
    try {
      const { token, user } = await API.register({ hoTen, email, matKhau });
      resetCaches(); AUTH.set(user, token); closeModal(); renderNav();
      toast("Tạo tài khoản thành công! 🎉");
      await go("home");
    } catch (err) { authErr(err.message); btn.disabled = false; btn.textContent = "Tạo tài khoản"; }
  }
  function signout() {
    closeAvatarMenu(); AUTH.clear(); resetCaches(); renderNav(); toast("Đã đăng xuất");
    API.listCourses().then((l) => { COURSES = l; }).catch(() => {}).then(() => go("home"));
  }
  // phiên không còn dùng được (hết hạn / mật khẩu đã đổi ở nơi khác / tài khoản bị khóa hay xóa) → đăng xuất ngay thay vì để người dùng gặp lỗi lẻ tẻ
  API.onSessionLost((err) => {
    if (!AUTH.user) return; // nhiều yêu cầu cùng hỏng một lúc: chỉ xử lý một lần
    const why = {
      ACCOUNT_SUSPENDED: "Tài khoản của bạn đã bị khóa. Liên hệ quản trị viên để biết thêm.",
      TOKEN_REVOKED: "Mật khẩu đã được đổi — vui lòng đăng nhập lại.",
      ACCOUNT_GONE: "Tài khoản không còn tồn tại.",
    }[err.code] || "Phiên đăng nhập đã hết hạn — vui lòng đăng nhập lại.";
    closeAvatarMenu(); closeModal(); AUTH.clear(); resetCaches(); QUIZ = null; renderNav();
    API.listCourses().then((l) => { COURSES = l; }).catch(() => {})
      .then(() => go("home"))
      .then(() => { toast(why); if (err.code !== "ACCOUNT_SUSPENDED") openAuth("signin"); });
  });

  /* ============ router ============ */
  const NEEDS_AUTH = { manage: 1, manageLessons: 1, profile: 1, quiz: 1, admin: 1, learn: 1 };
  // thanh tải mỏng trên cùng chạy suốt lúc chuyển trang / nạp dữ liệu
  async function go(view, param, tab) {
    topbar.start();
    try { await goCore(view, param, tab); } finally { topbar.done(); }
  }
  let firstRender = true;
  // chi tiết khóa + bài kiểm tra + trạng thái đăng ký của người xem (gọi lại sau khi đăng ký/thanh toán để mở khóa video)
  async function loadDetail(maKH) {
    const c = await API.getCourse(maKH);
    c.quizzes = await API.listQuizzes(maKH).catch(() => []);
    c._enroll = (AUTH.user && AUTH.user.role === "student")
      ? await API.getEnrollment(maKH).catch(() => ({ enrolled: false }))
      : { enrolled: false };
    return c;
  }
  let navSeq = 0; // mỗi lần điều hướng một số thứ tự: bấm liên tiếp thì chỉ lần mới nhất được vẽ (lần cũ về trễ không đè lên)
  async function goCore(view, param, tab) {
    if (QUIZ && QUIZ.timer) { clearInterval(QUIZ.timer); }
    if (NEEDS_AUTH[view] && !AUTH.user) { openAuth("signin"); return; }
    if (view === "learn" && !isStudent()) { toast("Khu vực dành cho học viên"); return; }
    if ((view === "manage" || view === "manageLessons") && (!AUTH.user || AUTH.user.role !== "teacher")) { toast("Khu vực dành cho giảng viên"); return; }
    if (view === "admin" && (!AUTH.user || AUTH.user.role !== "admin")) { toast("Khu vực dành cho quản trị viên"); return; }
    const seq = ++navSeq;
    // bài kiểm tra: nạp TRƯỚC khi đổi màn hình — bị từ chối (chưa thanh toán, đang chờ giữa 2 lượt làm…) thì ở lại trang hiện tại
    let quizData = null;
    if (view === "quiz") {
      try { quizData = await API.getQuiz(param); }
      catch (e) { toast(e.message); return; }
      if (seq !== navSeq) return;
    }
    // cùng trang (chỉ đổi tab) → giữ nguyên màn hình cũ trong lúc nạp, không chớp skeleton; chỉ phần nội dung chuyển động
    const sameView = !firstRender && nav.view === view && (nav.param || null) === (param || null);
    // chuyển sang trang khác: trang cũ mờ dần NGAY trong lúc nạp dữ liệu; khung chờ (skeleton) chỉ hiện nếu nạp lâu, để chuyển trang nhanh không bị chớp
    const leaving = !sameView && !firstRender ? MO.leave() : Promise.resolve();
    let skelT = 0;
    const busy = () => { if (!sameView && !skelT) skelT = setTimeout(() => { if (seq === navSeq) app.innerHTML = loadingHTML(); }, 300); };
    nav.view = view; nav.param = param || null; nav.tab = tab || "curr"; nav.lesson = pendingLesson; pendingLesson = null;
    if (!sameView) renderNav(); // mục đang chọn của sidebar trượt sang chỗ mới ngay khi bấm
    if (view === "detail" || view === "manageLessons") {
      busy();
      try { detailCache = await loadDetail(param); }
      catch (e) { detailCache = null; toast(e.message); }
    }
    if (view === "quiz") initQuiz(quizData);
    if (view === "manage") {
      nav.mtab = tab || nav.mtab || "overview";
      if (!TEACH.overview) { try { TEACH.overview = await API.teacherOverview(); } catch (e) { toast(e.message); } }
      if (nav.mtab === "reviews" && !TEACH.reviews) { try { TEACH.reviews = await API.teacherReviews(); } catch (e) {} }
    }
    if (view === "admin") {
      nav.atab = tab || nav.atab || "overview";
      busy();
      try { await loadAdminTab(nav.atab); } catch (e) { toast(e.message); }
    }
    if (view === "profile") {
      busy();
      try { PROFILE = await API.getProfile(); } catch (e) { PROFILE = null; toast(e.message); }
    }
    if (view === "learn") {
      if (!tab) STU.overview = null; // vào từ menu → luôn nạp lại số liệu mới nhất
      nav.ltab = tab || nav.ltab || "overview";
      busy();
      try { await loadLearnTab(nav.ltab); } catch (e) { toast(e.message); }
    }
    if (view === "honor") {
      nav.htab = tab || nav.htab;
      busy();
      try { await loadHonor(true); } catch (e) { HONOR = null; toast(e.message); }
    }
    if ((view === "home" || view === "catalog") && isStudent() && !STU.overview) { try { STU.overview = await API.studentOverview(); } catch (e) { /* trang chủ vẫn dùng được khi chưa có dữ liệu học tập */ } }
    clearTimeout(skelT);
    await leaving;
    if (seq !== navSeq) return;
    if (!sameView) window.scrollTo({ top: 0, behavior: "instant" });
    render(sameView ? "content" : "page"); firstRender = false; renderNav();
    closeSide();
    MO.intro(); // lần vẽ đầu tiên xong: sidebar + thanh trên trượt vào (các lần sau không làm gì)
  }
  /* emoji còn sót trong khuôn HTML → đổi sang biểu tượng SVG cùng bộ (nhìn đồng nhất, đổi màu theo giao diện) */
  const EMOJI_ICON = {
    "📚": "book", "📖": "book", "🏠": "home", "🏆": "trophy", "📝": "list", "📋": "list", "🏅": "award", "💳": "card", "🎓": "cap", "👥": "users",
    "⭐": "star", "🎯": "target", "⚡": "bolt", "✅": "check-circle", "🚀": "bolt", "🏁": "trophy", "📊": "chart", "🧑‍🏫": "board", "🛡": "shield",
    "🧪": "flask", "🔒": "lock", "🔓": "lock", "✏": "edit", "🗑": "trash", "🔎": "search", "🔍": "search", "⚠": "info", "🎬": "play", "⏱": "clock",
    "⏳": "clock", "👤": "user", "🎉": "sparkle", "✦": "sparkle", "🔥": "flame", "💰": "wallet", "🧾": "receipt", "▶": "play", "✓": "check",
    "🏦": "wallet", "👛": "wallet", "🔑": "key", "📈": "trend", "🔁": "bolt", "👑": "crown", "🌏": "globe", "🌐": "globe",
  };
  const EMOJI_LEAD = new RegExp("^(" + Object.keys(EMOJI_ICON).sort((a, b) => b.length - a.length).join("|") + ")\\uFE0F?\\s*");
  const EMOJI_BOX = ".es-ic,.kpi .ic,.g-ic,.tl-ic,.tq-ic,.pm-ic,.pic,.mq-ic,.qi-ic,.lk-ic,.qr-badge,.seal,.stu-done>span,.cel-emoji,.qt-ic,.pod-crown,.rc-star";
  const EMOJI_LABEL = ".tabs button,.seg button,.chip,.btn,.menu-item,.panel h3,.pill,.eyebrow,.lc-chips span,.qi-meta span,.mng-meta span,.rk-sub,.rsm-sub,.lc-mid .gv,.admin-alert,.rc-err,.lb-done,.sub-h,.go-link,.auth-note";
  // bảng rộng cuộn ngang trong khung riêng, không làm tràn cả trang (nhất là trên điện thoại)
  function wrapTables(root) {
    $$("table.data-table", root).forEach((t) => {
      if (t.parentElement.classList.contains("tbl-wrap")) return;
      const w = document.createElement("div"); w.className = "tbl-wrap";
      t.parentNode.insertBefore(w, t); w.appendChild(t);
    });
  }
  function iconize(root) {
    if (!root) return;
    $$(EMOJI_BOX, root).forEach((el) => {
      if (el.children.length) return;
      const n = EMOJI_ICON[el.textContent.trim().replace(/️/g, "")];
      if (n) el.innerHTML = ico(n);
    });
    $$(EMOJI_LABEL, root).forEach((el) => {
      const t = [...el.childNodes].find((x) => x.nodeType === 3 && x.nodeValue.trim());
      if (!t) return;
      const m = t.nodeValue.match(EMOJI_LEAD); if (!m) return;
      const tpl = document.createElement("template"); tpl.innerHTML = ico(EMOJI_ICON[m[1]]);
      t.nodeValue = t.nodeValue.slice(m[0].length);
      const svg = tpl.content.firstChild;
      if (!/flex|grid/.test(getComputedStyle(el).display)) svg.classList.add("ico-lead");
      t.parentNode.insertBefore(svg, t);
    });
  }
  // mode: "page" = vào trang mới (hiệu ứng đầy đủ) · "content" = đổi nội dung trong cùng trang · không truyền = vẽ lại tại chỗ, KHÔNG animation
  function render(mode) {
    const map = { home: viewHome, catalog: viewCatalog, detail: viewDetail, quiz: viewQuiz, manage: viewManage, manageLessons: viewManageLessons, profile: viewProfile, admin: viewAdmin, learn: viewLearn, honor: viewHonor };
    const cls = mode && !REDUCED ? ` anim-on${mode === "page" ? " anim-page" : ""}` : "";
    app.innerHTML = `<div class="view${cls}">${(map[nav.view] || viewHome)()}</div>`;
    wire(); iconize(app); wrapTables(app);
    requestAnimationFrame(() => $$("[data-w]").forEach((el) => { el.style.width = el.dataset.w; }));
    if (nav.view === "quiz" && QUIZ && !QUIZ.result) startQuizTimer();
    // phải chạy TRƯỚC playEnter: ảnh bìa "bay" từ thẻ khóa học đo vị trí đích khi bố cục còn nguyên (chưa bị hiệu ứng vào trang xê dịch)
    MO.afterRender({ mode, view: nav.view, key: nav.view + ":" + (nav.param || "") });
    if (nav.view === "home") { MO.typewriter($("#homeQ"), publishedCourses().slice(0, 6).map((c) => c.TenKH)); fillHonorRail(); }
    if (cls) playEnter(mode);
  }

  /* ============ card khóa học ============ */
  function cardHTML(c) {
    const th = themeOf(c), rating = c.DiemTB != null ? Number(c.DiemTB) : null, free = !(Number(c.HocPhi) > 0);
    return `
    <article class="ccard" data-open="${c.MaKH}" tabindex="0" role="link" aria-label="${esc(c.TenKH)}">
      <div class="thumb" style="background:${th.grad}">
        ${isStudent() && enrolledSet().has(c.MaKH) ? `<span class="enr-ribbon">Đã đăng ký</span>` : ""}
        <span class="cat-tag">${esc(c.LinhVuc)}</span>
        <span class="lvl-tag">${esc(levelOf(c))}</span>
        <span class="glyph">${th.glyph}</span>
      </div>
      <div class="body">
        <div class="rating">${rating != null ? `<span class="stars">${ratingTxt(rating)}</span><span class="muted rcount">(${c.SoDanhGia || 0})</span>` : `<span class="muted">Chưa có đánh giá</span>`}${c.TrangThai && c.TrangThai !== "published" ? statusBadge(c.TrangThai) : ""}</div>
        <h3>${esc(c.TenKH)}</h3>
        <div class="gv"><span class="gv-ava">${esc((c.TenGV || "?").split(" ").pop()[0])}</span>${esc(c.TenGV)}</div>
        <div class="metarow">
          <span>${ico("layers")} ${c.SoBaiHoc || 0} bài học</span>
          <span>${ico("users")} ${Number(c.SoHocVien || 0).toLocaleString("vi-VN")}</span>
        </div>
        <div class="foot">
          <span class="price${free ? " free" : ""}">${free ? "Miễn phí" : vnd(c.HocPhi)}</span>
          <span class="go-link">Chi tiết ${ico("arrow-r")}</span>
        </div>
      </div>
    </article>`;
  }

  /* ============ VIEW: HOME ============ */
  const catIcon = (name) => { const t = THEMES[themeKey({ LinhVuc: name })]; return [t.icon, t.c]; };
  const publishedCourses = () => COURSES.filter((c) => c.TrangThai === "published");
  // Điểm xếp hạng khóa học = trung bình có trọng số: (v·R + m·C) / (v + m)  — R: điểm TB của khóa, v: số lượt đánh giá,
  // C: điểm TB toàn nền tảng, m = 5. Ít lượt đánh giá thì điểm bị kéo về mức chung nên không thể "1 sao 5 điểm" lên đỉnh.
  const RATING_M = 5;
  function ratingMean() {
    let n = 0, t = 0;
    publishedCourses().forEach((c) => { const v = Number(c.SoDanhGia) || 0; if (v && c.DiemTB != null) { n += v; t += Number(c.DiemTB) * v; } });
    return n ? t / n : 4;
  }
  const ratingScore = (c, C) => { const v = Number(c.SoDanhGia) || 0; return v && c.DiemTB != null ? (v * Number(c.DiemTB) + RATING_M * C) / (v + RATING_M) : -1; };
  function byRating(list) {
    const C = ratingMean(), num = (v) => Number(v) || 0;
    return list.slice().sort((a, b) => ratingScore(b, C) - ratingScore(a, C) || num(b.SoHocVien) - num(a.SoHocVien));
  }
  const topRated = (n) => byRating(publishedCourses()).slice(0, n);
  // hình khối kính 3 lớp + quả cầu ở thẻ "Nổi bật"
  const artSlab = (cy) => `<g><path d="M44 ${cy}L100 ${cy + 26}V${cy + 38}L44 ${cy + 12}Z" fill="url(#art-l)" stroke="rgba(255,255,255,.35)"/><path d="M100 ${cy + 26}L156 ${cy}V${cy + 12}L100 ${cy + 38}Z" fill="url(#art-r)" stroke="rgba(255,255,255,.35)"/><path d="M100 ${cy - 26}L156 ${cy}L100 ${cy + 26}L44 ${cy}Z" fill="url(#art-t)" stroke="rgba(255,255,255,.6)"/></g>`;
  const ART_SVG = `<svg class="art" viewBox="0 0 200 172" aria-hidden="true"><defs>
    <linearGradient id="art-t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".72"/><stop offset="1" stop-color="#C4B5FD" stop-opacity=".34"/></linearGradient>
    <linearGradient id="art-l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7C6CFF" stop-opacity=".8"/><stop offset="1" stop-color="#4338CA" stop-opacity=".55"/></linearGradient>
    <linearGradient id="art-r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A78BFA" stop-opacity=".85"/><stop offset="1" stop-color="#6D28D9" stop-opacity=".6"/></linearGradient>
    <radialGradient id="art-b" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#C4B5FD"/><stop offset="1" stop-color="#6366F1"/></radialGradient></defs>
    <ellipse cx="100" cy="160" rx="58" ry="8" fill="#6366F1" opacity=".28"/>${artSlab(118)}${artSlab(92)}${artSlab(66)}
    <circle cx="130" cy="34" r="15" fill="url(#art-b)"/><ellipse cx="125" cy="28" rx="5" ry="3" fill="#fff" opacity=".7"/></svg>`;

  // biểu đồ đường 7 ngày gần nhất từ dòng hoạt động của học viên
  function weekSpark(list) {
    const days = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i); days.push(d.getTime()); }
    const cnt = days.map(() => 0);
    (list || []).forEach((h) => { const t = new Date(String(h.ThoiGian).replace(" ", "T")); if (isNaN(t)) return; t.setHours(0, 0, 0, 0); const i = days.indexOf(t.getTime()); if (i >= 0) cnt[i]++; });
    const total = cnt.reduce((a, b) => a + b, 0);
    if (!total) return "";
    const W = 240, H = 56, pad = 4, max = Math.max(1, ...cnt);
    const pts = cnt.map((v, i) => [pad + (i * (W - 2 * pad)) / 6, H - pad - (v / max) * (H - 2 * pad - 8)]);
    const line = pts.map((p, i) => i === 0 ? `M${p[0].toFixed(1)} ${p[1].toFixed(1)}` : `C${((pts[i - 1][0] + p[0]) / 2).toFixed(1)} ${pts[i - 1][1].toFixed(1)} ${((pts[i - 1][0] + p[0]) / 2).toFixed(1)} ${p[1].toFixed(1)} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("");
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Hoạt động 7 ngày qua"><path class="sf" d="${line}L${W - pad} ${H}L${pad} ${H}Z"/><path class="sl" pathLength="1" d="${line}"/></svg><div class="spark-cap"><span>7 ngày qua</span><span>Hôm nay</span></div>`;
  }

  function homeTiles() {
    const role = AUTH.user ? AUTH.user.role : null, n = publishedCourses().length;
    const T = (ic, col, t, s, attr) => `<button class="tile" ${attr}><div><div class="tile-t">${t}</div><div class="tile-s">${s}</div></div><span class="tile-ic" style="--c:${col}">${ico(ic)}</span></button>`;
    if (role === "student") {
      const ov = STU.overview, r = activeCourses()[0], k = ov ? ov.kpi : null;
      const todo = ov ? activeCourses().reduce((s, c) => s + Math.max(0, c.SoBaiKT - c.SoBaiKTDaLam), 0) : 0;
      return [
        r ? T("play", "#A78BFA", "Tiếp tục<br>học", `${Math.round(r.TienDoPhanTram)}% · ${r.SoBaiHoanThanh}/${r.TongSoBai} bài`, `data-resume="${r.MaKH}:${r.BaiTiepTheo ? r.BaiTiepTheo.MaBH : ""}"`)
          : T("compass", "#A78BFA", "Khám phá<br>khóa học", `${n} khóa học`, 'data-go="catalog"'),
        T("list", "#F59E0B", "Làm bài<br>kiểm tra", todo ? `${todo} bài đang chờ` : "Xem kết quả", 'data-ltab="results"'),
        T("trophy", "#F472B6", "Bảng<br>xếp hạng", "Thứ hạng của bạn", 'data-ltab="board"'),
        T("award", "#34D399", "Chứng chỉ", k ? `${k.ChungChi} đã nhận` : "Thành tích", 'data-ltab="certs"'),
      ].join("");
    }
    if (role === "teacher") {
      return [
        T("layers", "#A78BFA", "Khóa học<br>của tôi", `${myCourses().length} khóa học`, 'data-nav-go="manage:courses"'),
        T("chart", "#22D3EE", "Học viên &<br>doanh thu", "Xem thống kê", 'data-nav-go="manage:overview"'),
        T("star", "#FBBF24", "Đánh giá", "Phản hồi từ học viên", 'data-nav-go="manage:reviews"'),
        T("plus", "#34D399", "Thêm<br>khóa học", "Tạo khóa học mới", "data-add-course"),
      ].join("");
    }
    if (role === "admin") {
      return [
        T("grid", "#A78BFA", "Tổng quan", "Số liệu hệ thống", 'data-nav-go="admin:overview"'),
        T("board", "#22D3EE", "Giảng viên", "Cấp & quản lý tài khoản", 'data-nav-go="admin:teachers"'),
        T("book", "#FBBF24", "Duyệt<br>khóa học", "Nháp → công khai", 'data-nav-go="admin:courses"'),
        T("chart", "#F472B6", "Báo cáo", "Truy vấn & thống kê", 'data-nav-go="admin:khoahoc-theo-thang"'),
      ].join("");
    }
    return [
      T("compass", "#A78BFA", "Khám phá<br>khóa học", `${n} khóa học`, 'data-go="catalog"'),
      T("bolt", "#34D399", "Học thử<br>miễn phí", "Học phí thấp nhất", "data-home-free"),
      T("trophy", "#F472B6", "Xếp hạng<br>đánh giá", "Khóa được yêu thích", "data-rank-view"),
      T("award", "#FBBF24", "Nhận<br>chứng chỉ", "Đăng ký để bắt đầu", 'data-auth="signup"'),
    ].join("");
  }

  function railHTML() {
    const role = AUTH.user ? AUTH.user.role : null, pub = publishedCourses();
    const num = (v) => Number(v) || 0;
    const best = topRated(1)[0] || pub[0];
    const ranked = byRating(pub.filter((c) => c.DiemTB != null)).slice(0, 5);
    const feat = best ? `<article class="rcard rc-feature">
        <div class="rf-tag">Nổi bật ${ico("sparkle")}</div>
        <h4>${esc(best.TenKH)}</h4>
        <p>${esc(best.TenGV || "")}${best.DiemTB != null ? ` · ${ratingTxt(best.DiemTB)}` : ""}</p>
        <button class="btn btn-primary btn-sm rf-go" data-open="${best.MaKH}">Xem khóa học ${ico("arrow-r")}</button>
        ${ART_SVG}
      </article>` : "";
    const rank = `<article class="rcard">
        <div class="rc-head"><span title="Xếp theo điểm đánh giá có trọng số: khóa ít lượt đánh giá không thể vượt khóa được nhiều người đánh giá cao">Xếp hạng đánh giá</span><button class="lnk" data-rank-view>Xem tất cả</button></div>
        ${ranked.length ? ranked.map((c, i) => `<button class="rk" data-open="${c.MaKH}"><span class="rk-n r${i + 1}">${i + 1}</span><span class="rk-t">${esc(c.TenKH)}<small>${esc(c.TenGV || "")} · ${num(c.SoHocVien)} học viên</small></span><span class="rk-r">${ratingTxt(c.DiemTB)}<small>(${num(c.SoDanhGia)})</small></span></button>`).join("") : `<p class="muted" style="font-size:.84rem">Chưa có đánh giá nào — hãy là người đầu tiên.</p>`}
      </article>`;
    const honor = `<article class="rcard" id="honorRail"><div class="rc-head"><span>Vinh danh</span><button class="lnk" data-go="honor">Xem tất cả</button></div>${inlineLoading()}</article>`;
    let act = "";
    if (role === "student" && STU.overview) {
      const k = STU.overview.kpi;
      act = `<article class="rcard"><div class="rc-head"><span>Hoạt động của bạn</span><button class="lnk" data-go="learn">Chi tiết</button></div>
        <div class="stat-row"><span>Bài đã học</span><b>${k.SoBaiDaHoc}</b></div>
        <div class="stat-row"><span>Lần làm bài kiểm tra</span><b>${k.SoLanLamBai}</b></div>
        <div class="stat-row"><span>Điểm trung bình</span><b>${fmtScore(k.DiemTB)}</b></div>
        ${weekSpark(STU.overview.hoatDong)}</article>`;
    } else if (role === "teacher") {
      const mine = myCourses(), rated = mine.filter((c) => c.DiemTB != null);
      act = `<article class="rcard"><div class="rc-head"><span>Giảng dạy của bạn</span><button class="lnk" data-nav-go="manage:overview">Chi tiết</button></div>
        <div class="stat-row"><span>Khóa học</span><b>${mine.length}</b></div>
        <div class="stat-row"><span>Lượt học viên</span><b>${mine.reduce((s, c) => s + num(c.SoHocVien), 0)}</b></div>
        <div class="stat-row"><span>Đánh giá trung bình</span><b>${rated.length ? ratingTxt(rated.reduce((s, c) => s + num(c.DiemTB), 0) / rated.length) : "—"}</b></div></article>`;
    } else {
      act = `<article class="rcard"><div class="rc-head"><span>N9 trong con số</span></div>
        <div class="stat-row"><span>Khóa học</span><b>${pub.length}</b></div>
        <div class="stat-row"><span>Bài học</span><b>${pub.reduce((s, c) => s + num(c.SoBaiHoc), 0)}</b></div>
        <div class="stat-row"><span>Lượt học</span><b>${pub.reduce((s, c) => s + num(c.SoHocVien), 0)}</b></div></article>`;
    }
    const CTA = (ic, t, s, attr) => `<button class="rcard rc-cta" ${attr}><span class="ic">${ico(ic)}</span><span><b>${t}</b><span>${s}</span></span>${ico("chev-r")}</button>`;
    const cta = role === "student" ? CTA("award", "Chứng chỉ của bạn", STU.overview ? `${STU.overview.kpi.ChungChi} đã nhận · hoàn thành khóa để nhận thêm` : "Hoàn thành khóa để nhận chứng chỉ", 'data-ltab="certs"')
      : role === "teacher" ? CTA("plus", "Thêm khóa học mới", "Chia sẻ kiến thức với học viên N9", "data-add-course")
      : role === "admin" ? CTA("shield", "Trang quản trị", "Theo dõi toàn bộ hệ thống", 'data-nav-go="admin:overview"')
      : CTA("sparkle", "Đăng ký miễn phí", "Học, theo dõi tiến độ & nhận chứng chỉ", 'data-auth="signup"');
    return feat + rank + honor + act + cta;
  }

  // tiêu đề hero tách từng từ để chữ hiện lần lượt (mỗi từ là một khối inline-block; "Đừng ngủ" giữ nền gradient chuyển động)
  const heroTitle = () => [["Đừng ngủ", "em"], ["khi"], ["đối"], ["thủ"], ["còn"], ["đang"], ["thức"]]
    .map(([w, c], i) => `<span class="hw${c ? " " + c : ""}" style="--i:${i}">${w}</span>`).join(" ");
  function viewHome() {
    const pub = publishedCourses(), top = topRated(6);
    const cats = [...new Set(pub.map((c) => c.LinhVuc).filter(Boolean))].slice(0, 4);
    const chips = cats.map((c) => { const [ic, col] = catIcon(c); return `<button class="chip" data-home-cat="${esc(c)}" style="--c:${col}">${ico(ic)} ${esc(c)}</button>`; }).join("")
      + `<button class="chip" data-go="catalog" style="--c:#A78BFA">${ico("dots")} Tất cả</button>`;
    const lessons = pub.reduce((s, c) => s + (c.SoBaiHoc || 0), 0), learners = pub.reduce((s, c) => s + Number(c.SoHocVien || 0), 0);
    return `
    <section class="wrap home">
      <div class="home-main">
        <header class="home-hero">
          <span class="hero-badge"><b>N9</b> Nền tảng học trực tuyến</span>
          <h1 aria-label="Đừng ngủ khi đối thủ còn đang thức">${heroTitle()}</h1>
          <p class="lead">Thầy xịn, bài mịn, học là nghiền !</p>
          <form class="composer" id="homeSearch" role="search">
            <input id="homeQ" type="text" placeholder="Hôm nay bạn muốn học gì? Tìm khóa học, giảng viên, chủ đề…" autocomplete="off" aria-label="Tìm khóa học">
            <div class="composer-foot">
              <button type="button" class="cmp-ic" data-go="catalog" aria-label="Duyệt tất cả khóa học" title="Duyệt tất cả khóa học">${ico("filter")}</button>
              <span class="cmp-hint">${pub.length} khóa học · ${lessons} bài học · ${learners} lượt học</span>
              <button class="cmp-go" type="submit" aria-label="Tìm kiếm">${ico("arrow-r")}</button>
            </div>
          </form>
          <div class="cat-chips">${chips}</div>
        </header>
        <div class="tiles">${homeTiles()}</div>
        ${isStudent() ? resumeStrip() : ""}
        <section class="home-sec">
          <div class="sec-head"><div><span class="eyebrow">Được yêu thích</span><h2>Khóa học nổi bật</h2></div>
            <button class="btn btn-ghost btn-sm" data-go="catalog">Xem tất cả ${ico("arrow-r")}</button></div>
          ${top.length ? `<div class="course-grid">${top.map(cardHTML).join("")}</div>` : emptyCourses()}
        </section>
      </div>
      <aside class="rail">${railHTML()}</aside>
    </section>`;
  }
  function emptyCourses() {
    return `<div class="empty-state"><div class="es-ic">📚</div><h3>Chưa có khóa học</h3><p>Hãy đăng nhập bằng tài khoản giảng viên để tạo khóa học đầu tiên.</p></div>`;
  }

  /* ============ VIEW: CATALOG ============ */
  let catState = { cat: "all", q: "", sort: "new" };
  const SORTS = [["new", "Mới nhất"], ["rating", "Đánh giá cao"], ["popular", "Nhiều học viên"], ["price_asc", "Học phí tăng dần"], ["price_desc", "Học phí giảm dần"]];
  function catList() {
    const t = fold(catState.q), num = (v) => Number(v) || 0;
    const list = COURSES.filter((c) => (catState.cat === "all" || c.LinhVuc === catState.cat) && (t === "" || fold(`${c.TenKH} ${c.TenGV || ""} ${c.LinhVuc || ""}`).includes(t)));
    const C = ratingMean();
    const by = {
      rating: (a, b) => ratingScore(b, C) - ratingScore(a, C) || num(b.SoHocVien) - num(a.SoHocVien),
      popular: (a, b) => num(b.SoHocVien) - num(a.SoHocVien),
      price_asc: (a, b) => num(a.HocPhi) - num(b.HocPhi),
      price_desc: (a, b) => num(b.HocPhi) - num(a.HocPhi),
    }[catState.sort];
    return by ? list.slice().sort(by) : list;
  }
  const catGridHTML = () => {
    const list = catList();
    return list.length ? `<div class="course-grid">${list.map(cardHTML).join("")}</div>`
      : `<div class="empty-state"><div class="es-ic">${ico("search")}</div><h3>Không tìm thấy khóa học</h3><p>Thử từ khóa hoặc danh mục khác.</p></div>`;
  };
  // gõ tìm / đổi sắp xếp: chỉ thay phần lưới, giữ nguyên ô nhập (không mất con trỏ, không ngắt bộ gõ tiếng Việt)
  function refreshCatalog() { const g = $("#catGrid"); if (!g) return; g.innerHTML = catGridHTML(); wire(); }
  function viewCatalog() {
    const cats = ["all", ...new Set(COURSES.map((c) => c.LinhVuc).filter(Boolean))];
    return `
    <section class="wrap" style="padding-top:12px">
      <div class="sec-head"><div><span class="eyebrow">Thư viện khóa học</span><h2>Khám phá ${COURSES.length} khóa học</h2></div></div>
      <div class="searchbar">${ico("search")}<input id="searchBox" type="text" value="${esc(catState.q)}" placeholder="Tìm theo tên khóa học, giảng viên hoặc lĩnh vực…" autocomplete="off" aria-label="Tìm khóa học"></div>
      <div class="cat-bar">
        <div class="chips">${cats.map((c) => { const [ic, col] = c === "all" ? ["sparkle", "#A78BFA"] : catIcon(c); return `<button class="chip ${catState.cat === c ? "active" : ""}" data-cat="${esc(c)}" style="--c:${col}">${ico(ic)} ${c === "all" ? "Tất cả" : esc(c)}</button>`; }).join("")}</div>
        <label class="sort">Sắp xếp<select class="sort-sel" id="sortSel" aria-label="Sắp xếp khóa học">${SORTS.map(([v, l]) => `<option value="${v}" ${catState.sort === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      </div>
      <div id="catGrid">${catGridHTML()}</div>
    </section>`;
  }

  /* ============ VIEW: VINH DANH ============ */
  let HONOR = null, HONOR_AT = 0;
  async function loadHonor(force) {
    if (force || !HONOR || Date.now() - HONOR_AT > 30000) { HONOR = await API.honors(); HONOR_AT = Date.now(); }
    return HONOR;
  }
  const HONOR_TABS = [["hocvien", "Học viên", "cap"], ["giangvien", "Giảng viên", "board"], ["khoahoc", "Khóa học", "book"]];
  function honorItem(it) {
    const course = it.kind === "khoa", r = Math.min(it.hang || 3, 3);
    return `<li class="hc-it${it.laToi ? " me" : ""}"${course ? ` data-open="${esc(it.id)}"` : ""}>
      <span class="rk-n r${r}">${it.hang}</span>
      <span class="hc-ava${course ? " course" : ""}">${course ? ico("book") : esc(initialsOf(it.ten))}</span>
      <span class="hc-name"><b>${esc(it.ten)}${it.laToi ? ` <span class="you">Bạn</span>` : ""}</b><small>${esc(it.phu || "")}</small></span>
      <span class="hc-val"><b>${esc(it.giaTri)}</b><small>${esc(it.nhan || "")}</small></span></li>`;
  }
  const honorCard = (s) => `<article class="hcard"><header><span class="hc-ic">${ico(s.icon)}</span><div><h3>${esc(s.ten)}</h3><p>${esc(s.moTa)}</p></div></header>
    ${s.items.length ? `<ol class="hc-list">${s.items.map(honorItem).join("")}</ol>` : `<p class="hc-empty">Chưa ai đạt danh hiệu này — có thể là bạn đấy!</p>`}</article>`;
  function viewHonor() {
    const H = HONOR;
    if (!H) return `<section class="wrap" style="padding-top:12px">${inlineLoading()}</section>`;
    const tab = nav.htab || (H.hocVien ? "hocvien" : "giangvien");
    const secs = tab === "hocvien" ? H.hocVien : tab === "giangvien" ? H.giangVien : H.khoaHoc;
    const when = new Date(H.capNhat).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
    return `
    <section class="wrap honor" style="padding-top:12px">
      <div class="learn-hero honor-hero">
        <span class="eyebrow">Vinh danh</span>
        <h2>Những cái tên toả sáng</h2>
        <p>Mỗi danh hiệu có tiêu chí riêng, tính tự động từ dữ liệu học tập thật. Khác bảng xếp hạng (một cuộc đua), ở đây ai đạt tiêu chí đều được ghi nhận.</p>
        <div class="honor-meta"><span>${ico("clock")} Cập nhật ${esc(when)}</span>${isStudent() ? `<button class="btn btn-ghost btn-sm" data-ltab="board">${ico("trophy")} Xem bảng xếp hạng</button>` : ""}</div>
      </div>
      <div class="tabs honor-tabs">${HONOR_TABS.map(([v, l, ic]) => `<button class="${tab === v ? "active" : ""}" data-htab="${v}">${ico(ic)} ${l}</button>`).join("")}</div>
      ${secs ? `<div class="honor-grid">${secs.map(honorCard).join("")}</div>`
        : `<div class="empty-state"><div class="es-ic">🔒</div><h3>Đăng nhập để xem vinh danh học viên</h3><p>Danh sách có tên người học nên chỉ hiện với thành viên N9.</p><button class="btn btn-accent" data-auth="signin">Đăng nhập</button></div>`}
    </section>`;
  }
  // thẻ Vinh danh ở cột phải trang chủ: nạp nền, có dữ liệu thì điền vào (lỗi thì gỡ thẻ, không làm hỏng trang)
  async function fillHonorRail() {
    if (!$("#honorRail")) return;
    try { await loadHonor(); } catch (e) { const el = $("#honorRail"); if (el) el.remove(); return; }
    const el = $("#honorRail"); if (!el || nav.view !== "home") return;
    const pick = (list, ma) => { const sec = (list || []).find((x) => x.ma === ma); return sec && sec.items[0] ? { sec, it: sec.items[0] } : null; };
    const H = HONOR, rows = (H.hocVien ? [pick(H.hocVien, "thu-khoa"), pick(H.hocVien, "cham-chi"), pick(H.giangVien, "gv-yeu-thich")]
      : [pick(H.giangVien, "gv-yeu-thich"), pick(H.khoaHoc, "kh-danh-gia"), pick(H.khoaHoc, "kh-dong-nhat")]).filter(Boolean);
    el.innerHTML = `<div class="rc-head"><span>Vinh danh</span><button class="lnk" data-go="honor">Xem tất cả</button></div>`
      + (rows.length ? rows.map(({ sec, it }) => `<button class="hr-row" data-go="honor"><span class="hr-ic">${ico(sec.icon)}</span><span class="hr-t"><small>${esc(sec.ten)}</small><b>${esc(it.ten)}</b></span><span class="hr-v">${esc(it.giaTri)}</span></button>`).join("")
        : `<p class="muted" style="font-size:.84rem">Chưa có danh hiệu nào — hãy học và làm bài kiểm tra để ghi tên mình!</p>`);
    $$("[data-go]", el).forEach((b) => b.onclick = () => go(b.dataset.go));
  }

  /* ============ VIEW: DETAIL ============ */
  // khung thay cho video khi chưa đủ quyền: nói rõ lý do + đúng một việc cần làm tiếp theo
  function videoLockHTML(c, q, th) {
    const free = !(Number(c.HocPhi) > 0);
    const M = {
      khach: ["Đăng nhập để xem bài giảng", "Tạo tài khoản học viên miễn phí, rồi đăng ký khóa học để bắt đầu.",
        `<button class="btn btn-accent" data-auth="signin">Đăng nhập</button><button class="btn btn-ghost" data-auth="signup">Tạo tài khoản</button>`],
      chua_dang_ky: ["Đăng ký khóa học để xem bài giảng", free ? "Khóa học miễn phí — đăng ký là học được ngay." : `Học phí ${vnd(c.HocPhi)} · truy cập trọn đời.`,
        `<button class="btn btn-accent" data-enroll>Đăng ký học ${ico("arrow-r")}</button>`],
      chua_thanh_toan: ["Thanh toán để mở khóa bài giảng", `Bạn đã đăng ký — thanh toán ${vnd(c.HocPhi)} để xem video và làm bài kiểm tra.`,
        `<button class="btn btn-accent" data-pay-detail="${esc(q.maDK)}">Thanh toán ngay ${ico("arrow-r")}</button>`],
      cho_duyet: ["Đang chờ admin xác nhận thanh toán", "Bạn đã gửi yêu cầu — nội dung sẽ mở ngay khi admin duyệt.", ""],
      khong_phai_hoc_vien: ["Video dành cho học viên đã đăng ký", "Tài khoản này chỉ xem được nội dung khóa học do chính mình phụ trách.", ""],
    }[q.lyDo] || ["Bài giảng đang được khóa", "", ""];
    return `<div class="video-lock" style="background:${th.grad}"><div class="vl-card"><span class="vl-ic">${ico("lock")}</span><b>${M[0]}</b><p>${M[1]}</p><div class="vl-act">${M[2]}</div></div></div>`;
  }
  function viewDetail() {
    const c = detailCache;
    if (!c) return `<section class="wrap" style="padding-top:12px"><button class="back-btn" data-go="catalog">${ico("arrow-r")} Quay lại</button><div class="empty-state"><div class="es-ic">⚠️</div><h3>Không tải được khóa học</h3></div></section>`;
    const th = themeOf(c), lessons = c.lessons || [], free = !(Number(c.HocPhi) > 0);
    // quyền xem video do MÁY CHỦ quyết định: chưa đủ quyền thì link video không được gửi xuống, chỉ có cờ coVideo
    const q = c.quyen || { xem: false, lyDo: "khach" };
    const hasVid = (l) => !!(l.coVideo || ytEmbed(l.VideoBaiGiang));
    if (!nav.lesson) { const f = lessons.find(hasVid); nav.lesson = f ? f.MaBH : (lessons[0] && lessons[0].MaBH); }
    const cur = lessons.find((l) => l.MaBH === nav.lesson);
    const embed = cur && q.xem ? ytEmbed(cur.VideoBaiGiang) : null;
    const en = isStudent() && c._enroll && c._enroll.enrolled ? c._enroll : null;
    const doneSet = new Set((en && en.daHoc) || []);
    let body;
    if (nav.tab === "instr") {
      body = `<div class="instr">
        <div class="big-ava">${esc((c.TenGV || "?").split(" ").slice(-2).map((w) => w[0]).join(""))}</div>
        <div><h3>${esc(c.TenGV)}</h3><div class="role">${esc(c.ChuyenMon || "Giảng viên")}</div>
        <p style="color:var(--ink-soft);font-size:.92rem">Giảng viên phụ trách khóa học "${esc(c.TenKH)}".</p></div></div>`;
    } else if (nav.tab === "quiz") {
      body = quizListHTML();
    } else {
      body = `
      ${embed ? `<div class="video-box"><iframe src="${embed}" title="Video bài giảng" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen></iframe></div>`
        : !q.xem && cur && hasVid(cur) ? videoLockHTML(c, q, th)
        : `<div class="video-ph" style="background:${th.grad}"><span class="glyph">${th.glyph}</span></div>`}
      ${en && q.xem && cur ? lessonActionBar(cur, lessons, doneSet) : ""}
      <h3 style="font-size:1.1rem;margin-bottom:12px">Nội dung khóa học · ${lessons.length} bài</h3>
      ${lessons.length ? `<div class="curr-sec">${lessons.map((l, i) => {
        const hasV = hasVid(l), lk = hasV && !q.xem, active = l.MaBH === nav.lesson, done = doneSet.has(l.MaBH);
        return `<div class="lesson-row${active ? " on" : ""}" data-lesson="${l.MaBH}" style="cursor:pointer">
          <div class="lesson-ic ${done ? "done" : hasV && !lk ? "" : "lock"}">${ico(done ? "check" : lk ? "lock" : hasV ? "play" : "file")}</div>
          <div class="lz"><b>${i + 1}. ${esc(l.TenBH)}</b><span>${lk ? "Mở khóa khóa học để xem video" : hasV ? "Video bài giảng" : "Chưa có video"}</span></div>
          <span class="dur">${ico("clock")} ${l.ThoiLuong || 0} phút</span></div>`;
      }).join("")}</div>` : `<p class="muted">Khóa học chưa có bài học nào.</p>`}`;
    }
    return `
    <section class="wrap" style="padding-top:12px">
      <button class="back-btn" data-go="catalog">${ico("arrow-r")} Quay lại danh sách</button>
      <div class="detail-hero">
        <div class="detail-main">
          <div class="cat-line"><span class="pill pine">${esc(c.LinhVuc)}</span><span class="pill apr">${esc(levelOf(c))}</span></div>
          <h1>${esc(c.TenKH)}</h1>
          <p class="desc">${esc(c.MoTa || "")}</p>
          <div class="detail-meta">
            <span>${ico("layers")} <b>${lessons.length}</b> bài học</span>
            <span>${ico("user")} <b>${esc(c.TenGV)}</b></span>
            <span>${ico("target")} <b>${esc(levelOf(c))}</b></span>
          </div>
        </div>
        <aside class="enroll-card">
          <div class="ec-thumb" style="background:${th.grad}"><span class="glyph">${th.glyph}</span></div>
          <div class="ec-body">
            <div class="ec-price"><span class="now tnum">${free ? "Miễn phí" : vnd(c.HocPhi)}</span></div>
            <div class="muted" style="font-size:.82rem;margin:6px 0 16px">Truy cập trọn đời · học mọi lúc</div>
            ${enrollCTA(c)}
            <ul class="ec-incl">
              <li><span class="tick">${ico("check")}</span> ${lessons.length} bài học</li>
              <li><span class="tick">${ico("check")}</span> ${(c.quizzes || []).length} bài kiểm tra</li>
              <li><span class="tick">${ico("check")}</span> Video bài giảng · Truy cập trọn đời</li>
            </ul>
          </div>
        </aside>
        <div class="detail-rest">
          ${en ? courseProgressPanel(lessons, doneSet, en) : ""}
          <div class="tabs"><button class="${nav.tab === "curr" ? "active" : ""}" data-tab="curr">Nội dung</button><button class="${nav.tab === "quiz" ? "active" : ""}" data-tab="quiz">Bài kiểm tra${(c.quizzes || []).length ? ` (${c.quizzes.length})` : ""}</button><button class="${nav.tab === "instr" ? "active" : ""}" data-tab="instr">Giảng viên</button></div>
          <div>${body}</div>
        </div>
      </div>
    </section>`;
  }

  /* ============ VIEW: HỌC TẬP CỦA TÔI (học viên) ============ */
  const LEVEL_TITLES = ["Tân binh", "Học trò chăm chỉ", "Chiến binh", "Cao thủ", "Huyền thoại"];
  const ACT_META = { dang_ky: ["🎓", "Đăng ký khóa học"], bai_hoc: ["✅", "Hoàn thành bài học"], kiem_tra: ["📝", "Làm bài kiểm tra"], chung_chi: ["🏅", "Nhận chứng chỉ"] };
  const PAY_ICON = { "Chuyển khoản": "🏦", "Thẻ tín dụng": "💳", "Ví điện tử": "👛" };
  const fmtScore = (d) => (d == null ? "—" : String(Math.round(Number(d) * 10) / 10));
  const scoreCls = (d) => (d >= 8 ? "hi" : d >= 7 ? "ok" : "lo");
  const emptyBlock = (ic, h, p, btn, attr) => `<div class="empty-state"><div class="es-ic">${ic}</div><h3>${h}</h3><p>${p}</p>${btn ? `<button class="btn btn-accent" ${attr}>${btn}</button>` : ""}</div>`;
  function ago(s) {
    if (!s) return "";
    const d = new Date(String(s).replace(" ", "T"));
    if (isNaN(d)) return String(s).slice(0, 10);
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days <= 0) return "Hôm nay";
    if (days === 1) return "Hôm qua";
    if (days < 30) return days + " ngày trước";
    if (days < 365) return Math.floor(days / 30) + " tháng trước";
    return Math.floor(days / 365) + " năm trước";
  }
  function learnStatusPill(c) {
    const m = { hoan_thanh: ["✓ Hoàn thành", "ok"], da_huy: ["Đã hủy", "no"], dang_hoc: ["Đang học", "pine"] }[c.TTDangKy] || ["Chưa bắt đầu", "muted"];
    return `<span class="pill ${m[1]}">${m[0]}</span>`;
  }
  const activeCourses = () => ((STU.overview || {}).courses || [])
    .filter((c) => !["hoan_thanh", "da_huy"].includes(c.TTDangKy))
    .sort((a, b) => String(b.HoatDongCuoi || "").localeCompare(String(a.HoatDongCuoi || "")) || String(b.NgayDangKy).localeCompare(String(a.NgayDangKy)));
  function boardCourses() {
    const seen = new Set();
    return ((STU.overview || {}).courses || []).filter((c) => c.TTDangKy !== "da_huy" && !seen.has(c.MaKH) && seen.add(c.MaKH));
  }
  async function loadBoard() {
    if (STU.boardMode === "global") { const k = STU.gCrit + "|" + STU.gSpan; if (!STU.global[k]) STU.global[k] = await API.studentGlobalBoard(STU.gCrit, STU.gSpan); return; }
    const cs = boardCourses();
    if (!cs.length) return;
    if (!cs.find((c) => c.MaKH === STU.boardCourse)) STU.boardCourse = (cs.find((c) => c.DiemTB != null) || cs[0]).MaKH; // ưu tiên khóa đã có điểm để bảng không trống
    if (!STU.board[STU.boardCourse]) STU.board[STU.boardCourse] = await API.studentBoard(STU.boardCourse);
  }
  async function loadLearnTab(tab) {
    if (!STU.overview) STU.overview = await API.studentOverview();
    if (tab === "board") await loadBoard();
    if (tab === "results" && !STU.results) STU.results = await API.studentResults();
    if (tab === "pay" && !STU.payments) STU.payments = await API.studentPayments();
  }

  function learnHero(ov) {
    const k = ov.kpi, xp = k.SoBaiDaHoc * 10 + k.SoLanLamBai * 5 + k.ChungChi * 100;
    const lv = Math.floor(xp / 100) + 1, inLv = xp % 100;
    const title = LEVEL_TITLES[Math.min(lv - 1, LEVEL_TITLES.length - 1)];
    const r = activeCourses()[0];
    const msg = !ov.courses.length ? "Bắt đầu hành trình của bạn — chọn khóa học đầu tiên nào!"
      : r ? `Bạn đang học dở “${esc(r.TenKH)}” (${Math.round(r.TienDoPhanTram)}%) — tiếp tục nào, sắp tới đích rồi!`
      : "Tuyệt vời! Bạn đã hoàn thành mọi khóa đang học — khám phá thêm khóa mới nhé.";
    return `
    <div class="learn-hero stu-hero">
      <div class="sh-top">
        <div class="sh-ava">${esc(initialsOf(AUTH.user.ten))}</div>
        <div class="sh-info"><span class="eyebrow">Học tập của tôi</span><h2>Chào ${esc(AUTH.user.ten.split(" ").pop())}! 👋</h2><p>${msg}</p></div>
        <div class="xp-box" title="+10 XP mỗi bài học · +5 XP mỗi lần làm bài kiểm tra · +100 XP mỗi chứng chỉ">
          <div class="xp-top"><b>Cấp ${lv}</b><span>${title}</span></div>
          <div class="xp-bar"><i style="width:${inLv}%"></i></div>
          <small>${inLv}/100 XP để lên cấp · tổng ${xp} XP</small>
        </div>
      </div>
      <div class="lh-stats tnum">
        <div><b>${k.DangHoc}</b><span>Đang học</span></div>
        <div><b>${k.HoanThanh}</b><span>Đã hoàn thành</span></div>
        <div><b>${k.ChungChi}</b><span>Chứng chỉ</span></div>
        <div><b>${fmtScore(k.DiemTB)}</b><span>Điểm trung bình</span></div>
        <div><b>${k.SoBaiDaHoc}</b><span>Bài đã học</span></div>
      </div>
    </div>`;
  }
  function viewLearn() {
    const ov = STU.overview;
    if (!ov) return `<section class="wrap" style="padding-top:12px">${inlineLoading()}</section>`;
    const k = ov.kpi;
    const tabs = [
      ["overview", "🏠", "Tổng quan"], ["courses", "📚", `Khóa học của tôi (${ov.courses.length})`], ["board", "🏆", "Bảng xếp hạng"],
      ["results", "📝", "Kết quả kiểm tra"], ["certs", "🏅", `Chứng chỉ${k.ChungChi ? ` (${k.ChungChi})` : ""}`],
      ["pay", "💳", `Thanh toán${k.ChoThanhToan ? ` · ${k.ChoThanhToan} chờ` : ""}`],
    ];
    const panels = { overview: learnOverviewTab, courses: learnCoursesTab, board: learnBoardTab, results: learnResultsTab, certs: learnCertsTab, pay: learnPayTab };
    return `
    <section class="wrap" style="padding-top:12px">
      ${learnHero(ov)}
      <div class="tabs ltabs">${tabs.map(([v, ic, l]) => `<button class="${nav.ltab === v ? "active" : ""}" data-ltab="${v}">${ic} ${l}</button>`).join("")}</div>
      ${(panels[nav.ltab] || learnOverviewTab)()}
    </section>`;
  }

  /* --- tab: Tổng quan --- */
  function resumeCard(c) {
    const th = themeOf(c), pct = Math.round(c.TienDoPhanTram), nb = c.BaiTiepTheo;
    return `
    <div class="resume-card">
      <div class="rsm-thumb" style="background:${th.grad}"><span>${th.glyph}</span></div>
      <div class="rsm-body">
        <span class="eyebrow">▶ Tiếp tục học</span>
        <h3>${esc(c.TenKH)}</h3>
        <div class="muted rsm-sub">👤 ${esc(c.TenGV)} · ${c.SoBaiHoanThanh}/${c.TongSoBai} bài${nb ? ` · Tiếp theo: <b>Bài ${nb.ThuTu}. ${esc(nb.TenBH)}</b>` : ""}</div>
        <div class="prog-line"><div class="bar"><i style="width:${pct}%"></i></div><span class="pc">${pct}%</span></div>
      </div>
      <button class="btn btn-accent btn-lg" data-resume="${c.MaKH}:${nb ? nb.MaBH : ""}">${c.SoBaiHoanThanh ? "Học tiếp" : "Bắt đầu học"} →</button>
    </div>`;
  }
  function resumeStrip() {
    const act = activeCourses().slice(0, 3);
    if (!act.length) return "";
    return `
    <section class="home-sec">
      <div class="sec-head"><div><span class="eyebrow">Dành cho bạn</span><h2>Tiếp tục học</h2></div><button class="btn btn-ghost btn-sm" data-go="learn">Học tập của tôi ${ico("arrow-r")}</button></div>
      <div class="resume-grid">${act.map((c) => {
        const th = themeOf(c), pct = Math.round(c.TienDoPhanTram), nb = c.BaiTiepTheo;
        return `<div class="mini-resume" data-resume="${c.MaKH}:${nb ? nb.MaBH : ""}">
          <div class="mr-thumb" style="background:${th.grad}">${th.glyph}</div>
          <div class="mr-body"><b>${esc(c.TenKH)}</b>
            <span class="muted">${nb ? `Bài ${nb.ThuTu}. ${esc(nb.TenBH)}` : "Sẵn sàng bắt đầu"}</span>
            <div class="prog-line"><div class="bar"><i style="width:${pct}%"></i></div><span class="pc">${pct}%</span></div></div>
        </div>`;
      }).join("")}</div>
    </section>`;
  }
  // danh sách "việc cần làm" của học viên — dùng cho cả khối Mục tiêu và chuông thông báo
  function goalItems() {
    const ov = STU.overview, goals = [];
    if (!ov) return goals;
    activeCourses().forEach((c) => {
      const left = c.TongSoBai - c.SoBaiHoanThanh;
      if (c.BaiTiepTheo) goals.push({ ic: "book", t: `Học tiếp “${c.BaiTiepTheo.TenBH}” — còn ${left} bài để xong “${c.TenKH}”`, a: "Học", at: `data-resume="${c.MaKH}:${c.BaiTiepTheo.MaBH}"` });
      if (c.SoBaiKT > c.SoBaiKTDaLam) goals.push({ ic: "list", t: `Còn ${c.SoBaiKT - c.SoBaiKTDaLam} bài kiểm tra chưa làm ở “${c.TenKH}”`, a: "Làm bài", at: `data-ltab="results"` });
      if (c.DiemTB != null && c.DiemTB < 7) goals.push({ ic: "target", t: `Điểm TB “${c.TenKH}” đang ${fmtScore(c.DiemTB)} — cần ≥ 7 để nhận chứng chỉ`, a: "Luyện tập", at: `data-ltab="results"` });
    });
    ov.courses.forEach((c) => {
      if (!c.DaThanhToan && Number(c.HocPhi) > 0 && c.TTDangKy !== "da_huy") goals.push({ ic: "card", t: `Thanh toán học phí “${c.TenKH}” (${vnd(c.HocPhi)})`, a: "Thanh toán", at: `data-pay="${c.MaDK}"` });
      if (c.TTDangKy === "hoan_thanh" && c.DiemDanhGia == null) goals.push({ ic: "star", t: `Đánh giá khóa “${c.TenKH}” để giúp các bạn khác chọn khóa phù hợp`, a: "Đánh giá", at: `data-review="${c.MaDK}"` });
    });
    return goals;
  }
  function goalsHTML() {
    const goals = goalItems();
    if (!goals.length) return `<div class="stu-done"><span>🎉</span><p>Không còn việc tồn đọng — bạn đang làm rất tốt!</p></div>`;
    return `<div class="goal-list">${goals.slice(0, 6).map((g) => `<div class="goal"><span class="g-ic">${ico(g.ic)}</span><p>${esc(g.t)}</p><button class="btn btn-ghost btn-sm" ${g.at}>${g.a}</button></div>`).join("")}</div>`;
  }
  function timelineHTML(list) {
    if (!list || !list.length) return `<p class="muted">Chưa có hoạt động nào — hãy bắt đầu học để thấy tiến trình của bạn ở đây.</p>`;
    return `<div class="timeline">${list.map((h) => {
      const [ic, lb] = ACT_META[h.Loai] || ["•", ""];
      return `<div class="tl-item"><span class="tl-ic tl-${h.Loai}">${ic}</span>
        <div class="tl-body"><b>${esc(h.TieuDe)}</b><span>${lb}${h.PhuDe ? ` · ${esc(h.PhuDe)}` : ""}</span></div>
        <time title="${esc(String(h.ThoiGian).slice(0, 16))}">${ago(h.ThoiGian)}</time></div>`;
    }).join("")}</div>`;
  }
  function scoresPanel() {
    const rows = STU.overview.courses.filter((c) => c.DiemTB != null);
    if (!rows.length) return "";
    return `<div class="panel" style="margin-bottom:28px"><h3>📊 Điểm trung bình theo khóa <span class="muted" style="font-weight:500;font-size:.8rem">· điểm cao nhất mỗi bài kiểm tra, thang 10</span></h3>
      <div class="score-list">${rows.map((c) => `<div class="score-row">
        <span class="sr-name">${esc(c.TenKH)}${c.LanDangKy > 1 ? ` <em>· lần ${c.LanDangKy}</em>` : ""}</span>
        <div class="sr-bar"><i class="${scoreCls(c.DiemTB)}" style="width:${Math.min(100, c.DiemTB * 10)}%"></i><u title="Mốc đạt chứng chỉ: 7.0"></u></div>
        <b class="sr-val ${scoreCls(c.DiemTB)}">${fmtScore(c.DiemTB)}</b></div>`).join("")}</div>
      <p class="muted" style="font-size:.76rem;margin-top:12px">Vạch đứng đánh dấu mốc 7.0 — điểm tối thiểu để nhận chứng chỉ.</p></div>`;
  }
  function suggestPanel() {
    const have = enrolledSet();
    const list = COURSES.filter((c) => c.TrangThai === "published" && !have.has(c.MaKH))
      .sort((a, b) => (Number(b.DiemTB) || 0) - (Number(a.DiemTB) || 0) || Number(b.SoHocVien) - Number(a.SoHocVien)).slice(0, 3);
    if (!list.length) return "";
    return `<div class="sec-head" style="margin-top:8px"><div><span class="eyebrow">Có thể bạn thích</span><h2 style="font-size:1.3rem">Khóa học gợi ý</h2></div><button class="btn btn-ghost btn-sm" data-go="catalog">Xem tất cả</button></div>
      <div class="course-grid">${list.map(cardHTML).join("")}</div>`;
  }
  function learnOverviewTab() {
    const ov = STU.overview, r = activeCourses()[0];
    const resume = r ? resumeCard(r)
      : emptyBlock("🚀", ov.courses.length ? "Bạn chưa có khóa nào đang học" : "Chưa có khóa học nào", "Khám phá thư viện và đăng ký khóa học đầu tiên của bạn.", "Khám phá khóa học →", `data-go="catalog"`);
    return `
    ${resume}
    <div class="dash-grid dg-even">
      <div class="panel"><h3>🎯 Mục tiêu tiếp theo</h3>${goalsHTML()}</div>
      <div class="panel"><h3>⚡ Hoạt động gần đây</h3>${timelineHTML((ov.hoatDong || []).slice(0, 7))}</div>
    </div>
    ${scoresPanel()}
    ${suggestPanel()}`;
  }

  /* --- tab: Khóa học của tôi --- */
  function courseCard(c) {
    const th = themeOf(c), pct = Math.round(c.TienDoPhanTram), cancelled = c.TTDangKy === "da_huy", done = c.TTDangKy === "hoan_thanh";
    const unpaid = !c.DaThanhToan && Number(c.HocPhi) > 0 && !cancelled;
    return `
    <div class="lc-card ${cancelled ? "is-cancel" : ""}">
      <div class="lc-thumb" style="background:${th.grad}">${th.glyph}</div>
      <div class="lc-mid">
        <div class="lc-tags">${learnStatusPill(c)}${c.LanDangKy > 1 ? `<span class="pill apr">Lần học thứ ${c.LanDangKy}</span>` : ""}${c.MaCC ? `<span class="pill gold">🏅 Có chứng chỉ</span>` : ""}${unpaid ? `<span class="pill no">Chưa thanh toán</span>` : ""}</div>
        <h3>${esc(c.TenKH)}</h3>
        <div class="gv">👤 ${esc(c.TenGV)} · ${esc(c.LinhVuc || "")} · Đăng ký ${esc(String(c.NgayDangKy).slice(0, 10))}</div>
        <div class="prog-line"><div class="bar ${done ? "gold" : ""}"><i style="width:${pct}%"></i></div><span class="pc">${pct}%</span></div>
        <div class="lc-chips">
          <span>📖 ${c.SoBaiHoanThanh}/${c.TongSoBai} bài</span>
          <span>📝 ${c.SoBaiKTDaLam}/${c.SoBaiKT} bài kiểm tra</span>
          <span class="${c.DiemTB != null ? "sc-" + scoreCls(c.DiemTB) : ""}">🎯 Điểm TB ${fmtScore(c.DiemTB)}</span>
          ${c.Hang ? `<span>🏆 Hạng ${c.Hang}/${c.TongHang}</span>` : ""}
          ${c.DiemDanhGia != null ? `<span class="stars" title="Đánh giá của bạn">${ratingTxt(c.DiemDanhGia)}</span>` : ""}
        </div>
      </div>
      <div class="lc-right">
        ${cancelled ? `<button class="btn btn-ghost btn-sm" data-open="${c.MaKH}">Xem khóa học</button>`
          : `<button class="btn btn-accent btn-sm" data-resume="${c.MaKH}:${c.BaiTiepTheo ? c.BaiTiepTheo.MaBH : ""}">${done ? "Ôn tập" : c.SoBaiHoanThanh ? "Học tiếp" : "Bắt đầu"} →</button>`}
        ${unpaid ? `<button class="btn btn-ghost btn-sm" data-pay="${c.MaDK}">💳 Thanh toán</button>` : ""}
        ${!cancelled ? `<button class="btn btn-ghost btn-sm" data-review="${c.MaDK}">${c.DiemDanhGia != null ? "✏️ Sửa đánh giá" : "⭐ Đánh giá"}</button>` : ""}
        ${c.MaCC ? `<button class="btn btn-ghost btn-sm" data-ltab="certs">🏅 Chứng chỉ</button>` : ""}
      </div>
    </div>`;
  }
  function learnCoursesTab() {
    const all = STU.overview.courses, f = STU.cfilter;
    const learning = (c) => !["hoan_thanh", "da_huy"].includes(c.TTDangKy);
    const flt = { all: () => true, learning, done: (c) => c.TTDangKy === "hoan_thanh", cancel: (c) => c.TTDangKy === "da_huy" };
    const chips = [["all", "✦ Tất cả"], ["learning", "Đang học"], ["done", "Hoàn thành"], ["cancel", "Đã hủy"]]
      .map(([v, l]) => [v, l, all.filter(flt[v]).length]).filter(([v, , n]) => v !== "cancel" || n > 0);
    const list = all.filter(flt[flt[f] ? f : "all"]);
    if (!all.length) return emptyBlock("📚", "Bạn chưa đăng ký khóa học nào", "Chọn một khóa học trong thư viện để bắt đầu học ngay hôm nay.", "Khám phá khóa học →", `data-go="catalog"`);
    return `<div class="chips" style="margin-bottom:22px">${chips.map(([v, l, n]) => `<button class="chip ${f === v ? "active" : ""}" data-cfilter="${v}">${l} <span class="chip-n">${n}</span></button>`).join("")}</div>
      ${list.length ? list.map(courseCard).join("") : `<div class="empty-state"><div class="es-ic">🔎</div><h3>Không có khóa học ở mục này</h3></div>`}`;
  }

  /* --- tab: Bảng xếp hạng --- */
  // kind: "course" (xếp trong 1 khóa) | "diem" (bảng vàng theo điểm) | "chamchi" (bảng vàng theo số bài học)
  const boardMetric = (r, kind) => (kind === "chamchi" ? String(r.SoBaiHoc) : fmtScore(r.DiemTB));
  function podiumHTML(top, kind) {
    if (!top.length) return "";
    const order = top.length >= 3 ? [1, 0, 2] : top.length === 2 ? [1, 0] : [0];
    return `<div class="podium">${order.map((i) => {
      const r = top[i];
      return `<div class="pod pod-${i + 1} ${r.LaToi ? "me" : ""}">
        <span class="pod-crown">${i === 0 ? "👑" : ""}</span>
        <div class="pod-ava">${esc(initialsOf(r.HoTen))}</div>
        <b class="pod-name">${esc(r.HoTen)}${r.LaToi ? ` <span class="you">Bạn</span>` : ""}</b>
        <span class="pod-score">${boardMetric(r, kind)}</span>${kind === "chamchi" ? `<small class="pod-unit">bài học</small>` : ""}
        <div class="pod-step"><span>${["🥇", "🥈", "🥉"][Math.min(r.Hang, 3) - 1]}</span></div>
      </div>`;
    }).join("")}</div>`;
  }
  function rankRow(r, kind) {
    const unranked = r.Hang == null;
    const sub = kind === "course"
      ? (r.DaHoanThanh ? "✓ Đã hoàn thành khóa" : `Tiến độ ${Math.round(r.TienDo)}%`) + ` · ${r.SoBaiKTDaLam} bài kiểm tra${unranked && r.DiemTB != null ? ` · điểm hiện tại ${fmtScore(r.DiemTB)}` : ""}`
      : kind === "chamchi" ? `${r.SoBaiKT} bài kiểm tra · ${r.SoChungChi} chứng chỉ`
      : `${r.SoBaiKT} bài kiểm tra · ${r.SoKhoa} khóa học · ${r.SoChungChi} chứng chỉ${unranked && r.DiemTB != null ? ` · điểm hiện tại ${fmtScore(r.DiemTB)}` : ""}`;
    const pill = unranked ? `<span class="score-pill none">${r.CanLamThem > 0 ? `Cần thêm ${r.CanLamThem} bài` : "Chưa có hạng"}</span>`
      : kind === "chamchi" ? `<span class="score-pill ok">${r.SoBaiHoc} bài</span>`
      : `<span class="score-pill ${scoreCls(r.DiemTB)}">${fmtScore(r.DiemTB)}</span>`;
    return `<div class="rank-row ${r.LaToi ? "me" : ""}">
      <span class="rk-no">${r.Hang != null && r.Hang <= 3 ? ["🥇", "🥈", "🥉"][r.Hang - 1] : (r.Hang != null ? r.Hang : "—")}</span>
      <span class="rk-ava">${esc(initialsOf(r.HoTen))}</span>
      <div class="rk-name"><b>${esc(r.HoTen)}${r.LaToi ? ` <span class="you">Bạn</span>` : ""}</b><span class="rk-sub">${sub}</span></div>
      ${kind === "course" ? `<div class="bar rk-bar"><i style="width:${Math.round(r.TienDo)}%"></i></div>` : ""}
      ${pill}
    </div>`;
  }
  function boardBody(data, kind) {
    const bang = data.bang || [], ranked = bang.filter((r) => r.Hang != null), unranked = bang.filter((r) => r.Hang == null);
    if (kind === "course" && data.tongSoBaiKT === 0) return emptyBlock("📝", "Khóa học chưa có bài kiểm tra", "Bảng xếp hạng sẽ xuất hiện khi khóa có bài kiểm tra và học viên làm bài.", "", "");
    const me = bang.find((r) => r.LaToi), total = data.daXepHang != null ? data.daXepHang : ranked.length, cham = kind === "chamchi";
    let banner;
    if (me && me.Hang != null) {
      const lead = ranked[0], gap = cham ? lead.SoBaiHoc - me.SoBaiHoc : Math.round((lead.DiemTB - me.DiemTB) * 100) / 100;
      const ties = ranked.filter((r) => r.Hang === me.Hang).length - 1;
      banner = `<div class="my-rank"><div class="mr-badge">#${me.Hang}</div><div><b>Bạn đang đứng hạng ${me.Hang}/${total}${ties > 0 ? ` · đồng hạng với ${ties} người` : ""}</b>
        <p>${me.Hang === 1 ? "Bạn đang dẫn đầu — giữ vững phong độ nhé! 🔥" : cham ? `Kém hạng 1 ${gap} bài học — cố lên!` : `Cách hạng 1 chỉ ${fmtScore(gap)} điểm — cố lên!`}</p></div></div>`;
    } else {
      const need = me && me.CanLamThem > 0 ? me.CanLamThem : 0;
      banner = `<div class="my-rank soft"><div class="mr-badge">?</div><div><b>Bạn chưa có hạng</b><p>${need ? `Làm thêm ${need} bài kiểm tra ${kind === "course" ? "của khóa này " : ""}để có tên trên bảng xếp hạng.` : cham ? "Hoàn thành một bài học để có tên trên bảng." : `Làm bài kiểm tra ${kind === "course" ? "của khóa này" : "ở bất kỳ khóa nào"} để góp mặt trên bảng xếp hạng.`}</p></div></div>`;
    }
    if (!ranked.length) return `${banner}${emptyBlock("🏁", "Chưa ai đủ điều kiện xếp hạng", `Cần tối thiểu ${data.nguong || 1} ${cham ? "bài học" : "bài kiểm tra"} — hãy là người đầu tiên và giành vị trí số 1!`, "", "")}
      ${unranked.length ? `<h4 class="sub-h">Chưa đủ điều kiện (${unranked.length})</h4><div class="rank-list dim">${unranked.map((r) => rankRow(r, kind)).join("")}</div>` : ""}`;
    const global = kind !== "course", shown = global ? ranked.slice(0, 10) : ranked;
    const extra = global && me && me.Hang != null && !shown.includes(me) ? `<div class="rank-gap">⋯</div>${rankRow(me, kind)}` : "";
    return `${banner}${podiumHTML(ranked.slice(0, 3), kind)}
      <div class="rank-list">${shown.map((r) => rankRow(r, kind)).join("")}${extra}</div>
      ${unranked.length ? `<h4 class="sub-h">Chưa đủ điều kiện xếp hạng (${unranked.length})</h4><div class="rank-list dim">${unranked.map((r) => rankRow(r, kind)).join("")}</div>` : ""}`;
  }
  async function refreshBoard() { topbar.start(); try { await loadBoard(); } catch (e) { toast(e.message); } topbar.done(); render("content"); }
  function learnBoardTab() {
    const g = STU.boardMode === "global";
    const seg = `<div class="seg"><button class="${!g ? "active" : ""}" data-bmode="course">📚 Theo khóa học</button><button class="${g ? "active" : ""}" data-bmode="global">🌏 Toàn nền tảng</button></div>`;
    const SPANS = [["tuan", "7 ngày"], ["thang", "30 ngày"], ["tatca", "Mọi lúc"]];
    let filters = "", inner, rule;
    if (g) {
      filters = `<div class="board-filters"><div class="seg"><button class="${STU.gCrit === "diem" ? "active" : ""}" data-gcrit="diem">🎯 Điểm cao</button><button class="${STU.gCrit === "chamchi" ? "active" : ""}" data-gcrit="chamchi">🔥 Chăm chỉ</button></div>
        <div class="seg">${SPANS.map(([v, l]) => `<button class="${STU.gSpan === v ? "active" : ""}" data-gspan="${v}">${l}</button>`).join("")}</div></div>`;
      const d = STU.global[STU.gCrit + "|" + STU.gSpan], span = { tuan: "trong 7 ngày qua", thang: "trong 30 ngày qua", tatca: "" }[STU.gSpan];
      inner = d ? boardBody(d, STU.gCrit) : inlineLoading();
      rule = STU.gCrit === "chamchi" ? `Xếp theo số bài học hoàn thành ${span || "từ trước tới nay"}. Hòa: ai làm nhiều bài kiểm tra hơn xếp trước.`
        : `Xếp theo điểm TB mọi khóa (điểm cao nhất mỗi bài kiểm tra${span ? ", " + span : ""}); cần tối thiểu ${d ? d.nguong : 3} bài kiểm tra mới có hạng. Hòa: nhiều chứng chỉ hơn → nhiều bài kiểm tra hơn.`;
    } else {
      const cs = boardCourses();
      if (!cs.length) inner = emptyBlock("🏆", "Chưa có bảng xếp hạng", "Đăng ký một khóa học để tham gia bảng xếp hạng cùng các học viên khác.", "Khám phá khóa học →", `data-go="catalog"`);
      else {
        const b = STU.board[STU.boardCourse];
        inner = `<div class="chips" style="margin-bottom:18px">${cs.map((c) => `<button class="chip ${c.MaKH === STU.boardCourse ? "active" : ""}" data-bcourse="${c.MaKH}">${esc(c.TenKH)}</button>`).join("")}</div>
          ${b ? boardBody(b, "course") : inlineLoading()}`;
      }
      const b = STU.board[STU.boardCourse];
      rule = `Xếp theo điểm TB các bài kiểm tra của khóa (điểm cao nhất mỗi bài); cần làm tối thiểu ${b && b.nguong ? b.nguong : 2} bài mới có hạng. Hòa: tiến độ cao hơn → làm nhiều bài hơn → ít lượt làm lại hơn.`;
    }
    return `<div class="board-head">${seg}<p class="muted">${rule} <button class="lnk-inline" data-go="honor">Xem Vinh danh →</button></p></div>${filters}${inner}`;
  }

  /* --- tab: Kết quả kiểm tra --- */
  function learnResultsTab() {
    const R = STU.results;
    if (!R) return inlineLoading();
    const groups = {};
    R.lanLam.forEach((r) => { (groups[r.MaDK + "|" + r.MaBKT] = groups[r.MaDK + "|" + r.MaBKT] || { ...r, lans: [] }).lans.push(r); });
    const rerun = new Set(R.lanLam.filter((r) => r.LanDangKy > 1).map((r) => r.MaKH)); // khóa từng học nhiều lần → ghi rõ lần học để khỏi nhầm
    // mỗi bài kiểm tra có thể có điểm tối đa (DiemToiDa) khác nhau → quy đổi về thang 10 (best10) để so màu/đạt-chưa đạt nhất quán,
    // nhưng vẫn hiện điểm thô "x/DiemToiDa" đúng theo bài đó.
    const list = Object.values(groups).map((g) => {
      g.lans.sort((a, b) => a.LanLam - b.LanLam);
      g.best = Math.max(...g.lans.map((l) => l.DiemSo));
      g.best10 = g.best / g.DiemToiDa * 10;
      return g;
    }).sort((a, b) => String(b.lans[b.lans.length - 1].ThoiGianLam).localeCompare(String(a.lans[a.lans.length - 1].ThoiGianLam)));
    const passed = list.filter((g) => g.best10 >= 7).length;
    const kp = [["📝", R.lanLam.length, "Lượt làm bài"], ["✅", list.length, "Bài đã làm"], ["🏆", list.length ? fmtScore(Math.max(...list.map((g) => g.best10))) : "—", "Điểm cao nhất (quy đổi /10)"], ["🎯", list.length ? Math.round((passed / list.length) * 100) + "%" : "—", "Tỷ lệ bài đạt (≥ 70%)"]];
    return `
    <div class="kpis">${kp.map(([ic, v, l]) => `<div class="kpi"><div class="ic">${ic}</div><b>${v}</b><span>${l}</span></div>`).join("")}</div>
    ${R.chuaLam.length ? `<h3 class="sub-h">Cần làm tiếp (${R.chuaLam.length})</h3>
      <div class="todo-quiz-grid">${R.chuaLam.map((q) => `<div class="todo-quiz"><span class="tq-ic">📝</span>
        <div><b>${esc(q.TenBKT)}</b><span class="muted">${esc(q.TenKH)} · ⏱ ${q.ThoiGian} phút</span></div>
        <button class="btn btn-accent btn-sm" data-do-quiz="${q.MaBKT}">Làm bài →</button></div>`).join("")}</div>` : ""}
    <h3 class="sub-h">Thành tích từng bài</h3>
    ${list.length ? `<div class="qres-list">${list.map((g) => {
      const left = g.SoLanLamToiDa ? g.SoLanLamToiDa - g.lans.length : null;
      return `<div class="qres-card">
        <div class="sb ${scoreCls(g.best10)}"><b>${fmtScore(g.best)}</b><span>/${g.DiemToiDa}</span></div>
        <div class="qres-main"><b>${esc(g.TenBKT)}</b><span class="muted">${esc(g.TenKH)}${rerun.has(g.MaKH) ? ` (lần học ${g.LanDangKy})` : ""} · ${esc(g.TenBH)}</span>
          <div class="att-row">${g.lans.map((l) => `<span class="att ${scoreCls(l.DiemSo / g.DiemToiDa * 10)}" title="${esc(String(l.ThoiGianLam).slice(0, 16))}">Lần ${l.LanLam}: ${fmtScore(l.DiemSo)}/${g.DiemToiDa}</span>`).join("")}</div></div>
        <div class="qres-act">${g.best10 >= 7 ? `<span class="pill ok">✓ Đạt</span>` : `<span class="pill gold">Chưa đạt</span>`}
          ${left === null || left > 0 ? `<button class="btn btn-ghost btn-sm" data-do-quiz="${g.MaBKT}">Làm lại →</button>` : `<span class="muted" style="font-size:.76rem">Hết lượt</span>`}</div>
      </div>`;
    }).join("")}</div>` : emptyBlock("📝", "Chưa có kết quả nào", "Làm bài kiểm tra trong các khóa bạn đã đăng ký để theo dõi điểm số ở đây.", "", "")}`;
  }

  /* --- tab: Chứng chỉ --- */
  function certCard(c) {
    return `<div class="cert"><div class="cert-inner">
      <div class="seal">🏅</div>
      <span class="eyebrow">Chứng chỉ hoàn thành khóa học</span>
      <h2>${esc(c.TenKH)}</h2>
      <div class="recip">Cấp cho <b>${esc(AUTH.user.ten)}</b></div>
      <div class="crow">
        <div><b>${esc(c.MaCC)}</b><span>Mã chứng chỉ</span></div>
        <div><b>${esc(String(c.NgayCap).slice(0, 10))}</b><span>Ngày cấp</span></div>
        <div><b>${fmtScore(c.DiemTB)}/10</b><span>Điểm trung bình</span></div>
        <div><b>${esc(c.TenGV)}</b><span>Giảng viên</span></div>
        <div><b>${c.HieuLuc === "con_hieu_luc" ? "Còn hiệu lực" : "Hết hiệu lực"}</b><span>Trạng thái</span></div>
      </div></div></div>`;
  }
  function lockCard(c) {
    const reqs = [
      [c.TongSoBai > 0 && c.SoBaiHoanThanh >= c.TongSoBai, `Học hết các bài (${c.SoBaiHoanThanh}/${c.TongSoBai})`],
      [c.SoBaiKT === 0 || c.SoBaiKTDaLam >= c.SoBaiKT, `Làm đủ bài kiểm tra (${c.SoBaiKTDaLam}/${c.SoBaiKT})`],
      [c.SoBaiKT === 0 || (c.DiemTB != null && c.DiemTB >= 7), `Điểm trung bình ≥ 7 (hiện ${fmtScore(c.DiemTB)})`],
    ];
    const ok = reqs.filter((r) => r[0]).length;
    return `<div class="cert-locked">
      <div class="lk-ic">🔒</div>
      <div style="flex:1;min-width:0"><h4>${esc(c.TenKH)}</h4>
        <div class="req-list">${reqs.map(([d, t]) => `<div class="${d ? "ok" : ""}"><span>${d ? "✓" : "○"}</span>${esc(t)}</div>`).join("")}</div>
        <div class="prog-line" style="margin-top:10px"><div class="bar gold"><i style="width:${Math.round((ok / reqs.length) * 100)}%"></i></div><span class="pc">${ok}/${reqs.length}</span></div>
      </div>
      <button class="btn btn-ghost btn-sm" data-resume="${c.MaKH}:${c.BaiTiepTheo ? c.BaiTiepTheo.MaBH : ""}">Học tiếp →</button>
    </div>`;
  }
  function learnCertsTab() {
    const ov = STU.overview, earned = ov.courses.filter((c) => c.MaCC), locked = activeCourses();
    return `
    ${earned.length ? `<div class="cert-grid">${earned.map(certCard).join("")}</div>`
      : emptyBlock("🏅", "Chưa có chứng chỉ nào", "Học hết các bài, làm đủ bài kiểm tra và đạt điểm trung bình ≥ 7 để nhận chứng chỉ.", "Xem khóa học của tôi →", `data-ltab="courses"`)}
    ${locked.length ? `<h3 class="sub-h">Đang chinh phục (${locked.length})</h3><div class="lock-grid">${locked.map(lockCard).join("")}</div>` : ""}`;
  }

  /* --- tab: Thanh toán --- */
  function learnPayTab() {
    const ov = STU.overview, P = STU.payments;
    if (!P) return inlineLoading();
    const unpaidAll = ov.courses.filter((c) => !c.DaThanhToan && Number(c.HocPhi) > 0 && c.TTDangKy !== "da_huy");
    const waiting = unpaidAll.filter((c) => c.DangChoDuyet);
    const needPay = unpaidAll.filter((c) => !c.DangChoDuyet);
    const okN = P.filter((p) => p.TrangThaiTT === "success").length;
    const kp = [["💰", vnd(ov.kpi.TongChiTieu), "Đã thanh toán"], ["🧾", okN, "Giao dịch thành công"], ["⏳", unpaidAll.length ? vnd(unpaidAll.reduce((s, c) => s + Number(c.HocPhi), 0)) : "0₫", `Đang chờ xử lý (${unpaidAll.length} khóa)`]];
    return `
    <div class="kpis kpis-3">${kp.map(([ic, v, l]) => `<div class="kpi"><div class="ic">${ic}</div><b class="tnum">${v}</b><span>${l}</span></div>`).join("")}</div>
    ${needPay.length ? `<h3 class="sub-h">Cần thanh toán</h3><div class="unpaid-list">${needPay.map((c) => `<div class="unpaid">
        <div class="lc-thumb sm" style="background:${themeOf(c).grad}">${themeOf(c).glyph}</div>
        <div style="flex:1;min-width:0"><b>${esc(c.TenKH)}</b><span class="muted" style="display:block;font-size:.8rem">Đăng ký ${esc(String(c.NgayDangKy).slice(0, 10))}</span></div>
        <b class="tnum">${vnd(c.HocPhi)}</b><button class="btn btn-accent btn-sm" data-pay="${c.MaDK}">Thanh toán ngay</button></div>`).join("")}</div>` : ""}
    ${waiting.length ? `<h3 class="sub-h">Đang chờ admin xác nhận</h3><div class="unpaid-list">${waiting.map((c) => `<div class="unpaid">
        <div class="lc-thumb sm" style="background:${themeOf(c).grad}">${themeOf(c).glyph}</div>
        <div style="flex:1;min-width:0"><b>${esc(c.TenKH)}</b><span class="muted" style="display:block;font-size:.8rem">Đã gửi yêu cầu thanh toán</span></div>
        <b class="tnum">${vnd(c.HocPhi)}</b>${statusBadge("pending")}</div>`).join("")}</div>` : ""}
    <h3 class="sub-h">Lịch sử giao dịch</h3>
    <div class="panel">${P.length ? P.map((p) => `<div class="pay-row">
        <div class="pic">${p.LoaiGiaoDich === "hoan_tien" ? "↩️" : (PAY_ICON[p.PhuongThucTT] || "💳")}</div>
        <div class="pz"><b>${esc(p.TenKH)}${p.LoaiGiaoDich === "hoan_tien" ? " · Hoàn tiền" : ""}</b><span>${esc(p.PhuongThucTT || "—")} · ${esc(String(p.ThoiGian).slice(0, 16).replace("T", " "))}</span></div>
        <div class="amt tnum">${p.LoaiGiaoDich === "hoan_tien" ? "−" : ""}${vnd(p.SoTien)}</div>${statusBadge(p.TrangThaiTT)}</div>`).join("")
      : `<p class="muted">Chưa có giao dịch nào.</p>`}</div>`;
  }
  function openPayModal(maDK) {
    let c = ((STU.overview || {}).courses || []).find((x) => x.MaDK === maDK);
    // mở từ trang chi tiết khóa khi số liệu "Học tập của tôi" chưa nạp xong → lấy tên/học phí từ chính trang đang xem
    if (!c && detailCache && detailCache._enroll && detailCache._enroll.MaDK === maDK) c = { MaDK: maDK, TenKH: detailCache.TenKH, HocPhi: detailCache._enroll.HocPhi || detailCache.HocPhi };
    if (!c) return;
    const methods = [["Chuyển khoản", "🏦", "Quét mã QR ngân hàng"], ["Thẻ tín dụng", "💳", "Visa / Mastercard"], ["Ví điện tử", "👛", "MoMo / ZaloPay"]];
    openModal(`<div class="modal-card"><button class="modal-close" data-close aria-label="Đóng">✕</button>
      <h2 class="modal-title">Thanh toán học phí</h2>
      <div class="pay-sum"><div><span>Khóa học</span><b>${esc(c.TenKH)}</b></div><div><span>Số tiền</span><b class="tnum big">${vnd(c.HocPhi)}</b></div></div>
      <div class="auth-err" id="pyErr" hidden></div>
      <div class="pay-methods">${methods.map(([m, ic, sub], i) => `<label class="pay-m"><input type="radio" name="pm" value="${m}" ${i === 0 ? "checked" : ""}><span class="pm-ic">${ic}</span><span class="pm-t"><b>${m}</b><small>${sub}</small></span></label>`).join("")}</div>
      <div class="pay-qr" id="payQr" hidden></div>
      <p class="muted" style="font-size:.78rem;margin-top:12px">Sau khi gửi, admin sẽ đối soát và xác nhận giao dịch — nội dung mở ra ngay khi được duyệt.</p>
      <div class="form-actions"><button class="btn btn-ghost" data-close>Hủy</button><button class="btn btn-primary" id="pySubmit">Gửi yêu cầu thanh toán</button></div></div>`);
    $$("[data-close]").forEach((b) => b.onclick = closeModal);
    let qrData = null, qrLoading = false;
    async function updateQr() {
      const box = $("#payQr"); if (!box) return;
      if ($("input[name=pm]:checked").value !== "Chuyển khoản") { box.hidden = true; return; }
      box.hidden = false;
      if (qrData === null && !qrLoading) {
        qrLoading = true; box.innerHTML = `<div class="pay-qr-load">Đang tải mã QR…</div>`;
        try { qrData = await API.studentPayQr(maDK); } catch { qrData = { configured: false }; }
        qrLoading = false;
      }
      if (!qrData || !qrData.configured) {
        box.innerHTML = `<p class="muted" style="font-size:.8rem">Chưa cấu hình tài khoản nhận chuyển khoản — bấm "Gửi yêu cầu thanh toán" bên dưới để ghi nhận mô phỏng.</p>`;
      } else {
        box.innerHTML = `<img class="pay-qr-img" src="${esc(qrData.qrUrl)}" alt="Mã QR chuyển khoản">
          <div class="pay-qr-info">
            ${qrData.tenNH ? `<div><span>Ngân hàng</span><b>${esc(qrData.tenNH)}</b></div>` : ""}
            <div><span>Số tài khoản</span><b class="tnum">${esc(qrData.soTK)}</b></div>
            <div><span>Chủ tài khoản</span><b>${esc(qrData.tenTK)}</b></div>
            <div><span>Nội dung CK</span><b>${esc(qrData.noiDung)}</b></div>
          </div>
          <p class="muted" style="font-size:.78rem">Quét mã chuyển khoản xong rồi bấm "Gửi yêu cầu thanh toán" bên dưới để báo cho admin.</p>`;
      }
    }
    $$("input[name=pm]").forEach((r) => r.onchange = updateQr);
    updateQr();
    $("#pySubmit").onclick = async () => {
      const btn = $("#pySubmit"); btn.disabled = true; btn.textContent = "Đang gửi…";
      try {
        await API.studentPay(maDK, $("input[name=pm]:checked").value);
        stuReset(); closeModal(); toast("Đã gửi yêu cầu — chờ admin xác nhận ⏳");
        if (nav.view === "detail" && detailCache) { detailCache = await loadDetail(detailCache.MaKH); render(); } // cập nhật badge "đang chờ" ngay tại trang khóa học
        else await go("learn", null, nav.ltab);
      } catch (e) { const er = $("#pyErr"); er.textContent = e.message; er.hidden = false; btn.disabled = false; btn.textContent = "Gửi yêu cầu thanh toán"; }
    };
  }
  function openReviewModal(maDK) {
    const c = ((STU.overview || {}).courses || []).find((x) => x.MaDK === maDK); if (!c) return;
    let score = c.DiemDanhGia != null ? c.DiemDanhGia : -1; // -1 = chưa chọn gì (0 vẫn là 1 điểm hợp lệ, không dùng 0 làm "chưa chọn")
    const HINT = ["Chạm vào 1 số để chấm điểm", "Rất tệ 😞", "Tệ", "Không tốt", "Chưa ổn", "Bình thường 🙂", "Tạm ổn", "Khá", "Tốt 😃", "Rất tốt", "Tuyệt vời! 🤩"];
    openModal(`<div class="modal-card"><button class="modal-close" data-close aria-label="Đóng">✕</button>
      <h2 class="modal-title">${c.DiemDanhGia != null ? "Sửa đánh giá" : "Đánh giá khóa học"}</h2>
      <p class="muted" style="margin-bottom:12px">${esc(c.TenKH)}</p>
      <div class="auth-err" id="rvErr" hidden></div>
      <div class="score-pick" id="scorePick">${Array.from({ length: 11 }, (_, i) => i).map((i) => `<button type="button" data-score="${i}" aria-label="${i} điểm">${i}</button>`).join("")}</div>
      <div class="star-hint" id="starHint"></div>
      <div class="field"><label>Nhận xét (không bắt buộc)</label><textarea id="rvText" rows="4" maxlength="1000" placeholder="Khóa học giúp ích gì cho bạn? Điều gì có thể tốt hơn?">${esc(c.NhanXetCuaToi || "")}</textarea></div>
      <div class="form-actions"><button class="btn btn-ghost" data-close>Hủy</button><button class="btn btn-primary" id="rvSubmit">Gửi đánh giá</button></div></div>`);
    $$("[data-close]").forEach((b) => b.onclick = closeModal);
    const paint = (n) => { $$("#scorePick button").forEach((b) => b.classList.toggle("on", +b.dataset.score === n)); $("#starHint").textContent = n < 0 ? HINT[0] : HINT[n]; };
    $$("#scorePick button").forEach((b) => {
      b.onmouseenter = () => paint(+b.dataset.score);
      b.onmouseleave = () => paint(score);
      b.onclick = () => { score = +b.dataset.score; paint(score); };
    });
    paint(score);
    $("#rvSubmit").onclick = async () => {
      const er = $("#rvErr");
      if (score < 0) { er.textContent = "Vui lòng chọn điểm đánh giá."; er.hidden = false; return; }
      const btn = $("#rvSubmit"); btn.disabled = true;
      try {
        await API.studentReview(maDK, score, $("#rvText").value.trim());
        stuReset(); closeModal(); toast("Cảm ơn bạn đã đánh giá ⭐");
        COURSES = await API.listCourses().catch(() => COURSES);
        await go("learn", null, nav.ltab);
      } catch (e) { er.textContent = e.message; er.hidden = false; btn.disabled = false; }
    };
  }

  /* --- trang chi tiết khóa: tiến độ + đánh dấu đã học --- */
  function courseProgressPanel(lessons, doneSet, en) {
    const total = lessons.length, n = lessons.filter((l) => doneSet.has(l.MaBH)).length, pct = total ? Math.round((n / total) * 100) : 0;
    const done = en.TTDangKy === "hoan_thanh";
    return `<div class="progress-panel">
      <div class="pp-main">
        <div class="pp-top"><b>Tiến độ của bạn</b>${learnStatusPill({ TTDangKy: en.TTDangKy })}</div>
        <div class="prog-line"><div class="bar ${done ? "gold" : ""}"><i style="width:${pct}%"></i></div><span class="pc">${pct}%</span></div>
        <span class="muted pp-sub">${n}/${total} bài đã học${done ? " · Bạn đã hoàn thành khóa học 🎉" : ""}</span>
      </div>
      <button class="btn btn-ghost btn-sm" data-go="learn">📚 Học tập của tôi</button>
    </div>`;
  }
  // Máy chủ chỉ cho đánh dấu xong sau khi đã học tối thiểu vài chục giây kể từ lúc mở bài → nút đếm ngược cho người học thấy rõ
  let LTIMER = null; // { maBH, conLai (giây; null = đang hỏi máy chủ), iv }
  const completeLabel = (s) => (s > 0 ? `Đánh dấu đã học xong · còn ${s}s` : "Đánh dấu đã học xong");
  function stopLessonTimer() { if (LTIMER) { clearInterval(LTIMER.iv); LTIMER = null; } }
  function paintLessonTimer() {
    const b = $("[data-complete]"); if (!b || !LTIMER || LTIMER.maBH !== b.dataset.complete) return;
    b.disabled = LTIMER.conLai == null || LTIMER.conLai > 0;
    const lab = $("[data-complete-label]", b); if (lab) lab.textContent = completeLabel(LTIMER.conLai);
  }
  function runLessonCountdown(t, left) {
    clearInterval(t.iv); t.conLai = left; paintLessonTimer();
    if (left > 0) t.iv = setInterval(() => { t.conLai = Math.max(0, t.conLai - 1); paintLessonTimer(); if (!t.conLai) clearInterval(t.iv); }, 1000);
  }
  // gọi sau mỗi lần vẽ trang: có nút "đánh dấu xong" thì ghi nhận mở bài + bắt đầu đếm; vẽ lại cùng bài thì giữ nguyên đồng hồ
  async function armLessonTimer() {
    const btn = $("[data-complete]");
    if (!btn) return stopLessonTimer();
    const maBH = btn.dataset.complete;
    if (LTIMER && LTIMER.maBH === maBH) return paintLessonTimer();
    stopLessonTimer();
    const t = LTIMER = { maBH, conLai: null, iv: 0 };
    paintLessonTimer();
    let left = 0;
    try { left = Math.max(0, Math.ceil(Number((await API.openLesson(maBH)).conLai) || 0)); }
    catch (e) { left = 0; } // lỗi mạng: cứ cho bấm, máy chủ sẽ từ chối nếu chưa đủ thời gian
    if (LTIMER === t) runLessonCountdown(t, left);
  }
  function lessonActionBar(cur, lessons, doneSet) {
    const done = doneSet.has(cur.MaBH), idx = lessons.findIndex((l) => l.MaBH === cur.MaBH), next = lessons[idx + 1];
    const wait = LTIMER && LTIMER.maBH === cur.MaBH ? LTIMER.conLai : null;
    return `<div class="lesson-bar">
      <div class="lb-title"><span class="lb-n">Bài ${idx + 1}</span><b>${esc(cur.TenBH)}</b></div>
      <div class="lb-act">
        ${done ? `<span class="lb-done">${ico("check")} Đã học xong</span>` : `<button class="btn btn-primary btn-sm" data-complete="${cur.MaBH}"${wait == null || wait > 0 ? " disabled" : ""}>${ico("check")} <span data-complete-label>${completeLabel(wait)}</span></button>`}
        ${next ? `<button class="btn btn-ghost btn-sm" data-lesson="${next.MaBH}">Bài tiếp theo ${ico("arrow-r")}</button>` : ""}
      </div>
    </div>`;
  }
  async function doCompleteLesson(maBH) {
    try {
      const r = await API.completeLesson(maBH);
      const en = detailCache._enroll; en.daHoc = en.daHoc || [];
      if (!en.daHoc.includes(maBH)) en.daHoc.push(maBH);
      en.TTDangKy = r.trangThai || en.TTDangKy;
      stuReset();
      render();
      if (r.capChungChi) openCertCelebration();
      else if (r.tienDo >= 100) toast((detailCache.quizzes || []).length ? "Đã học hết bài! Làm bài kiểm tra đạt điểm TB ≥ 7 để nhận chứng chỉ 🎯" : "Đã học hết các bài!");
      else toast(`Đã ghi nhận · tiến độ ${r.tienDo}%`);
    } catch (e) {
      // chưa đủ thời gian học → đồng hồ chạy lại theo số giây máy chủ báo; chưa mở bài (phiên cũ) → mở lại
      if (e.code === "LESSON_TOO_SOON" && LTIMER && LTIMER.maBH === maBH) runLessonCountdown(LTIMER, Math.max(1, Math.ceil(Number(e.retryAfter) || 1)));
      else if (e.code === "LESSON_NOT_OPENED") { stopLessonTimer(); armLessonTimer(); }
      toast(e.message);
    }
  }
  function openCertCelebration() {
    confetti(90);
    openModal(`<div class="modal-card sm celebrate"><div class="cel-emoji">🏅</div><h2 class="modal-title">Chúc mừng bạn!</h2>
      <p class="muted" style="margin-bottom:20px">Bạn đã hoàn thành khóa học và nhận được chứng chỉ mới.</p>
      <div class="form-actions"><button class="btn btn-ghost" data-close>Để sau</button><button class="btn btn-accent" id="celGo">Xem chứng chỉ →</button></div></div>`);
    $$("[data-close]").forEach((b) => b.onclick = closeModal);
    $("#celGo").onclick = () => { closeModal(); go("learn", null, "certs"); };
  }

  /* ============ VIEW: QUẢN LÝ (giảng viên) ============ */
  function myCourses() { const ma = AUTH.user ? AUTH.user.ma : null; return COURSES.filter((c) => c.MaGV === ma); }
  function viewManage() {
    const ov = TEACH.overview || {};
    const list = myCourses();
    const tabs = [["overview", "Tổng quan"], ["courses", `Khóa học của tôi (${list.length})`], ["reviews", `Đánh giá${ov.SoDanhGia ? ` (${ov.SoDanhGia})` : ""}`]];
    return `
    <section class="wrap" style="padding-top:12px">
      <div class="learn-hero">
        <span class="eyebrow">Bảng điều khiển giảng viên</span>
        <h2>Chào ${esc((AUTH.user.ten || "").split(" ").pop())} 👋</h2>
        <p>Theo dõi khóa học, học viên và doanh thu của bạn tại một nơi.</p>
        <div class="lh-stats tnum">
          <div><b>${ov.SoKhoaHoc ?? list.length}</b><span>Khóa học</span></div>
          <div><b>${ov.SoHocVien ?? 0}</b><span>Học viên</span></div>
          <div><b>${vnd(ov.TongDoanhThu || 0)}</b><span>Tổng doanh thu</span></div>
          <div><b>${ov.DiemTB != null ? ratingTxt(ov.DiemTB) : "—"}</b><span>${ov.SoDanhGia || 0} đánh giá</span></div>
        </div>
      </div>
      <div class="tabs mtab">${tabs.map(([v, l]) => `<button class="${nav.mtab === v ? "active" : ""}" data-mtab="${v}">${l}</button>`).join("")}</div>
      ${nav.mtab === "overview" ? teacherOverviewTab(ov) : nav.mtab === "reviews" ? teacherReviewsTab() : teacherCoursesTab(list)}
    </section>`;
  }
  function teacherOverviewTab(ov) {
    const rows = ov.theoKhoa || [];
    return `
    <div class="dash-grid">
      <div class="panel">
        <h3>Doanh thu 6 tháng gần nhất</h3>
        ${barChart(ov.doanhThu6Thang || [])}
      </div>
      <div class="panel">
        <h3>Khóa học của bạn theo doanh thu</h3>
        ${rows.length ? `<table class="data-table"><thead><tr><th>Khóa học</th><th>Trạng thái</th><th>Lượt ĐK</th><th>Doanh thu</th></tr></thead><tbody>
          ${rows.map((r) => `<tr><td>${esc(r.TenKH)}</td><td>${statusBadge(r.TrangThai)}</td><td class="tnum">${r.SoLuotDangKy}</td><td class="tnum">${vnd(r.DoanhThu)}</td></tr>`).join("")}
        </tbody></table>` : `<p class="muted">Chưa có dữ liệu — tạo khóa học đầu tiên của bạn.</p>`}
      </div>
    </div>`;
  }
  function teacherCoursesTab(list) {
    return `
    <div class="sec-head"><div><h2 style="font-size:1.2rem">Khóa học của tôi</h2></div><button class="btn btn-accent" data-add-course>+ Thêm khóa học</button></div>
    ${list.length ? `<div class="mng-list">${list.map(mngRow).join("")}</div>`
      : `<div class="empty-state"><div class="es-ic">📚</div><h3>Chưa có khóa học nào</h3><p>Tạo khóa học đầu tiên của bạn.</p><button class="btn btn-primary" data-add-course>+ Tạo khóa học đầu tiên</button></div>`}`;
  }
  function teacherReviewsTab() {
    const list = TEACH.reviews || [];
    if (!list.length) return `<div class="empty-state"><div class="es-ic">⭐</div><h3>Chưa có đánh giá</h3><p>Đánh giá từ học viên sẽ hiện ở đây.</p></div>`;
    return `<div class="review-list">${list.map((r) => `
      <div class="review-row">
        <div class="rr-top"><b>${esc(r.HoTen)}</b><span class="stars">${ratingTxt(r.DiemDanhGia)}</span><span class="muted">· ${esc(r.TenKH)}</span><span class="muted" style="margin-left:auto">${esc(String(r.NgayDG).slice(0, 10))}</span></div>
        ${r.NhanXet ? `<p class="rr-text">${esc(r.NhanXet)}</p>` : ""}
      </div>`).join("")}</div>`;
  }
  function mngRow(c) {
    const th = themeOf(c);
    return `<div class="mng-row">
      <div class="mng-thumb" style="background:${th.grad}">${th.glyph}</div>
      <div class="mng-info"><h3>${esc(c.TenKH)}</h3>
        <div class="mng-meta">${statusBadge(c.TrangThai)}<span class="pill pine">${esc(c.LinhVuc)}</span><span class="pill apr">${esc(levelOf(c))}</span>
          <span class="muted">📚 ${c.SoBaiHoc || 0} bài · ${vnd(c.HocPhi)}</span></div></div>
      <div class="mng-actions">
        <button class="btn btn-ghost btn-sm" data-students="${c.MaKH}">👥 Học viên (${c.SoHocVien || 0})</button>
        <button class="btn btn-ghost btn-sm" data-lessons="${c.MaKH}">📖 Bài học (${c.SoBaiHoc || 0})</button>
        <button class="btn btn-ghost btn-sm" data-edit-course="${c.MaKH}">✏️ Sửa</button>
        <button class="btn btn-sm btn-danger-ghost" data-del-course="${c.MaKH}">🗑 Xóa</button>
      </div></div>`;
  }
  async function openStudentsModal(maKH) {
    const c = COURSES.find((x) => x.MaKH === maKH);
    openModal(`<div class="modal-card lg"><button class="modal-close" data-close aria-label="Đóng">✕</button>
      <h2 class="modal-title">Học viên · ${esc(c ? c.TenKH : maKH)}</h2>
      <div id="studentsBody">${inlineLoading()}</div></div>`);
    $$("[data-close]").forEach((b) => b.onclick = closeModal);
    try {
      if (!TEACH.studentsByCourse[maKH]) TEACH.studentsByCourse[maKH] = await API.courseStudents(maKH);
      const d = TEACH.studentsByCourse[maKH];
      const body = $("#studentsBody");
      if (!body) return;
      if (!d.hocVien.length) { body.innerHTML = `<div class="empty-state"><div class="es-ic">👥</div><h3>Chưa có học viên</h3></div>`; return; }
      body.innerHTML = `<table class="data-table"><thead><tr><th>Học viên</th><th>Ngày ĐK</th><th>Tiến độ</th><th>Điểm TB</th><th>Thanh toán</th><th>Trạng thái</th></tr></thead><tbody>
        ${d.hocVien.map((s) => `<tr>
          <td><b>${esc(s.HoTen)}</b><br><span class="muted" style="font-size:.78rem">${esc(s.Email)}</span></td>
          <td>${esc(String(s.NgayDangKy).slice(0, 10))}</td>
          <td><div class="mini-bar"><div class="mini-bar-fill" style="width:${s.TienDoPhanTram}%"></div></div><span class="muted" style="font-size:.78rem">${s.TienDoPhanTram}%</span></td>
          <td class="tnum">${s.DiemTB != null ? s.DiemTB : "—"}</td>
          <td>${s.DaThanhToan ? `<span class="pill ok">✓ Đã thanh toán</span>` : `<span class="pill no">Chưa thanh toán</span>`}</td>
          <td>${enrollStatusBadge(s.TTDangKy)}</td>
        </tr>`).join("")}
      </tbody></table>`;
    } catch (e) { toast(e.message); closeModal(); }
  }
  function viewManageLessons() {
    const c = detailCache; if (!c) return viewManage();
    const lessons = c.lessons || [], quizzes = c.quizzes || [];
    const byLesson = {}; quizzes.forEach((q) => { (byLesson[q.MaBH] = byLesson[q.MaBH] || []).push(q); });
    return `
    <section class="wrap" style="padding-top:12px">
      <button class="back-btn" data-go="manage">← Về danh sách khóa học</button>
      <div class="sec-head"><div><span class="eyebrow">${esc(c.TenKH)}</span><h2 style="font-size:1.3rem">Quản lý bài học & kiểm tra</h2><p>${lessons.length} bài học · ${quizzes.length} bài kiểm tra</p></div>
        <button class="btn btn-accent" data-add-lesson="${c.MaKH}">+ Thêm bài học</button></div>
      ${lessons.length ? lessons.map((l, i) => {
        const hasV = !!ytEmbed(l.VideoBaiGiang), qz = byLesson[l.MaBH] || [];
        return `<div class="ml-block">
          <div class="lesson-row">
            <div class="lesson-ic">${i + 1}</div>
            <div class="lz"><b>${esc(l.TenBH)}</b><span>${hasV ? `${ico("play")} có video` : "chưa có video"} · ${ico("clock")} ${l.ThoiLuong || 0} phút</span></div>
            <button class="btn btn-ghost btn-sm" data-edit-lesson="${l.MaBH}">✏️ Sửa</button>
            <button class="btn btn-sm btn-danger-ghost" data-del-lesson="${l.MaBH}">🗑</button>
          </div>
          <div class="ml-quizzes">
            ${qz.map((q) => `<div class="ml-quiz">
              <span class="mq-ic">📝</span>
              <div class="mq-main"><b>${esc(q.TenBKT)}</b><span>${q.SoCauHoi} câu · ${q.ThoiGian} phút${q.SoLanLamToiDa ? ` · tối đa ${q.SoLanLamToiDa} lượt` : " · không giới hạn lượt"}</span></div>
              <button class="btn btn-ghost btn-sm" data-edit-quiz="${q.MaBKT}">✏️</button>
              <button class="btn btn-sm btn-danger-ghost" data-del-quiz="${q.MaBKT}">🗑</button>
            </div>`).join("")}
            <button class="ml-addquiz" data-add-quiz="${l.MaBH}">+ Thêm bài kiểm tra cho bài này</button>
          </div>
        </div>`;
      }).join("") : `<div class="empty-state"><div class="es-ic">📖</div><h3>Chưa có bài học</h3><p>Thêm bài học đầu tiên để bắt đầu.</p><button class="btn btn-primary" data-add-lesson="${c.MaKH}">+ Thêm bài học</button></div>`}
    </section>`;
  }

  /* ============ VIEW: HỒ SƠ ============ */
  const ROLE_BADGE = { student: ["🎓 Học viên", "pine"], teacher: ["🧑‍🏫 Giảng viên", "apr"], admin: ["🛡️ Quản trị viên", "muted"] };
  function viewProfile() {
    const p = PROFILE;
    if (!p) return `<section class="wrap" style="padding-top:12px">${inlineLoading()}</section>`;
    const [roleLabel, roleCls] = ROLE_BADGE[p.role] || ["", "muted"];
    const rows = p.role === "teacher"
      ? [["Số điện thoại", p.SDT], ["Ngày sinh", p.NgaySinh && String(p.NgaySinh).slice(0, 10)], ["Chuyên môn", p.ChuyenMon], ["Trình độ", p.TrinhDo]]
      : p.role === "student"
      ? [["Số điện thoại", p.SoDienThoai], ["Ngày sinh", p.NgaySinh && String(p.NgaySinh).slice(0, 10)], ["Ngày tham gia", p.NgayDK && String(p.NgayDK).slice(0, 10)]]
      : [];
    const stats = p.role === "teacher"
      ? [["📚", p.SoKhoaHoc || 0, "Khóa học phụ trách"], ["👥", p.SoHocVien || 0, "Học viên theo học"], ["📈", p.DiemDanhGiaTB != null ? ratingTxt(p.DiemDanhGiaTB) : "—", "Điểm đánh giá TB"]]
      : p.role === "student"
      ? [["📚", p.SoKhoaHocDaDK || 0, "Khóa đã đăng ký"], ["✅", p.SoKhoaHocHoanThanh || 0, "Khóa đã hoàn thành"], ["🏅", p.SoChungChi || 0, "Chứng chỉ đạt được"]]
      : [];
    return `
    <section class="wrap" style="padding-top:12px">
      <div class="prof-head">
        <div class="big-ava">${esc(initialsOf(p.HoTen))}</div>
        <div style="flex:1"><h2>${esc(p.HoTen)}</h2><div class="sub">${esc(p.Email)} · Mã ${esc(p.ma)}</div>
          <div class="badges"><span class="pill ${roleCls}">${roleLabel}</span>${p.TrangThaiTK ? statusBadge(p.TrangThaiTK) : ""}</div></div>
        ${p.role !== "admin" ? `<button class="btn btn-ghost" data-edit-profile>✏️ Chỉnh sửa hồ sơ</button>` : ""}
      </div>

      ${stats.length ? `<div class="kpis">${stats.map(([ic, v, l]) => `<div class="kpi"><div class="ic">${ic}</div><b>${esc(v)}</b><span>${l}</span></div>`).join("")}</div>` : ""}

      ${rows.length ? `<div class="panel" style="margin-bottom:24px"><h3>Thông tin cá nhân</h3>
        <div class="info-grid">${rows.map(([l, v]) => `<div><span>${l}</span><b>${v ? esc(v) : `<span class="muted">Chưa cập nhật</span>`}</b></div>`).join("")}</div>
      </div>` : ""}

      <div class="panel" style="margin-bottom:24px"><h3>${ico("shield")} Bảo mật tài khoản</h3>
        <p class="muted">Nên đổi mật khẩu định kỳ. Khi đổi, các thiết bị khác đang đăng nhập sẽ bị đăng xuất.</p>
        <button class="btn btn-ghost" data-change-pw style="margin-top:12px">${ico("lock")} Đổi mật khẩu</button></div>

      ${p.role === "teacher" ? `<div class="panel"><h3>Giảng dạy</h3>
        <p class="muted">Bạn đang phụ trách ${p.SoKhoaHoc || 0} khóa học. Vào <b>Trang quản lý</b> để chỉnh sửa.</p>
        <button class="btn btn-primary" data-go="manage" style="margin-top:12px">Tới trang quản lý →</button></div>`
        : p.role === "student" ? `<div class="panel"><h3>Khám phá</h3><p class="muted">Duyệt thư viện khóa học và bắt đầu học.</p>
        <button class="btn btn-primary" data-go="catalog" style="margin-top:12px">Xem khóa học →</button></div>`
        : `<div class="panel"><h3>Quản trị hệ thống</h3><p class="muted">Theo dõi giảng viên, học viên, khóa học và doanh thu toàn nền tảng.</p>
        <button class="btn btn-primary" data-go="admin" style="margin-top:12px">Tới trang quản trị →</button></div>`}
    </section>`;
  }
  function openEditProfileForm() {
    const p = PROFILE; if (!p) return;
    const isTeacher = p.role === "teacher";
    openModal(`<div class="modal-card"><button class="modal-close" data-close aria-label="Đóng">✕</button>
      <h2 class="modal-title">Chỉnh sửa hồ sơ</h2>
      <p class="muted" style="margin-bottom:16px;font-size:.85rem">Họ tên và email gắn với tài khoản đăng nhập nên không chỉnh sửa ở đây — liên hệ quản trị viên nếu cần đổi.</p>
      <div class="auth-err" id="epErr" hidden></div>
      <form id="profileForm">
        <div class="field-row">
          <div class="field"><label>Số điện thoại</label><input id="epSdt" value="${esc((isTeacher ? p.SDT : p.SoDienThoai) || "")}" placeholder="09xxxxxxxx"></div>
          <div class="field"><label>Ngày sinh</label><input id="epNgaySinh" type="date" value="${p.NgaySinh ? String(p.NgaySinh).slice(0, 10) : ""}"></div>
        </div>
        ${isTeacher ? `<div class="field-row">
          <div class="field"><label>Chuyên môn</label><input id="epCM" value="${esc(p.ChuyenMon || "")}" placeholder="VD: Lập trình Java"></div>
          <div class="field"><label>Trình độ</label><input id="epTD" value="${esc(p.TrinhDo || "")}" placeholder="VD: Thạc sĩ"></div>
        </div>` : ""}
        <div class="form-actions"><button type="button" class="btn btn-ghost" data-close>Hủy</button><button type="submit" class="btn btn-primary" id="epSubmit">Lưu thay đổi</button></div>
      </form></div>`);
    $$("[data-close]").forEach((b) => b.onclick = closeModal);
    $("#profileForm").onsubmit = async (e) => {
      e.preventDefault();
      const btn = $("#epSubmit"); btn.disabled = true;
      try {
        const body = isTeacher
          ? { sdt: $("#epSdt").value.trim(), ngaySinh: $("#epNgaySinh").value || null, chuyenMon: $("#epCM").value.trim(), trinhDo: $("#epTD").value.trim() }
          : { soDienThoai: $("#epSdt").value.trim(), ngaySinh: $("#epNgaySinh").value || null };
        await API.updateProfile(body);
        PROFILE = await API.getProfile();
        closeModal(); toast("Đã cập nhật hồ sơ"); render();
      } catch (e2) {
        const err = $("#epErr"); err.textContent = e2.message; err.hidden = false; btn.disabled = false;
      }
    };
  }

  function openChangePasswordForm() {
    openModal(`<div class="modal-card"><button class="modal-close" data-close aria-label="Đóng">✕</button>
      <h2 class="modal-title">Đổi mật khẩu</h2>
      <p class="muted" style="margin-bottom:16px;font-size:.85rem">Mật khẩu mới tối thiểu 8 ký tự, gồm cả chữ và số. Sau khi đổi, các thiết bị khác sẽ phải đăng nhập lại.</p>
      <div class="auth-err" id="cpErr" hidden></div>
      <form id="pwForm" novalidate>
        <div class="field"><label>Mật khẩu hiện tại</label><input id="cpOld" type="password" autocomplete="current-password"></div>
        <div class="field"><label>Mật khẩu mới</label><input id="cpNew" type="password" autocomplete="new-password" placeholder="Tối thiểu 8 ký tự, gồm chữ và số"></div>
        <div class="field"><label>Nhập lại mật khẩu mới</label><input id="cpNew2" type="password" autocomplete="new-password"></div>
        <div class="form-actions"><button type="button" class="btn btn-ghost" data-close>Hủy</button><button type="submit" class="btn btn-primary" id="cpSubmit">Đổi mật khẩu</button></div>
      </form></div>`);
    $$("[data-close]").forEach((b) => b.onclick = closeModal);
    $("#cpOld").focus();
    $("#pwForm").onsubmit = async (e) => {
      e.preventDefault();
      const err = $("#cpErr"), fail = (m) => { err.textContent = m; err.hidden = false; };
      const oldPw = $("#cpOld").value, newPw = $("#cpNew").value;
      if (!oldPw) return fail("Vui lòng nhập mật khẩu hiện tại.");
      const bad = pwProblem(newPw); if (bad) return fail(bad);
      if (newPw === oldPw) return fail("Mật khẩu mới phải khác mật khẩu hiện tại.");
      if (newPw !== $("#cpNew2").value) return fail("Hai lần nhập mật khẩu mới chưa khớp.");
      const btn = $("#cpSubmit"); btn.disabled = true;
      try {
        const r = await API.changePassword(oldPw, newPw);
        AUTH.set(AUTH.user, r.token); // token cũ đã bị thu hồi → dùng token mới để phiên này đi tiếp
        closeModal(); toast("Đã đổi mật khẩu 🔐");
      } catch (e2) { fail(e2.message); btn.disabled = false; }
    };
  }

  /* ============ VIEW: QUẢN TRỊ (admin) ============ */
  // 15 truy vấn báo cáo chính thức (nguồn: sql/04_queries.sql) — chạy trực tiếp qua /api/reports/*
  // doiTuong: ai thật sự cần xem câu này nhất — admin (vận hành/tài chính toàn hệ thống),
  // giangvien (chất lượng lớp mình dạy), hocvien (thành tích/trải nghiệm của người học)
  const REPORTS = [
    { id: "khoahoc-theo-thang", nguoi: "Trà", doiTuong: "admin", sao: true, ten: "Khóa học đăng ký theo tháng", mo: "Số lượt đăng ký mỗi khóa trong 1 tháng cho trước, sắp giảm dần — theo dõi xu hướng thị trường.", params: [["nam", "Năm", "number", 2026], ["thang", "Tháng", "number", 8]] },
    { id: "ty-le-hoan-thanh", nguoi: "Trà", doiTuong: "giangvien", sao: true, ten: "Tỷ lệ hoàn thành khóa học", mo: "Tỷ lệ % lượt đăng ký đã hoàn thành trong 1 khoảng thời gian — đo chất lượng giảng dạy từng khóa.", params: [["tuNgay", "Từ ngày", "date", "2026-08-01"], ["denNgay", "Đến ngày", "date", "2026-09-30"]] },
    { id: "hocphi-tren-tb", nguoi: "Trà", doiTuong: "admin", sao: false, ten: "Khóa học học phí trên trung bình", mo: "Các khóa có học phí cao hơn học phí trung bình toàn hệ thống — tham khảo khi định giá.", params: [] },
    { id: "giangvien-da-khoa", nguoi: "Trà", doiTuong: "admin", sao: false, ten: "Giảng viên dạy ≥ 2 khóa", mo: "Giảng viên đang phụ trách từ 2 khóa học trở lên — quản lý khối lượng công việc GV.", params: [] },
    { id: "diem-tb-hocvien", nguoi: "Trà", doiTuong: "giangvien", sao: false, ten: "Điểm trung bình mỗi học viên", mo: "Điểm TB (lấy điểm cao nhất mỗi bài kiểm tra) của từng học viên trong từng khóa — GV theo dõi lớp mình dạy.", params: [] },
    { id: "thong-ke-tiendo", nguoi: "Lộc", doiTuong: "giangvien", sao: true, ten: "Thống kê tiến độ theo khóa", mo: "Số lượt đã hoàn thành / đang học / chưa hoàn thành, theo khoảng thời gian — GV nắm tình hình lớp.", params: [["tuNgay", "Từ ngày", "date", "2026-08-01"], ["denNgay", "Đến ngày", "date", "2026-09-30"]] },
    { id: "baihoc-chi-tiet", nguoi: "Lộc", doiTuong: "giangvien", sao: false, ten: "Danh sách bài học chi tiết", mo: "Toàn bộ bài học kèm tên khóa học và giảng viên phụ trách — kiểm kê nội dung giảng dạy.", params: [] },
    { id: "khoahoc-chua-dangky", nguoi: "Lộc", doiTuong: "admin", sao: false, ten: "Khóa học chưa ai đăng ký", mo: "Khóa học hiện chưa có lượt đăng ký nào — cần marketing/xem lại nội dung.", params: [] },
    { id: "top-doanhthu", nguoi: "Lộc", doiTuong: "admin", sao: false, ten: "Top 3 doanh thu cao nhất", mo: "3 khóa học có doanh thu (chỉ tính giao dịch thành công) cao nhất.", params: [] },
    { id: "xephang-hocvien", nguoi: "Lộc", doiTuong: "hocvien", sao: false, ten: "Xếp hạng học viên theo khóa", mo: "Xếp hạng điểm trung bình của học viên, reset theo từng khóa — học viên xem mình đứng thứ mấy.", params: [] },
    { id: "doanhthu-theo-thang", nguoi: "Thịnh", doiTuong: "admin", sao: true, ten: "Doanh thu theo tháng", mo: "Tổng doanh thu hệ thống trong 1 tháng — chỉ giao dịch thành công.", params: [["nam", "Năm", "number", 2026], ["thang", "Tháng", "number", 8]] },
    { id: "danhgia-theo-khoang", nguoi: "Thịnh", doiTuong: "hocvien", sao: true, ten: "Đánh giá theo khoảng thời gian", mo: "Nhận xét/đánh giá của học viên theo từng khóa — phản ánh trải nghiệm người học.", params: [["tuNgay", "Từ ngày", "date", "2026-08-01"], ["denNgay", "Đến ngày", "date", "2026-09-30"]] },
    { id: "ty-le-chungchi", nguoi: "Thịnh", doiTuong: "hocvien", sao: false, ten: "Tỷ lệ chứng chỉ mỗi khóa", mo: "Tỷ lệ % học viên có chứng chỉ trên mỗi khóa học — thành tích đạt được của người học.", params: [] },
    { id: "hocvien-chua-thanhtoan", nguoi: "Thịnh", doiTuong: "admin", sao: false, ten: "Học viên chưa từng thanh toán", mo: "Học viên chưa có giao dịch thanh toán thành công nào — nhắc nợ/chăm sóc khách hàng.", params: [] },
    { id: "email-gop", nguoi: "Thịnh", doiTuong: "admin", sao: false, ten: "Gộp email giảng viên + học viên", mo: "Danh sách email gộp từ 2 bảng bằng UNION — xuất danh bạ liên hệ hàng loạt.", params: [] },
  ];
  const REPORT_AUDIENCE = {
    admin: ["🛡️", "Quản trị & vận hành"],
    giangvien: ["🧑‍🏫", "Giảng dạy & lớp học"],
    hocvien: ["🎓", "Học viên & thành tích"],
  };
  const REPORT_BY_ID = Object.fromEntries(REPORTS.map((r) => [r.id, r]));
  async function loadAdminTab(tab) {
    if (!ADMIN.overview) ADMIN.overview = await API.adminOverview();
    if (tab === "teachers" && !ADMIN.teachers) ADMIN.teachers = await API.adminTeachers();
    if (tab === "students" && !ADMIN.students) ADMIN.students = await API.adminStudents();
    if (tab === "courses" && !ADMIN.courses) ADMIN.courses = await API.adminCourses();
    if (tab === "lessons" && !ADMIN.lessons) ADMIN.lessons = await API.adminLessons();
    if (tab === "enrollments" && !ADMIN.enrollments) ADMIN.enrollments = await API.adminEnrollments();
    if (tab === "quizzes" && !ADMIN.quizzes) ADMIN.quizzes = await API.adminQuizzes();
    if (tab === "results" && !ADMIN.results) ADMIN.results = await API.adminResults();
    if (tab === "payments" && !ADMIN.payments) ADMIN.payments = await API.adminPayments();
    if (tab === "certificates" && !ADMIN.certificates) ADMIN.certificates = await API.adminCertificates();
    if (tab === "reviews" && !ADMIN.reviews) ADMIN.reviews = await API.adminReviews();
    if (REPORT_BY_ID[tab]) {
      if (!ADMIN.reportState) ADMIN.reportState = {};
      if (!ADMIN.reportState[tab]) {
        const r = REPORT_BY_ID[tab];
        ADMIN.reportState[tab] = { params: Object.fromEntries(r.params.map((p) => [p[0], p[3]])), rows: null, loading: false, error: null };
      }
      const st = ADMIN.reportState[tab];
      if (st.rows === null && !st.loading) {
        try { st.rows = await API.report(tab, st.params); }
        catch (e) { st.error = e.message; }
      }
    }
  }
  const ADMIN_SECTIONS = [
    { group: "Tổng quan", items: [["overview", "grid", "Tổng quan"]] },
    { group: "Người dùng", items: [["teachers", "board", "Giảng viên"], ["students", "cap", "Học viên"]] },
    { group: "Học tập", items: [["courses", "book", "Khóa học"], ["lessons", "file", "Bài học"], ["enrollments", "list", "Đăng ký"], ["quizzes", "flask", "Bài kiểm tra"], ["results", "check-circle", "Kết quả"]] },
    { group: "Tài chính & phản hồi", items: [["payments", "card", "Thanh toán"], ["certificates", "award", "Chứng chỉ"], ["reviews", "star", "Đánh giá"]] },
    { group: REPORT_AUDIENCE.admin[1], items: REPORTS.filter((r) => r.doiTuong === "admin").map((r) => [r.id, "chart", r.ten]) },
    { group: REPORT_AUDIENCE.giangvien[1], items: REPORTS.filter((r) => r.doiTuong === "giangvien").map((r) => [r.id, "chart", r.ten]) },
    { group: REPORT_AUDIENCE.hocvien[1], items: REPORTS.filter((r) => r.doiTuong === "hocvien").map((r) => [r.id, "chart", r.ten]) },
  ];
  function viewAdmin() {
    const ov = ADMIN.overview || {};
    const panels = {
      teachers: adminTeachersTab, students: adminStudentsTab, courses: adminCoursesTab,
      lessons: adminLessonsTab, enrollments: adminEnrollmentsTab, quizzes: adminQuizzesTab, results: adminResultsTab,
      payments: adminPaymentsTab, certificates: adminCertificatesTab, reviews: adminReviewsTab,
    };
    REPORTS.forEach((r) => { panels[r.id] = () => reportDetailTab(r.id); });
    return `
    <section class="wrap" style="padding-top:12px">
      <div class="learn-hero admin-hero">
        <span class="eyebrow">N9 · Quản trị hệ thống</span>
        <h2>Xin chào, ${esc(AUTH.user.ten)}</h2>
        <p>Theo dõi toàn bộ hoạt động nền tảng — giảng viên, học viên, khóa học và doanh thu.</p>
        <div class="lh-stats tnum">
          <div><b>${ov.SoHocVien ?? 0}</b><span>Học viên</span></div>
          <div><b>${ov.SoGiangVien ?? 0}</b><span>Giảng viên</span></div>
          <div><b>${ov.SoKhoaHoc ?? 0}</b><span>Khóa học</span></div>
          <div><b>${vnd(ov.DoanhThuThangNay || 0)}</b><span>Doanh thu tháng này</span></div>
        </div>
        ${ov.soKhoaChoDuyet ? `<div class="admin-alert">⚠️ ${ov.soKhoaChoDuyet} khóa học đang ở trạng thái <b>nháp</b> — xem mục Khóa học để công khai.</div>` : ""}
        ${ov.soThanhToanChoDuyet ? `<div class="admin-alert" data-atab="payments" style="cursor:pointer">💳 ${ov.soThanhToanChoDuyet} giao dịch đang <b>chờ duyệt</b> — bấm vào đây để xác nhận.</div>` : ""}
      </div>
      <div class="admin-main">${(panels[nav.atab] || (() => adminOverviewTab(ov)))()}</div>
    </section>`;
  }
  function adminOverviewTab(ov) {
    const rows = ov.topKhoaHoc || [];
    return `
    <div class="dash-grid">
      <div class="panel">
        <h3>Doanh thu toàn hệ thống — 6 tháng gần nhất</h3>
        ${barChart(ov.doanhThu6Thang || [])}
      </div>
      <div class="panel">
        <h3>Top 5 khóa học doanh thu cao nhất</h3>
        ${rows.length ? `<table class="data-table"><thead><tr><th>#</th><th>Khóa học</th><th>Giảng viên</th><th>Lượt ĐK</th><th>Doanh thu</th></tr></thead><tbody>
          ${rows.map((r, i) => `<tr><td class="tnum">${i + 1}</td><td>${esc(r.TenKH)}</td><td class="muted">${esc(r.TenGV)}</td><td class="tnum">${r.SoLuotDangKy}</td><td class="tnum">${vnd(r.DoanhThu)}</td></tr>`).join("")}
        </tbody></table>` : `<p class="muted">Chưa có giao dịch nào thành công.</p>`}
      </div>
    </div>`;
  }
  function adminTeachersTab() {
    const list = ADMIN.teachers || [];
    return `
    <div class="sec-head"><div><h2 style="font-size:1.2rem">Giảng viên</h2><p class="muted">Admin trực tiếp cấp tài khoản — giảng viên không tự đăng ký.</p></div>
      <button class="btn btn-accent" data-add-teacher>+ Cấp tài khoản giảng viên</button></div>
    ${list.length ? `<table class="data-table"><thead><tr><th>Giảng viên</th><th>Chuyên môn</th><th>Khóa học</th><th>Học viên</th><th>Doanh thu</th><th>Trạng thái</th><th></th></tr></thead><tbody>
      ${list.map((t) => `<tr>
        <td><b>${esc(t.HoTen)}</b><br><span class="muted" style="font-size:.78rem">${esc(t.Email)}</span></td>
        <td class="muted">${esc(t.ChuyenMon || "—")}</td>
        <td class="tnum">${t.SoKhoaHoc}</td>
        <td class="tnum">${t.SoHocVien}</td>
        <td class="tnum">${vnd(t.TongDoanhThu)}</td>
        <td>${statusBadge(t.TrangThaiTK)}</td>
        <td><div class="row-acts"><button class="btn btn-ghost btn-sm" data-teacher-status="${t.MaGV}" data-cur="${t.TrangThaiTK}">${t.TrangThaiTK === "active" ? "🔒 Khóa" : "🔓 Mở khóa"}</button><button class="btn btn-ghost btn-sm" data-reset-pw="teachers:${t.MaGV}" title="Tạo mật khẩu tạm mới và đăng xuất họ khỏi mọi thiết bị">🔑 Cấp lại MK</button></div></td>
      </tr>`).join("")}
    </tbody></table>` : `<div class="empty-state"><div class="es-ic">🧑‍🏫</div><h3>Chưa có giảng viên</h3><p>Cấp tài khoản giảng viên đầu tiên.</p></div>`}`;
  }
  function adminStudentsTab() {
    const list = ADMIN.students || [];
    if (!list.length) return `<div class="empty-state"><div class="es-ic">🎓</div><h3>Chưa có học viên</h3></div>`;
    return `<table class="data-table"><thead><tr><th>Học viên</th><th>Ngày đăng ký</th><th>Lượt ĐK</th><th>Tổng chi tiêu</th><th>Trạng thái</th><th></th></tr></thead><tbody>
      ${list.map((s) => `<tr>
        <td><b>${esc(s.HoTen)}</b><br><span class="muted" style="font-size:.78rem">${esc(s.Email)}</span></td>
        <td>${esc(String(s.NgayDK).slice(0, 10))}</td>
        <td class="tnum">${s.SoLuotDangKy}</td>
        <td class="tnum">${vnd(s.TongChiTieu)}</td>
        <td>${statusBadge(s.TrangThaiTK)}</td>
        <td><div class="row-acts"><button class="btn btn-ghost btn-sm" data-student-status="${s.MaHV}" data-cur="${s.TrangThaiTK}">${s.TrangThaiTK === "active" ? "🔒 Khóa" : "🔓 Mở khóa"}</button><button class="btn btn-ghost btn-sm" data-reset-pw="students:${s.MaHV}" title="Tạo mật khẩu tạm mới và đăng xuất họ khỏi mọi thiết bị">🔑 Cấp lại MK</button></div></td>
      </tr>`).join("")}
    </tbody></table>`;
  }
  function adminCoursesTab() {
    const list = ADMIN.courses || [];
    if (!list.length) return `<div class="empty-state"><div class="es-ic">📚</div><h3>Chưa có khóa học</h3></div>`;
    return `<table class="data-table"><thead><tr><th>Khóa học</th><th>Giảng viên</th><th>Bài học</th><th>Lượt ĐK</th><th>Doanh thu</th><th>Trạng thái</th></tr></thead><tbody>
      ${list.map((c) => `<tr>
        <td><b>${esc(c.TenKH)}</b></td>
        <td class="muted">${esc(c.TenGV)}</td>
        <td class="tnum">${c.SoBaiHoc}</td>
        <td class="tnum">${c.SoLuotDangKy}</td>
        <td class="tnum">${vnd(c.DoanhThu)}</td>
        <td><select class="status-select" data-course-status="${c.MaKH}">
          <option value="draft" ${c.TrangThai === "draft" ? "selected" : ""}>Nháp</option>
          <option value="published" ${c.TrangThai === "published" ? "selected" : ""}>Công khai</option>
          <option value="archived" ${c.TrangThai === "archived" ? "selected" : ""}>Lưu trữ</option>
        </select></td>
      </tr>`).join("")}
    </tbody></table>`;
  }
  function adminLessonsTab() {
    const list = ADMIN.lessons || [];
    if (!list.length) return `<div class="empty-state"><div class="es-ic">📖</div><h3>Chưa có bài học</h3></div>`;
    return `<p class="muted" style="margin-bottom:14px">Chỉ xem — bài học do giảng viên tạo/sửa trong trang quản lý giảng dạy của họ.</p>
    <table class="data-table"><thead><tr><th>Bài học</th><th>Thứ tự</th><th>Khóa học</th><th>Giảng viên</th><th>Thời lượng</th><th>Video</th></tr></thead><tbody>
      ${list.map((l) => `<tr>
        <td><b>${esc(l.TenBH)}</b></td>
        <td class="tnum">${l.ThuTu}</td>
        <td class="muted">${esc(l.TenKH)}</td>
        <td class="muted">${esc(l.TenGV)}</td>
        <td class="tnum">${l.ThoiLuong || 0} phút</td>
        <td>${l.VideoBaiGiang ? `<span class="pill ok">${ico("play")} Có</span>` : `<span class="muted">—</span>`}</td>
      </tr>`).join("")}
    </tbody></table>`;
  }
  function adminEnrollmentsTab() {
    const list = ADMIN.enrollments || [];
    if (!list.length) return `<div class="empty-state"><div class="es-ic">📝</div><h3>Chưa có lượt đăng ký</h3></div>`;
    return `<p class="muted" style="margin-bottom:14px">Tối đa 500 lượt gần nhất. Đăng ký do học viên tự thực hiện qua trang khóa học — hủy thì tự hoàn tiền nếu đã thanh toán (xem mục Thanh toán).</p>
    <table class="data-table"><thead><tr><th>Mã ĐK</th><th>Học viên</th><th>Khóa học</th><th>Học phí</th><th>Ngày ĐK</th><th>Trạng thái</th><th></th></tr></thead><tbody>
      ${list.map((d) => `<tr>
        <td class="muted">${esc(d.MaDK)}</td>
        <td><b>${esc(d.TenHV)}</b></td>
        <td class="muted">${esc(d.TenKH)}</td>
        <td class="tnum">${vnd(d.HocPhi)}</td>
        <td>${esc(String(d.NgayDangKy).slice(0, 10))}</td>
        <td>${enrollStatusBadge(d.TTDangKy)}</td>
        <td>${d.TTDangKy !== "da_huy" ? `<button class="btn btn-danger-ghost btn-sm" data-cancel-enroll="${esc(d.MaDK)}">Hủy đăng ký</button>` : ""}</td>
      </tr>`).join("")}
    </tbody></table>`;
  }
  function adminQuizzesTab() {
    const list = ADMIN.quizzes || [];
    if (!list.length) return `<div class="empty-state"><div class="es-ic">🧪</div><h3>Chưa có bài kiểm tra</h3></div>`;
    return `<p class="muted" style="margin-bottom:14px">Chỉ xem — bài kiểm tra do giảng viên soạn trong trang quản lý giảng dạy.</p>
    <table class="data-table"><thead><tr><th>Bài kiểm tra</th><th>Thuộc bài học</th><th>Khóa học</th><th>Thời gian</th><th>Điểm tối đa</th><th>Số lượt tối đa</th><th>Trạng thái</th></tr></thead><tbody>
      ${list.map((q) => `<tr>
        <td><b>${esc(q.TenBKT)}</b></td>
        <td class="muted">${esc(q.TenBH)}</td>
        <td class="muted">${esc(q.TenKH)}</td>
        <td class="tnum">${q.ThoiGian} phút</td>
        <td class="tnum">${q.DiemToiDa}</td>
        <td class="tnum">${q.SoLanLamToiDa ?? "∞"}</td>
        <td>${statusBadge(q.TrangThai)}</td>
      </tr>`).join("")}
    </tbody></table>`;
  }
  function adminResultsTab() {
    const list = ADMIN.results || [];
    if (!list.length) return `<div class="empty-state"><div class="es-ic">✅</div><h3>Chưa có kết quả bài kiểm tra</h3></div>`;
    return `<p class="muted" style="margin-bottom:14px">Chỉ xem — tối đa 500 kết quả gần nhất.</p>
    <table class="data-table"><thead><tr><th>Học viên</th><th>Khóa học</th><th>Bài kiểm tra</th><th>Lần làm</th><th>Điểm số</th><th>Thời điểm</th></tr></thead><tbody>
      ${list.map((r) => `<tr>
        <td><b>${esc(r.TenHV)}</b></td>
        <td class="muted">${esc(r.TenKH)}</td>
        <td class="muted">${esc(r.TenBKT)}</td>
        <td class="tnum">${r.LanLam}</td>
        <td class="tnum">${r.DiemSo}/${r.DiemToiDa}</td>
        <td class="muted">${esc(String(r.ThoiGianLam).slice(0, 16).replace("T", " "))}</td>
      </tr>`).join("")}
    </tbody></table>`;
  }
  function adminPaymentsTab() {
    const list = ADMIN.payments || [];
    if (!list.length) return `<div class="empty-state"><div class="es-ic">💳</div><h3>Chưa có giao dịch</h3></div>`;
    const pendingN = list.filter((t) => t.TrangThaiTT === "pending").length;
    return `<p class="muted" style="margin-bottom:14px">Tối đa 500 giao dịch gần nhất. Doanh thu hệ thống chỉ tính dòng trạng thái "Thành công" — duyệt các dòng "Đang chờ" để mở khóa nội dung cho học viên.${pendingN ? ` <b>${pendingN} giao dịch đang chờ duyệt.</b>` : ""}</p>
    <table class="data-table"><thead><tr><th>Học viên</th><th>Khóa học</th><th>Số tiền</th><th>Phương thức</th><th>Loại GD</th><th>Thời gian</th><th>Trạng thái</th><th></th></tr></thead><tbody>
      ${list.map((t) => `<tr class="${t.TrangThaiTT === "pending" ? "row-pending" : ""}">
        <td><b>${esc(t.TenHV)}</b></td>
        <td class="muted">${esc(t.TenKH)}</td>
        <td class="tnum">${t.LoaiGiaoDich === "hoan_tien" ? "−" : ""}${vnd(t.SoTien)}</td>
        <td class="muted">${esc(t.PhuongThucTT || "—")}</td>
        <td class="muted">${t.LoaiGiaoDich === "hoan_tien" ? "↩️ Hoàn tiền" : "Thanh toán"}</td>
        <td class="muted">${esc(String(t.ThoiGian).slice(0, 16).replace("T", " "))}</td>
        <td>${statusBadge(t.TrangThaiTT)}</td>
        <td>${t.TrangThaiTT === "pending" ? `<div class="row-acts"><button class="btn btn-accent btn-sm" data-approve-pay="${esc(t.MaTT)}">✓ Duyệt</button><button class="btn btn-danger-ghost btn-sm" data-reject-pay="${esc(t.MaTT)}">✕ Từ chối</button></div>` : ""}</td>
      </tr>`).join("")}
    </tbody></table>`;
  }
  function adminCertificatesTab() {
    const list = ADMIN.certificates || [];
    if (!list.length) return `<div class="empty-state"><div class="es-ic">🏅</div><h3>Chưa có chứng chỉ nào được cấp</h3></div>`;
    return `<table class="data-table"><thead><tr><th>Học viên</th><th>Khóa học</th><th>Ngày cấp</th><th>Hiệu lực</th></tr></thead><tbody>
      ${list.map((c) => `<tr>
        <td><b>${esc(c.TenHV)}</b></td>
        <td class="muted">${esc(c.TenKH)}</td>
        <td>${esc(String(c.NgayCap).slice(0, 10))}</td>
        <td>${statusBadge(c.HieuLuc)}</td>
      </tr>`).join("")}
    </tbody></table>`;
  }
  function adminReviewsTab() {
    const list = ADMIN.reviews || [];
    if (!list.length) return `<div class="empty-state"><div class="es-ic">⭐</div><h3>Chưa có đánh giá nào</h3></div>`;
    return `<p class="muted" style="margin-bottom:14px">Toàn bộ đánh giá trên hệ thống (tối đa 500 gần nhất) — trang giảng viên chỉ thấy đánh giá khóa của riêng họ.</p>
    <table class="data-table"><thead><tr><th>Học viên</th><th>Khóa học</th><th>Điểm</th><th>Nhận xét</th><th>Ngày</th></tr></thead><tbody>
      ${list.map((r) => `<tr>
        <td><b>${esc(r.TenHV)}</b></td>
        <td class="muted">${esc(r.TenKH)}</td>
        <td class="tnum">${ratingTxt(r.DiemDanhGia)}</td>
        <td class="muted">${esc(r.NhanXet || "—")}</td>
        <td class="muted">${esc(String(r.NgayDG).slice(0, 10))}</td>
      </tr>`).join("")}
    </tbody></table>`;
  }
  // mỗi truy vấn là 1 mục sidebar riêng — vào là tự tải, đổi khoảng thời gian là tự tải lại (không có nút "Chạy")
  function reportDetailTab(id) {
    const r = REPORT_BY_ID[id];
    const st = ADMIN.reportState[id];
    return `
    <div class="sec-head"><div><h2 style="font-size:1.2rem">${esc(r.ten)}${r.sao ? ` <span class="rc-star">⭐</span>` : ""}</h2><p class="muted">${esc(r.mo)}</p></div></div>
    ${r.params.length ? `<div class="rc-params" style="margin:4px 0 18px">
      ${r.params.map(([key, label, type]) => `<div class="rc-field"><label>${label}</label><input type="${type}" data-report-param="${id}:${key}" value="${esc(st.params[key])}"></div>`).join("")}
    </div>` : ""}
    ${st.loading ? inlineLoading() : st.error ? `<p class="rc-err">⚠️ ${esc(st.error)}</p>` : `<div class="rc-result">${autoTable(st.rows)}</div>`}`;
  }
  async function runReport(id) {
    const st = ADMIN.reportState[id];
    st.loading = true; st.error = null; render();
    try { st.rows = await API.report(id, st.params); }
    catch (e) { st.error = e.message; }
    finally { st.loading = false; render(); }
  }
  function openCreateTeacherForm() {
    openModal(`<div class="modal-card"><button class="modal-close" data-close aria-label="Đóng">✕</button>
      <h2 class="modal-title">Cấp tài khoản giảng viên</h2>
      <p class="muted" style="margin-bottom:16px;font-size:.85rem">Hệ thống sẽ tạo mật khẩu tạm — gửi cho giảng viên để họ đăng nhập và tự đổi mật khẩu.</p>
      <div class="auth-err" id="ctErr" hidden></div>
      <form id="teacherForm">
        <div class="field"><label>Họ và tên *</label><input id="ctTen" placeholder="VD: Nguyễn Văn B"></div>
        <div class="field"><label>Email *</label><input id="ctEmail" type="email" placeholder="gv@email.com"></div>
        <div class="field-row">
          <div class="field"><label>Chuyên môn</label><input id="ctCM" placeholder="VD: Lập trình Java"></div>
          <div class="field"><label>Trình độ</label><input id="ctTD" placeholder="VD: Thạc sĩ"></div>
        </div>
        <div class="field"><label>Số điện thoại</label><input id="ctSdt" placeholder="09xxxxxxxx"></div>
        <div class="form-actions"><button type="button" class="btn btn-ghost" data-close>Hủy</button><button type="submit" class="btn btn-primary" id="ctSubmit">Tạo tài khoản</button></div>
      </form></div>`);
    $$("[data-close]").forEach((b) => b.onclick = closeModal);
    $("#teacherForm").onsubmit = async (e) => {
      e.preventDefault();
      const err = $("#ctErr"), fail = (m) => { err.textContent = m; err.hidden = false; };
      const hoTen = $("#ctTen").value.trim(), email = $("#ctEmail").value.trim();
      if (!hoTen) return fail("Vui lòng nhập họ tên.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Email không hợp lệ.");
      const btn = $("#ctSubmit"); btn.disabled = true;
      try {
        const r = await API.adminCreateTeacher({ hoTen, email, chuyenMon: $("#ctCM").value.trim(), trinhDo: $("#ctTD").value.trim(), sdt: $("#ctSdt").value.trim() });
        ADMIN.teachers = null; ADMIN.overview = null;
        openTeacherCreatedModal(hoTen, r);
      } catch (e2) { fail(e2.message); btn.disabled = false; }
    };
  }
  function openTeacherCreatedModal(hoTen, r) {
    openModal(`<div class="modal-card">
      <h2 class="modal-title">🎉 Đã tạo tài khoản cho ${esc(hoTen)}</h2>
      <p class="muted" style="font-size:.85rem;margin-bottom:14px">Mật khẩu tạm chỉ hiển thị <b>một lần duy nhất</b> — hãy gửi ngay cho giảng viên.</p>
      <div class="credential-box">
        <div><span class="muted">Email</span><b>${esc(r.email)}</b></div>
        <div><span class="muted">Mật khẩu tạm</span><b class="tnum">${esc(r.tempPassword)}</b></div>
      </div>
      <div class="form-actions"><button class="btn btn-primary btn-block" id="ctDone">Đã lưu — Đóng</button></div>
    </div>`);
    $("#ctDone").onclick = async () => { closeModal(); await loadAdminTab("teachers"); render(); };
  }
  // cấp lại mật khẩu (quên mật khẩu → admin tạo mật khẩu tạm): mật khẩu cũ và mọi phiên đăng nhập hiện có của người đó mất hiệu lực ngay
  function resetPasswordFlow(kind, id) {
    const row = ((kind === "teachers" ? ADMIN.teachers : ADMIN.students) || []).find((x) => (x.MaGV || x.MaHV) === id);
    const name = row ? row.HoTen : id;
    openAsk("Cấp lại mật khẩu?", `Tạo mật khẩu tạm mới cho ${name}. Mật khẩu cũ và các phiên đăng nhập hiện tại của họ sẽ không dùng được nữa.`, "Cấp lại", async () => {
      const yes = $("#askYes"); if (yes) { yes.disabled = true; yes.textContent = "Đang tạo…"; }
      try { openTempPasswordModal(await API.adminResetPassword(kind, id)); }
      catch (e) { closeModal(); toast(e.message); }
    });
  }
  function openTempPasswordModal(r) {
    openModal(`<div class="modal-card">
      <h2 class="modal-title">${ico("key")} Mật khẩu tạm cho ${esc(r.hoTen || r.ma)}</h2>
      <p class="muted" style="font-size:.85rem;margin-bottom:14px">Mật khẩu chỉ hiển thị <b>một lần duy nhất</b> — gửi ngay cho họ và nhắc đổi lại ở trang Hồ sơ sau khi đăng nhập.</p>
      <div class="credential-box">
        <div><span class="muted">Email</span><b>${esc(r.email)}</b></div>
        <div><span class="muted">Mật khẩu tạm</span><b class="tnum">${esc(r.tempPassword)}</b></div>
      </div>
      <div class="form-actions"><button class="btn btn-primary btn-block" id="tpDone">Đã lưu — Đóng</button></div>
    </div>`);
    $("#tpDone").onclick = closeModal;
  }
  async function toggleTeacherStatus(maGV, cur) {
    try {
      await API.adminSetTeacherStatus(maGV, cur === "active" ? "suspended" : "active");
      ADMIN.teachers = await API.adminTeachers(); ADMIN.overview = null;
      toast("Đã cập nhật trạng thái"); render();
    } catch (e) { toast(e.message); }
  }
  async function toggleStudentStatus(maHV, cur) {
    try {
      await API.adminSetStudentStatus(maHV, cur === "active" ? "suspended" : "active");
      ADMIN.students = await API.adminStudents();
      toast("Đã cập nhật trạng thái"); render();
    } catch (e) { toast(e.message); }
  }
  async function setCourseStatus(maKH, status) {
    try {
      await API.adminSetCourseStatus(maKH, status);
      ADMIN.courses = await API.adminCourses(); ADMIN.overview = null;
      toast("Đã cập nhật trạng thái khóa học");
    } catch (e) { toast(e.message); render(); }
  }
  async function approvePayment(maTT) {
    try {
      await API.adminApprovePayment(maTT);
      ADMIN.payments = await API.adminPayments(); ADMIN.overview = null;
      toast("Đã duyệt — nội dung khóa học đã mở cho học viên ✅"); render();
    } catch (e) { toast(e.message); }
  }
  async function rejectPayment(maTT) {
    try {
      await API.adminRejectPayment(maTT);
      ADMIN.payments = await API.adminPayments(); ADMIN.overview = null;
      toast("Đã từ chối giao dịch — học viên có thể gửi lại"); render();
    } catch (e) { toast(e.message); }
  }
  function cancelEnrollment(maDK) {
    openConfirm("Hủy lượt đăng ký này?", "Nếu đã thanh toán thành công, hệ thống tự ghi 1 giao dịch hoàn tiền đúng số tiền đã thu — không xóa giao dịch thanh toán cũ.", async () => {
      try {
        const r = await API.adminCancelEnrollment(maDK);
        ADMIN.enrollments = await API.adminEnrollments(); ADMIN.payments = null; ADMIN.overview = null;
        closeModal(); toast(r.MaTT ? `Đã hủy đăng ký — hoàn ${vnd(r.daTra)}` : "Đã hủy đăng ký"); render();
      } catch (e) { toast(e.message); }
    });
  }

  /* ============ CRUD khóa học / bài học (giảng viên) ============ */
  function openCourseForm(maKH) {
    const c = maKH ? COURSES.find((x) => x.MaKH === maKH) : null;
    const catOpts = ["Công nghệ thông tin", "Thiết kế", "Kinh doanh", "Ngoại ngữ", "Khác"].map((x) => `<option ${c && c.LinhVuc === x ? "selected" : ""}>${x}</option>`).join("");
    const lvlOpts = [["co_ban", "Cơ bản"], ["trung_cap", "Trung cấp"], ["nang_cao", "Nâng cao"]].map(([v, l]) => `<option value="${v}" ${c && c.TrinhDo === v ? "selected" : ""}>${l}</option>`).join("");
    openModal(`
      <div class="modal-card"><button class="modal-close" data-close aria-label="Đóng">✕</button>
        <h2 class="modal-title">${c ? "Sửa khóa học" : "Thêm khóa học mới"}</h2>
        <div class="auth-err" id="cfErr" hidden></div>
        <form id="courseForm">
          <div class="field"><label>Tên khóa học *</label><input id="cfTen" value="${c ? esc(c.TenKH) : ""}" placeholder="VD: Nhập môn Lập trình Web"></div>
          <div class="field"><label>Mô tả</label><textarea id="cfMota" rows="3" placeholder="Giới thiệu ngắn...">${c ? esc(c.MoTa) : ""}</textarea></div>
          <div class="field-row"><div class="field"><label>Lĩnh vực</label><select id="cfCat">${catOpts}</select></div>
            <div class="field"><label>Trình độ</label><select id="cfLvl">${lvlOpts}</select></div></div>
          <div class="field-row"><div class="field"><label>Học phí (₫) *</label><input id="cfPhi" type="number" min="0" value="${c ? Number(c.HocPhi) : ""}" placeholder="590000"></div>
            <div class="field"><label>Thời lượng (giờ)</label><input id="cfTL" type="number" min="1" value="${c ? c.ThoiLuong : ""}" placeholder="40"></div></div>
          ${!c ? `<div class="auth-note">📋 Khóa học mới sẽ ở trạng thái <b>Nháp</b> — admin kiểm tra nội dung rồi mới công khai.</div>` : ""}
          <div class="form-actions"><button type="button" class="btn btn-ghost" data-close>Hủy</button><button type="submit" class="btn btn-primary" id="cfSubmit">${c ? "Lưu thay đổi" : "Tạo khóa học"}</button></div>
        </form></div>`);
    $$("[data-close]").forEach((b) => b.onclick = closeModal);
    $("#courseForm").onsubmit = (e) => { e.preventDefault(); saveCourse(maKH); };
  }
  async function saveCourse(maKH) {
    const err = $("#cfErr"), fail = (m) => { err.textContent = m; err.hidden = false; };
    const body = { TenKH: $("#cfTen").value.trim(), MoTa: $("#cfMota").value.trim(), LinhVuc: $("#cfCat").value, TrinhDo: $("#cfLvl").value, HocPhi: parseInt($("#cfPhi").value, 10), ThoiLuong: parseInt($("#cfTL").value, 10) || 1 };
    if (!body.TenKH) return fail("Vui lòng nhập tên khóa học.");
    if (isNaN(body.HocPhi) || body.HocPhi < 0) return fail("Học phí không hợp lệ.");
    const btn = $("#cfSubmit"); btn.disabled = true;
    try {
      if (maKH) await API.updateCourse(maKH, body); else await API.createCourse(body);
      COURSES = await API.listCourses(); TEACH.overview = null; closeModal();
      toast(maKH ? "Đã lưu thay đổi ✓" : "Đã tạo khóa học — đang chờ admin duyệt 📋");
      if (!maKH) { TEACH.overview = await API.teacherOverview().catch(() => TEACH.overview); }
      render(); renderNav();
    } catch (e) { fail(e.message); btn.disabled = false; }
  }
  function delCourse(maKH) {
    const c = COURSES.find((x) => x.MaKH === maKH); if (!c) return;
    openConfirm(`Xóa khóa học "${esc(c.TenKH)}"?`, "Toàn bộ bài học trong khóa cũng bị xóa và không thể hoàn tác.", async () => {
      try { await API.deleteCourse(maKH); COURSES = await API.listCourses(); closeModal(); toast("Đã xóa khóa học"); render(); renderNav(); }
      catch (e) { closeModal(); toast(e.message); }
    });
  }
  function openLessonForm(maKH, lesson) {
    openModal(`
      <div class="modal-card"><button class="modal-close" data-close aria-label="Đóng">✕</button>
        <h2 class="modal-title">${lesson ? "Sửa bài học" : "Thêm bài học"}</h2>
        <div class="auth-err" id="lfErr" hidden></div>
        <form id="lessonForm">
          <div class="field"><label>Tên bài học *</label><input id="lfTen" value="${lesson ? esc(lesson.TenBH) : ""}" placeholder="VD: Giới thiệu HTML"></div>
          <div class="field-row"><div class="field"><label>Thời lượng (phút)</label><input id="lfDur" type="number" min="0" value="${lesson ? lesson.ThoiLuong || "" : ""}" placeholder="18"></div></div>
          <div class="field"><label>Link video YouTube</label><input id="lfVid" value="${lesson ? esc(lesson.VideoBaiGiang) : ""}" placeholder="https://youtu.be/... (để trống nếu chưa có)"></div>
          <div class="form-actions"><button type="button" class="btn btn-ghost" data-close>Hủy</button><button type="submit" class="btn btn-primary" id="lfSubmit">${lesson ? "Lưu" : "Thêm bài học"}</button></div>
        </form></div>`);
    $$("[data-close]").forEach((b) => b.onclick = closeModal);
    $("#lessonForm").onsubmit = (e) => { e.preventDefault(); saveLesson(maKH, lesson); };
  }
  async function saveLesson(maKH, lesson) {
    const err = $("#lfErr"), fail = (m) => { err.textContent = m; err.hidden = false; };
    const body = { TenBH: $("#lfTen").value.trim(), ThoiLuong: parseInt($("#lfDur").value, 10) || 0, VideoBaiGiang: $("#lfVid").value.trim() };
    if (!body.TenBH) return fail("Vui lòng nhập tên bài học.");
    if (body.VideoBaiGiang && !ytEmbed(body.VideoBaiGiang)) return fail("Link YouTube không hợp lệ (hỗ trợ youtu.be/... hoặc youtube.com/watch?v=...).");
    const btn = $("#lfSubmit"); btn.disabled = true;
    try {
      if (lesson) await API.updateLesson(lesson.MaBH, body); else await API.addLesson(maKH, body);
      detailCache = await API.getCourse(maKH); COURSES = await API.listCourses();
      closeModal(); toast(lesson ? "Đã lưu bài học ✓" : "Đã thêm bài học ✓"); render();
    } catch (e) { fail(e.message); btn.disabled = false; }
  }
  function delLesson(maBH) {
    const c = detailCache, l = (c.lessons || []).find((x) => x.MaBH === maBH); if (!l) return;
    openConfirm(`Xóa bài học "${esc(l.TenBH)}"?`, "Hành động này không thể hoàn tác.", async () => {
      try { await API.deleteLesson(maBH); detailCache = await API.getCourse(c.MaKH); COURSES = await API.listCourses(); closeModal(); toast("Đã xóa bài học"); render(); }
      catch (e) { closeModal(); toast(e.message); }
    });
  }

  /* ============ ĐĂNG KÝ KHÓA HỌC ============ */
  function enrollCTA(c) {
    if (!AUTH.user) return `<button class="btn btn-accent btn-block btn-lg" data-auth="signin">Đăng nhập để học</button>`;
    if (AUTH.user.role === "student") {
      const e = c._enroll || {};
      if (!e.enrolled) return `<button class="btn btn-accent btn-block btn-lg" data-enroll>Đăng ký học ${ico("arrow-r")}</button>`;
      // khóa có phí mà chưa thanh toán: giữ chỗ nhưng chưa mở nội dung
      if (e.dangCho) return `<div class="enrolled-badge pending"><span class="eb-ic">${ico("clock")}</span> Đã gửi yêu cầu thanh toán — chờ admin xác nhận</div>`;
      if (!e.entitled) return `<div class="enrolled-badge pending"><span class="eb-ic">${ico("clock")}</span> Đã đăng ký — chờ thanh toán</div><button class="btn btn-accent btn-block btn-lg" data-pay-detail="${esc(e.MaDK)}">Thanh toán ${vnd(c.HocPhi)} ${ico("arrow-r")}</button>`;
      return `<div class="enrolled-badge"><span class="eb-ic">${ico("check")}</span> Bạn đã đăng ký khóa học này</div><button class="btn btn-accent btn-block btn-lg" id="startBtn">Vào học ${ico("arrow-r")}</button>`;
    }
    return c.quyen && c.quyen.xem
      ? `<button class="btn btn-accent btn-block btn-lg" id="startBtn">Xem trước khóa học ${ico("arrow-r")}</button>`
      : `<p class="muted" style="font-size:.86rem;text-align:center">Chỉ học viên đã đăng ký mới xem được bài giảng.</p>`;
  }
  async function doEnroll() {
    if (!AUTH.user) return openAuth("signin");
    if (!isStudent()) return toast("Chỉ tài khoản học viên mới đăng ký được khóa học");
    try {
      await API.enroll(detailCache.MaKH);
      detailCache = await loadDetail(detailCache.MaKH); // nạp lại: khóa miễn phí thì video mở ngay
      stuReset();
      try { STU.overview = await API.studentOverview(); } catch (e) {}
      render();
      const en = detailCache._enroll;
      if (en && en.enrolled && !en.entitled) { toast("Đã đăng ký — thanh toán để mở khóa nội dung 💳"); openPayModal(en.MaDK); }
      else toast("Đăng ký khóa học thành công 🎉");
    } catch (e) { toast(e.message); }
  }

  /* ============ DANH SÁCH BÀI KIỂM TRA (trong chi tiết khóa) ============ */
  function quizListHTML() {
    const c = detailCache, quizzes = c.quizzes || [];
    const en = c._enroll || {}, enrolled = en.enrolled, entitled = en.entitled;
    const isStudent = AUTH.user && AUTH.user.role === "student";
    if (!quizzes.length)
      return `<div class="empty-state"><div class="es-ic">📝</div><h3>Chưa có bài kiểm tra</h3><p>Khóa học này chưa có bài kiểm tra nào.</p></div>`;
    return `<div class="quiz-list">${quizzes.map((q) => `
      <div class="quiz-item">
        <div class="qi-ic">📝</div>
        <div class="qi-main">
          <b>${esc(q.TenBKT)}</b>
          <div class="qi-meta">
            <span>📋 ${q.SoCauHoi} câu</span><span>⏱ ${q.ThoiGian} phút</span><span>🎯 ${q.DiemToiDa} điểm</span>
            <span>🔁 ${q.SoLanLamToiDa ? `tối đa ${q.SoLanLamToiDa} lượt` : "không giới hạn"}</span>
            <span class="muted">· ${esc(q.TenBH)}</span>
          </div>
        </div>
        <div class="qi-act">${isStudent
          ? (!enrolled ? `<button class="btn btn-ghost btn-sm" data-enroll>Đăng ký để làm</button>`
            : en.dangCho ? `<span class="muted" style="font-size:.8rem">⏳ Chờ admin duyệt</span>`
            : !entitled ? `<button class="btn btn-ghost btn-sm" data-pay-detail="${esc(en.MaDK)}">Thanh toán để làm</button>`
            : `<button class="btn btn-accent btn-sm" data-do-quiz="${q.MaBKT}">Làm bài →</button>`)
          : `<span class="muted" style="font-size:.8rem">Đăng nhập học viên để làm</span>`}</div>
      </div>`).join("")}</div>`;
  }

  /* ============ LÀM BÀI KIỂM TRA ============ */
  function initQuiz(bkt) {
    QUIZ = {
      bkt,
      startToken: bkt.startToken || null, // phiên làm bài do máy chủ cấp; nộp bài phải kèm theo (máy chủ tự tính giờ, không tin đồng hồ trình duyệt)
      answers: new Array((bkt.cauHoi || []).length).fill(-1),
      timeLeft: (Number(bkt.ThoiGian) || 10) * 60,
      timer: null, result: null, submitting: false,
    };
  }
  function startQuizTimer() {
    if (!QUIZ) return;
    clearInterval(QUIZ.timer);
    QUIZ.timer = setInterval(() => {
      QUIZ.timeLeft--;
      const el = $("#quizTimer"); if (el) el.textContent = fmtTime(QUIZ.timeLeft);
      const box = $("#quizTimerBox"); if (box && QUIZ.timeLeft <= 30) box.classList.add("urgent");
      if (QUIZ.timeLeft <= 0) { clearInterval(QUIZ.timer); toast("Hết giờ — tự động nộp bài"); doSubmitQuiz(); }
    }, 1000);
  }
  function viewQuiz() {
    if (!QUIZ) return `<section class="wrap" style="padding-top:12px"><div class="empty-state"><div class="es-ic">⚠️</div><h3>Không tải được bài kiểm tra</h3><button class="btn btn-ghost" data-go="catalog">← Về danh sách</button></div></section>`;
    if (QUIZ.result) return quizResultHTML();
    const q = QUIZ.bkt, questions = q.cauHoi || [];
    const answered = QUIZ.answers.filter((a) => a >= 0).length;
    return `
    <section class="wrap quiz-wrap">
      <div class="quiz-bar">
        <div class="qb-info"><b>${esc(q.TenBKT)}</b><span class="muted" id="quizProgress">${answered}/${questions.length} câu đã trả lời</span></div>
        <div class="qb-timer" id="quizTimerBox"><span class="qt-ic">⏱</span><span id="quizTimer">${fmtTime(QUIZ.timeLeft)}</span></div>
        <div class="qb-prog" aria-hidden="true"><i style="--p:${questions.length ? (answered / questions.length).toFixed(3) : 0}"></i></div>
      </div>
      <div class="quiz-questions">
        ${questions.map((qq, i) => `
          <div class="qq-card">
            <div class="qq-head"><span class="qq-num">Câu ${i + 1}</span><p>${esc(qq.q)}</p></div>
            <div class="qq-opts">${(qq.opt || []).map((op, j) => `
              <button class="qq-opt ${QUIZ.answers[i] === j ? "sel" : ""}" data-ans="${i}:${j}">
                <span class="qo-key">${String.fromCharCode(65 + j)}</span><span class="qo-txt">${esc(op)}</span></button>`).join("")}
            </div>
          </div>`).join("")}
      </div>
      <div class="quiz-foot">
        <button class="btn btn-ghost" data-quiz-cancel="${q.MaKH}">Hủy</button>
        <button class="btn btn-accent btn-lg" data-quiz-submit>Nộp bài</button>
      </div>
    </section>`;
  }
  function quizResultHTML() {
    const q = QUIZ.bkt, r = QUIZ.result, questions = q.cauHoi || [];
    const pass = !!r.dat; // dùng đúng kết quả server đã tính (so theo % điểm tối đa của bài, không phải số điểm thô)
    const nguong = Math.round(r.DiemToiDa * 0.7 * 100) / 100;
    return `
    <section class="wrap" style="padding-top:12px">
      <div class="quiz-result ${pass ? "pass" : "fail"}">
        <div class="qr-badge">${pass ? "🎉" : "📚"}</div>
        <div class="qr-score tnum">${r.DiemSo}<span>/${r.DiemToiDa}</span></div>
        <p class="qr-sub">${r.SoCauDung}/${r.TongCau} câu đúng · Lần làm thứ ${r.LanLam}</p>
        <div class="qr-msg">${pass ? "Chúc mừng! Bạn đã vượt qua bài kiểm tra." : `Chưa đạt (cần ≥ ${nguong} điểm, tức 70% điểm tối đa). Hãy xem lại và thử lại nhé.`}</div>
      </div>
      ${r.dapAnDung ? `<h3 style="margin:26px 0 14px;font-size:1.1rem">Xem lại đáp án</h3>` : `<div class="panel qr-hidden"><span class="qh-ic">${ico("lock")}</span><div><b>Đáp án chưa được mở</b><p class="muted">Đáp án chỉ hiện khi bạn đạt từ 70% điểm tối đa hoặc đã dùng hết lượt làm bài — để lần sau bạn tự làm lại, không chép đáp án.</p></div></div>`}
      <div class="quiz-questions">
        ${!r.dapAnDung ? "" : questions.map((qq, i) => {
          const my = QUIZ.answers[i], correct = r.dapAnDung[i];
          return `<div class="qq-card">
            <div class="qq-head"><span class="qq-num ${my === correct ? "ok" : "no"}">Câu ${i + 1}</span><p>${esc(qq.q)}</p></div>
            <div class="qq-opts">${(qq.opt || []).map((op, j) => {
              let cls = ""; if (j === correct) cls = "correct"; else if (j === my) cls = "wrong";
              const tag = j === correct ? `<span class="qo-tag ok">✓ Đáp án đúng</span>` : (j === my ? `<span class="qo-tag no">Bạn chọn</span>` : "");
              return `<div class="qq-opt static ${cls}"><span class="qo-key">${String.fromCharCode(65 + j)}</span><span class="qo-txt">${esc(op)}</span>${tag}</div>`;
            }).join("")}</div></div>`;
        }).join("")}
      </div>
      <div class="quiz-foot">
        <button class="btn btn-ghost" data-go-detail="${q.MaKH}">← Về khóa học</button>
        ${r.conLuot ? `<button class="btn btn-accent" data-quiz-retry="${q.MaBKT}">Làm lại →</button>` : `<span class="muted">Đã hết lượt làm bài</span>`}
      </div>
    </section>`;
  }
  function selectAnswer(key, el) {
    const [i, j] = key.split(":").map(Number);
    QUIZ.answers[i] = j;
    const card = el.closest(".qq-card");
    $$(".qq-opt", card).forEach((b) => b.classList.remove("sel"));
    el.classList.add("sel");
    const p = $("#quizProgress");
    const done = QUIZ.answers.filter((a) => a >= 0).length, total = (QUIZ.bkt.cauHoi || []).length;
    if (p) p.textContent = `${done}/${total} câu đã trả lời`;
    const pr = $(".qb-prog i"); if (pr) pr.style.setProperty("--p", total ? (done / total).toFixed(3) : "0");
  }
  function submitQuiz() {
    if (!QUIZ || QUIZ.submitting || QUIZ.result) return;
    const unans = QUIZ.answers.filter((a) => a < 0).length;
    if (unans > 0) { openAsk("Nộp bài kiểm tra?", `Còn ${unans} câu chưa trả lời sẽ bị tính sai. Vẫn nộp?`, "Nộp bài", doSubmitQuiz); return; }
    doSubmitQuiz();
  }
  async function doSubmitQuiz() {
    closeModal();
    if (!QUIZ || QUIZ.submitting) return;
    QUIZ.submitting = true; clearInterval(QUIZ.timer);
    try {
      QUIZ.result = await API.submitQuiz(QUIZ.bkt.MaBKT, QUIZ.answers.map((a) => (a < 0 ? -1 : a)), QUIZ.startToken);
      stuReset();
      render("page"); window.scrollTo({ top: 0 });
      if (QUIZ.result.capChungChi) setTimeout(openCertCelebration, 900);
      else if (QUIZ.result.dat) setTimeout(() => confetti(46), 350);
    } catch (e) {
      toast(e.message);
      // phiên làm bài này không còn hiệu lực (quá giờ, đã nộp, hết lượt…) → làm tiếp cũng vô ích, đưa về danh sách bài kiểm tra
      if (["QUIZ_TIMEOUT", "BAD_ATTEMPT", "STALE_ATTEMPT", "NO_ATTEMPTS_LEFT", "NOT_ENROLLED", "UNPAID"].includes(e.code)) {
        const maKH = QUIZ && QUIZ.bkt.MaKH; QUIZ = null;
        if (maKH) go("detail", maKH, "quiz");
        return;
      }
      QUIZ.submitting = false; // lỗi tạm (mạng, nộp quá nhanh…): cho nộp lại; nếu hết giờ thì đồng hồ tự nộp lần nữa
      if (QUIZ.timeLeft > 0) startQuizTimer();
    }
  }

  /* ============ generic confirm ============ */
  function openAsk(title, msg, yesLabel, onYes) {
    openModal(`<div class="modal-card sm"><h2 class="modal-title">${esc(title)}</h2><p class="muted" style="margin-bottom:20px">${esc(msg)}</p>
      <div class="form-actions"><button class="btn btn-ghost" data-close>Hủy</button><button class="btn btn-primary" id="askYes">${esc(yesLabel)}</button></div></div>`);
    $$("[data-close]").forEach((b) => b.onclick = closeModal);
    $("#askYes").onclick = onYes;
  }

  /* ============ SOẠN BÀI KIỂM TRA (giảng viên) ============ */
  async function openQuizForm(maBH, quizMeta) {
    let full = null;
    if (quizMeta) { try { full = await API.getQuiz(quizMeta.MaBKT); } catch (e) { return toast(e.message); } }
    const state = {
      qs: (full && full.cauHoi && full.cauHoi.length) ? JSON.parse(JSON.stringify(full.cauHoi)) : [{ q: "", opt: ["", "", ""], dap: 0 }],
    };
    openModal(`
      <div class="modal-card quiz-builder"><button class="modal-close" data-close aria-label="Đóng">✕</button>
        <h2 class="modal-title">${quizMeta ? "Sửa bài kiểm tra" : "Thêm bài kiểm tra"}</h2>
        <div class="auth-err" id="qbErr" hidden></div>
        <div class="field"><label>Tên bài kiểm tra *</label><input id="qbTen" value="${full ? esc(full.TenBKT) : ""}" placeholder="VD: Kiểm tra chương 1"></div>
        <div class="field-row">
          <div class="field"><label>Thời gian (phút)</label><input id="qbTime" type="number" min="1" value="${full ? full.ThoiGian : 10}"></div>
          <div class="field"><label>Số lượt tối đa</label><input id="qbMax" type="number" min="1" value="${full && full.SoLanLamToiDa ? full.SoLanLamToiDa : ""}" placeholder="trống = ∞"></div>
          <div class="field"><label>Điểm tối đa</label><input id="qbDiemToiDa" type="number" min="1" value="${full && full.DiemToiDa ? full.DiemToiDa : 10}"></div>
        </div>
        <div class="qb-qhead"><b>Câu hỏi (${state.qs.length})</b><button class="btn btn-ghost btn-sm" id="qbAddQ">+ Thêm câu hỏi</button></div>
        <div id="qbList"></div>
        <div class="form-actions"><button class="btn btn-ghost" data-close>Hủy</button><button class="btn btn-primary" id="qbSave">${quizMeta ? "Lưu thay đổi" : "Tạo bài kiểm tra"}</button></div>
      </div>`);
    $$("[data-close]").forEach((b) => b.onclick = closeModal);

    function syncQB() {
      $$("[data-qtext]").forEach((el) => { state.qs[+el.dataset.qtext].q = el.value; });
      $$("[data-opt]").forEach((el) => { const [i, j] = el.dataset.opt.split(":").map(Number); state.qs[i].opt[j] = el.value; });
    }
    function renderQB() {
      $(".qb-qhead b").textContent = `Câu hỏi (${state.qs.length})`;
      $("#qbList").innerHTML = state.qs.map((q, i) => `
        <div class="qb-q">
          <div class="qb-q-top"><span class="qb-qn">Câu ${i + 1}</span>${state.qs.length > 1 ? `<button class="qb-del" data-delq="${i}" title="Xóa câu hỏi">🗑 Xóa</button>` : ""}</div>
          <input class="qb-qtext" data-qtext="${i}" value="${esc(q.q)}" placeholder="Nhập nội dung câu hỏi...">
          <div class="qb-hint">Chọn ô tròn ở đáp án đúng</div>
          <div class="qb-opts">${q.opt.map((op, j) => `
            <div class="qb-opt">
              <input type="radio" name="correct-${i}" ${q.dap === j ? "checked" : ""} data-correct="${i}:${j}" title="Đáp án đúng">
              <span class="qb-okey">${String.fromCharCode(65 + j)}</span>
              <input class="qb-optin" data-opt="${i}:${j}" value="${esc(op)}" placeholder="Nội dung đáp án ${String.fromCharCode(65 + j)}">
              ${q.opt.length > 2 ? `<button class="qb-optdel" data-delopt="${i}:${j}" title="Xóa đáp án">✕</button>` : ""}
            </div>`).join("")}
            ${q.opt.length < 6 ? `<button class="qb-addopt" data-addopt="${i}">+ Thêm đáp án</button>` : ""}
          </div>
        </div>`).join("");
      wireQB();
    }
    function wireQB() {
      $$("[data-correct]").forEach((el) => el.onchange = () => { const [i, j] = el.dataset.correct.split(":").map(Number); state.qs[i].dap = j; });
      $$("[data-delq]").forEach((el) => el.onclick = () => { syncQB(); state.qs.splice(+el.dataset.delq, 1); renderQB(); });
      $$("[data-addopt]").forEach((el) => el.onclick = () => { syncQB(); state.qs[+el.dataset.addopt].opt.push(""); renderQB(); });
      $$("[data-delopt]").forEach((el) => el.onclick = () => { syncQB(); const [i, j] = el.dataset.delopt.split(":").map(Number); state.qs[i].opt.splice(j, 1); if (state.qs[i].dap >= state.qs[i].opt.length) state.qs[i].dap = 0; renderQB(); });
    }
    $("#qbAddQ").onclick = () => { syncQB(); state.qs.push({ q: "", opt: ["", "", ""], dap: 0 }); renderQB(); };
    $("#qbSave").onclick = async () => {
      syncQB();
      const err = $("#qbErr"), fail = (m) => { err.textContent = m; err.hidden = false; };
      const ten = $("#qbTen").value.trim();
      if (!ten) return fail("Vui lòng nhập tên bài kiểm tra.");
      const clean = state.qs.map((q) => ({ q: q.q.trim(), opt: q.opt.map((o) => o.trim()), dap: q.dap }));
      for (let i = 0; i < clean.length; i++) {
        if (!clean[i].q) return fail(`Câu ${i + 1} chưa có nội dung.`);
        if (clean[i].opt.length < 2) return fail(`Câu ${i + 1} cần ít nhất 2 đáp án.`);
        if (clean[i].opt.some((o) => !o)) return fail(`Câu ${i + 1}: điền đủ nội dung các đáp án (hoặc xóa ô trống).`);
      }
      const body = { TenBKT: ten, ThoiGian: Number($("#qbTime").value) || 10, SoLanLamToiDa: $("#qbMax").value === "" ? null : Number($("#qbMax").value), DiemToiDa: Number($("#qbDiemToiDa").value) || 10, cauHoi: clean };
      const btn = $("#qbSave"); btn.disabled = true;
      try {
        if (quizMeta) await API.updateQuiz(quizMeta.MaBKT, body); else await API.createQuiz(maBH, body);
        detailCache.quizzes = await API.listQuizzes(detailCache.MaKH).catch(() => []);
        closeModal(); toast(quizMeta ? "Đã lưu bài kiểm tra ✓" : "Đã tạo bài kiểm tra ✓"); render();
      } catch (e) { fail(e.message); btn.disabled = false; }
    };
    renderQB();
  }
  function delQuiz(maBKT) {
    const c = detailCache, q = (c.quizzes || []).find((x) => x.MaBKT === maBKT); if (!q) return;
    openConfirm(`Xóa bài kiểm tra "${esc(q.TenBKT)}"?`, "Toàn bộ kết quả làm bài của học viên cũng bị xóa và không thể hoàn tác.", async () => {
      try { await API.deleteQuiz(maBKT); detailCache.quizzes = await API.listQuizzes(c.MaKH).catch(() => []); closeModal(); toast("Đã xóa bài kiểm tra"); render(); }
      catch (e) { closeModal(); toast(e.message); }
    });
  }

  /* ============ wiring ============ */
  function wire() {
    $$("[data-go]").forEach((el) => el.onclick = () => go(el.dataset.go));
    $$("[data-auth]").forEach((el) => el.onclick = () => openAuth(el.dataset.auth));
    $$("[data-open]").forEach((el) => el.onclick = () => { MO.morphFrom(el); go("detail", el.dataset.open); });
    $$("[data-tab]").forEach((el) => el.onclick = () => { nav.tab = el.dataset.tab; render("content"); });
    $$("[data-lesson]").forEach((el) => el.onclick = () => { nav.lesson = el.dataset.lesson; render("content"); });
    $$("[data-cat]").forEach((el) => el.onclick = () => { catState.cat = el.dataset.cat; render("content"); });
    // danh mục: gõ tìm / đổi sắp xếp chỉ vẽ lại phần lưới
    const sb = $("#searchBox");
    if (sb) sb.oninput = () => { catState.q = sb.value; refreshCatalog(); };
    const ss = $("#sortSel"); if (ss) ss.onchange = () => { catState.sort = ss.value; refreshCatalog(); };
    // trang chủ
    const hs = $("#homeSearch");
    if (hs) hs.onsubmit = (e) => { e.preventDefault(); catState.q = $("#homeQ").value.trim(); catState.cat = "all"; go("catalog"); };
    $$("[data-home-cat]").forEach((el) => el.onclick = () => { catState.cat = el.dataset.homeCat; catState.q = ""; go("catalog"); });
    $$("[data-home-free]").forEach((el) => el.onclick = () => { catState.sort = "price_asc"; catState.cat = "all"; catState.q = ""; go("catalog"); });
    $$("[data-rank-view]").forEach((el) => el.onclick = () => { catState.sort = "rating"; catState.cat = "all"; catState.q = ""; go("catalog"); });
    $$("[data-nav-go]").forEach((el) => el.onclick = () => { const [v, t] = el.dataset.navGo.split(":"); go(v, null, t); });
    const start = $("#startBtn"); if (start) start.onclick = () => { const f = (detailCache.lessons || []).find((l) => ytEmbed(l.VideoBaiGiang)); if (f) { nav.lesson = f.MaBH; nav.tab = "curr"; render(); window.scrollTo({ top: 0 }); } else toast("Khóa học chưa có video bài giảng"); };

    // giảng viên
    $$("[data-add-course]").forEach((el) => el.onclick = () => openCourseForm());
    $$("[data-edit-course]").forEach((el) => el.onclick = () => openCourseForm(el.dataset.editCourse));
    $$("[data-del-course]").forEach((el) => el.onclick = () => delCourse(el.dataset.delCourse));
    $$("[data-lessons]").forEach((el) => el.onclick = () => go("manageLessons", el.dataset.lessons));
    $$("[data-add-lesson]").forEach((el) => el.onclick = () => openLessonForm(el.dataset.addLesson, null));
    $$("[data-edit-lesson]").forEach((el) => el.onclick = () => { const l = (detailCache.lessons || []).find((x) => x.MaBH === el.dataset.editLesson); openLessonForm(detailCache.MaKH, l); });
    $$("[data-del-lesson]").forEach((el) => el.onclick = () => delLesson(el.dataset.delLesson));

    // đăng ký + bài kiểm tra
    $$("[data-enroll]").forEach((el) => el.onclick = () => doEnroll());
    $$("[data-pay-detail]").forEach((el) => el.onclick = () => openPayModal(el.dataset.payDetail));
    $$("[data-do-quiz]").forEach((el) => el.onclick = () => go("quiz", el.dataset.doQuiz));
    $$("[data-ans]").forEach((el) => el.onclick = () => selectAnswer(el.dataset.ans, el));
    $$("[data-quiz-submit]").forEach((el) => el.onclick = () => submitQuiz());
    $$("[data-quiz-cancel]").forEach((el) => el.onclick = () => go("detail", el.dataset.quizCancel, "quiz"));
    $$("[data-quiz-retry]").forEach((el) => el.onclick = () => go("quiz", el.dataset.quizRetry));
    $$("[data-go-detail]").forEach((el) => el.onclick = () => go("detail", el.dataset.goDetail, "quiz"));
    // quản lý quiz (giảng viên)
    $$("[data-add-quiz]").forEach((el) => el.onclick = () => openQuizForm(el.dataset.addQuiz, null));
    $$("[data-edit-quiz]").forEach((el) => el.onclick = () => { const q = (detailCache.quizzes || []).find((x) => x.MaBKT === el.dataset.editQuiz); openQuizForm(q.MaBH, q); });
    $$("[data-del-quiz]").forEach((el) => el.onclick = () => delQuiz(el.dataset.delQuiz));

    // bảng điều khiển giảng viên
    $$("[data-mtab]").forEach((el) => el.onclick = () => go("manage", null, el.dataset.mtab));
    $$("[data-students]").forEach((el) => el.onclick = () => openStudentsModal(el.dataset.students));

    // bảng điều khiển quản trị
    $$("[data-atab]").forEach((el) => el.onclick = () => go("admin", null, el.dataset.atab));
    $$("[data-add-teacher]").forEach((el) => el.onclick = () => openCreateTeacherForm());
    $$("[data-teacher-status]").forEach((el) => el.onclick = () => toggleTeacherStatus(el.dataset.teacherStatus, el.dataset.cur));
    $$("[data-student-status]").forEach((el) => el.onclick = () => toggleStudentStatus(el.dataset.studentStatus, el.dataset.cur));
    $$("[data-course-status]").forEach((el) => el.onchange = () => setCourseStatus(el.dataset.courseStatus, el.value));
    $$("[data-approve-pay]").forEach((el) => el.onclick = () => approvePayment(el.dataset.approvePay));
    $$("[data-reject-pay]").forEach((el) => el.onclick = () => rejectPayment(el.dataset.rejectPay));
    $$("[data-cancel-enroll]").forEach((el) => el.onclick = () => cancelEnrollment(el.dataset.cancelEnroll));
    $$("[data-report-param]").forEach((el) => el.onchange = () => {
      const [id, key] = el.dataset.reportParam.split(":");
      ADMIN.reportState[id].params[key] = el.value;
      runReport(id);
    });

    $$("[data-reset-pw]").forEach((el) => el.onclick = () => { const [kind, id] = el.dataset.resetPw.split(":"); resetPasswordFlow(kind, id); });

    // hồ sơ cá nhân
    $$("[data-edit-profile]").forEach((el) => el.onclick = () => openEditProfileForm());
    $$("[data-change-pw]").forEach((el) => el.onclick = () => openChangePasswordForm());

    // học tập của học viên
    $$("[data-ltab]").forEach((el) => el.onclick = () => go("learn", null, el.dataset.ltab));
    $$("[data-cfilter]").forEach((el) => el.onclick = () => { STU.cfilter = el.dataset.cfilter; render("content"); });
    $$("[data-bmode]").forEach((el) => el.onclick = () => { STU.boardMode = el.dataset.bmode; refreshBoard(); });
    $$("[data-gcrit]").forEach((el) => el.onclick = () => { STU.gCrit = el.dataset.gcrit; refreshBoard(); });
    $$("[data-gspan]").forEach((el) => el.onclick = () => { STU.gSpan = el.dataset.gspan; refreshBoard(); });
    $$("[data-htab]").forEach((el) => el.onclick = () => { nav.htab = el.dataset.htab; render("content"); });
    $$("[data-bcourse]").forEach((el) => el.onclick = async () => { STU.boardCourse = el.dataset.bcourse; topbar.start(); try { await loadBoard(); } catch (e) { toast(e.message); } topbar.done(); render("content"); });
    $$("[data-resume]").forEach((el) => el.onclick = () => { const [maKH, maBH] = el.dataset.resume.split(":"); pendingLesson = maBH || null; go("detail", maKH); });
    $$("[data-pay]").forEach((el) => el.onclick = () => openPayModal(el.dataset.pay));
    $$("[data-review]").forEach((el) => el.onclick = () => openReviewModal(el.dataset.review));
    $$("[data-complete]").forEach((el) => el.onclick = () => doCompleteLesson(el.dataset.complete));
    armLessonTimer();

    // thẻ/dòng bấm được nhưng không phải <button>: cho dùng bàn phím (Tab + Enter/Space)
    $$("[data-open],[data-resume],[data-lesson]").forEach((el) => {
      if (/^(BUTTON|A|INPUT)$/.test(el.tagName)) return;
      el.tabIndex = 0; if (!el.getAttribute("role")) el.setAttribute("role", "button");
      el.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); el.click(); } };
    });
  }

  /* ============ palette (tông màu) ============ */
  const PALETTES = [
    { id: "violet", ten: "Tím", c: "#8B5CF6" }, { id: "ocean", ten: "Xanh dương", c: "#3B82F6" },
    { id: "rose", ten: "Hồng", c: "#EC4899" }, { id: "emerald", ten: "Ngọc lục", c: "#10B981" },
    { id: "sunset", ten: "Cam", c: "#F59E0B" }, { id: "ruby", ten: "Đỏ ruby", c: "#EF4444" },
  ];
  const curAccent = () => document.documentElement.getAttribute("data-accent") || "violet";
  function applyAccent(id, from) {
    const [x, y] = from || [innerWidth - 120, 60];
    MO.reveal(() => { id === "violet" ? document.documentElement.removeAttribute("data-accent") : document.documentElement.setAttribute("data-accent", id); }, x, y);
    try { localStorage.setItem("n9-accent", id); } catch (e) {} renderPalette();
  }
  function renderPalette() {
    const g = $("#palGrid"); if (!g) return; const cur = curAccent();
    g.innerHTML = PALETTES.map((p) => `<button class="pal-sw ${p.id === cur ? "active" : ""}" data-pal="${p.id}"><span class="pal-dot" style="background:${p.c}"></span><span>${p.ten}</span></button>`).join("");
    $$("[data-pal]", g).forEach((b) => b.onclick = (e) => { e.stopPropagation(); applyAccent(b.dataset.pal, MO.centerOf($(".pal-dot", b) || b)); });
  }
  function initPalette() {
    let saved = null; try { saved = localStorage.getItem("n9-accent"); } catch (e) {}
    if (saved && saved !== "pine" && saved !== "violet") document.documentElement.setAttribute("data-accent", saved);
    renderPalette();
    const gt = $("#galaxyToggle");
    if (gt && window.N9Galaxy) { gt.checked = N9Galaxy.enabled(); gt.onchange = () => N9Galaxy.set(gt.checked); }
    const fx = $("#fxToggle"); // chế độ nhẹ: tự bật trên máy không có GPU; người dùng có thể đổi tay
    if (fx && window.N9Motion && N9Motion.setLite) { fx.checked = !N9Motion.isLite(); fx.onchange = () => N9Motion.setLite(!fx.checked); }
    // hệ điều hành bật "giảm chuyển động" → nền thiên hà đứng yên; cho người dùng tự bật lại chuyển động nhẹ
    const gm = $("#galaxyMotion"), gmRow = $("#galaxyMotionRow");
    if (gm && gmRow && window.N9Galaxy && N9Galaxy.osReduced()) { gmRow.hidden = false; gm.checked = N9Galaxy.motionForced(); gm.onchange = () => N9Galaxy.setMotion(gm.checked); }
    const pb = $("#paletteBtn"), pop = $("#palPop");
    pb.onclick = (e) => { e.stopPropagation(); const was = pop.hidden; closePops(); pop.hidden = !was; };
    document.addEventListener("click", (e) => { if (!pop.hidden && !pop.contains(e.target) && !pb.contains(e.target)) pop.hidden = true; });
  }
  function syncThemeIcon() {
    const b = $("#themeBtn"); if (!b) return;
    const dark = document.documentElement.getAttribute("data-theme") !== "light";
    b.innerHTML = ico(dark ? "moon" : "sun"); b.title = dark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối";
  }
  function initTheme() {
    let saved = null; try { saved = localStorage.getItem("n9-theme"); } catch (e) {}
    // mặc định giao diện tối "kính tím" — người dùng chuyển sang sáng bằng nút mặt trăng/mặt trời và được nhớ lại
    document.documentElement.setAttribute("data-theme", saved === "light" ? "light" : "dark");
    syncThemeIcon();
    $("#themeBtn").onclick = (e) => {
      const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
      const [x, y] = MO.centerOf(e.currentTarget); // bàn phím (Enter) cũng có tâm nút làm gốc loang
      MO.reveal(() => { document.documentElement.setAttribute("data-theme", next); syncThemeIcon(); }, x, y);
      try { localStorage.setItem("n9-theme", next); } catch (e2) {}
    };
  }

  /* ============ hiệu ứng toàn cục: thanh tải, gợn sóng nút, nghiêng 3D thẻ, bóng đổ thanh điều hướng ============ */
  function initMotion() {
    document.body.insertAdjacentHTML("afterbegin", '<div id="loadbar" aria-hidden="true"></div>');
    if (REDUCED) return;
    // gợn sóng (ripple) tại điểm bấm trên mọi nút
    document.addEventListener("pointerdown", (e) => {
      const b = e.target.closest(".btn, .btn-auth");
      if (!b || b.disabled) return;
      const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height), s = document.createElement("span");
      s.className = "ripple";
      s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
      b.appendChild(s); setTimeout(() => s.remove(), 650);
    });
    // thẻ khóa học nghiêng 3D theo con trỏ (bỏ qua màn hình cảm ứng)
    app.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch") return;
      const c = e.target.closest(".ccard"); if (!c) return;
      const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      c.style.setProperty("--ry", (x * 7).toFixed(2) + "deg"); c.style.setProperty("--rx", (-y * 7).toFixed(2) + "deg");
    });
    app.addEventListener("pointerout", (e) => {
      const c = e.target.closest(".ccard");
      if (c && !c.contains(e.relatedTarget)) { c.style.setProperty("--rx", "0deg"); c.style.setProperty("--ry", "0deg"); }
    });
  }

  $(".brand").onclick = () => go("home");
  $(".brand").onkeydown = (e) => { if (e.key === "Enter") go("home"); };

  /* ============ khởi động ============ */
  async function init() {
    AUTH.load();
    initTheme();
    initPalette();
    initMotion();
    initShell();
    MO.init();
    setTimeout(MO.intro, 1600); // đường lui: dù nạp dữ liệu chậm thì sidebar/thanh trên vẫn trượt vào
    renderNav();
    // phiên lưu từ lần trước còn dùng được không? (token cũ/hết hạn/bị thu hồi → onSessionLost tự đăng xuất; lỗi mạng thì bỏ qua)
    if (AUTH.user) { try { await API.getProfile(); } catch (e) { /* đã xử lý trong onSessionLost nếu là lỗi phiên */ } }
    try { COURSES = await API.listCourses(); }
    catch (e) { COURSES = []; toast(e.message); }
    await go("home");
  }
  init();
})();
