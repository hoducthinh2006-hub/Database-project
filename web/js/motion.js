/* N9 Motion — hệ chuyển động của giao diện (nạp trước app.js, app.js gọi qua window.N9Motion).
 * Nguyên tắc:
 *  - chỉ animate transform/opacity (chạy trên GPU), không làm trang giật khi cuộn;
 *  - tôn trọng "giảm chuyển động" của hệ điều hành: bật thì KHÔNG hiệu ứng nào chạy;
 *  - hiệu ứng bám theo con trỏ chỉ bật khi có chuột (không bật trên màn hình cảm ứng);
 *  - mọi hiệu ứng đều có đường lui: script lỗi / trình duyệt cũ thì trang vẫn đủ nội dung, không bao giờ kẹt ở trạng thái "đang ẩn". */
window.N9Motion = (function () {
  "use strict";
  const doc = document, root = doc.documentElement;
  const mq = (q) => !!(window.matchMedia && matchMedia(q).matches);
  const REDUCED = mq("(prefers-reduced-motion: reduce)");
  const FINE = mq("(hover: hover) and (pointer: fine)");
  const CAN = typeof Element.prototype.animate === "function" && !REDUCED;
  // Chế độ nhẹ: máy dựng hình bằng CPU (máy ảo, không GPU), cấu hình thấp, hoặc người dùng tự tắt "Hiệu ứng nâng cao".
  // Các hiệu ứng tốn dựng hình nhất (làm mờ nền, loang tròn đổi giao diện, quầng sáng theo chuột) sẽ tự bỏ để giao diện luôn mượt.
  function detectLite() {
    let pref = null;
    try { pref = localStorage.getItem("n9-fx"); } catch (e) {}
    if (pref === "full") return false;
    if (pref === "lite") return true;
    try {
      const c = doc.createElement("canvas"), gl = c.getContext("webgl") || c.getContext("experimental-webgl");
      if (!gl) return true;
      const ext = gl.getExtension("WEBGL_debug_renderer_info"), r = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
      const lose = gl.getExtension("WEBGL_lose_context"); if (lose) lose.loseContext();
      if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(r)) return true;
    } catch (e) {}
    return (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) || false;
  }
  let lite = detectLite();
  root.classList.toggle("fx-lite", lite);
  function setLite(on) {
    lite = !!on; root.classList.toggle("fx-lite", lite);
    try { localStorage.setItem("n9-fx", lite ? "lite" : "full"); } catch (e) {}
    const a = $("#aurora"); if (a && lite) a.classList.remove("on");
  }
  const EASE = { out: "cubic-bezier(.16,1,.3,1)", in: "cubic-bezier(.4,0,1,1)", spring: "cubic-bezier(.34,1.56,.64,1)" };
  const $ = (s, el = doc) => el.querySelector(s);
  const $$ = (s, el = doc) => [...el.querySelectorAll(s)];
  const raf = requestAnimationFrame;

  /* ---------- 1. MỞ ĐẦU: sidebar + thanh trên trượt vào so le ---------- */
  let introDone = false;
  function intro() {
    if (introDone) return;
    introDone = true;
    root.classList.remove("booting"); // boot.js đặt lớp này để sidebar/thanh trên ẩn tới lúc có nội dung (CSS tự mở lại sau ~1.8s nếu script hỏng)
    if (!CAN) return;
    const play = (els, from, dur, delay, step, ease) => els.forEach((el, i) =>
      el.animate([from, { opacity: 1, transform: "none" }], { duration: dur, delay: delay + i * (step || 0), easing: ease || EASE.out, fill: "backwards" }));
    play($$(".sidebar"), { opacity: 0, transform: "translateX(-30px) scale(.985)" }, 900, 0);
    play($$(".sidebar .brand .mark"), { opacity: 0, transform: "rotate(-120deg) scale(.3)" }, 900, 160, 0, EASE.spring);
    play($$("#sbNav .sb-item, #sbNav .sb-sec, #sbNav .sb-ghead"), { opacity: 0, transform: "translateX(-18px)" }, 700, 280, 34);
    play($$("#sbRecent > *, #sbFoot > *"), { opacity: 0, transform: "translateY(10px)" }, 700, 600, 40);
    play($$(".topbar .hamburger, .topbar .gsearch"), { opacity: 0, transform: "translateY(-16px)" }, 750, 140, 70);
    play($$(".topbar .top-right"), { opacity: 0, transform: "translateY(-16px)" }, 750, 260);
    play($$("footer"), { opacity: 0, transform: "none" }, 800, 700);
  }

  /* ---------- 2. RỜI TRANG: trang cũ mờ + trôi lên trong lúc nạp dữ liệu trang mới ---------- */
  function leave() {
    if (!CAN) return Promise.resolve();
    const v = $("#app > .view");
    if (!v) return Promise.resolve();
    return v.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-10px) scale(.995)" }],
      { duration: 160, easing: EASE.in, fill: "forwards" }).finished.then(() => {}, () => {});
  }

  /* ---------- 3. THANH TRƯỢT: mục đang chọn của sidebar, tab / segment ---------- */
  function sideIndicator() {
    const nav = $("#sbNav"); if (!nav) return;
    const ind = $("#sbInd", nav), act = $(".sb-item.active", nav);
    if (!ind) return;
    nav.classList.toggle("has-ind", !!act);
    if (!act) { ind.style.opacity = "0"; ind._prev = null; return; }
    const top = act.offsetTop, h = act.offsetHeight;
    if (!h) return; // sidebar đang ẩn → vẽ lại khi mở
    ind.style.cssText = `opacity:1;left:${act.offsetLeft}px;width:${act.offsetWidth}px;height:${h}px;transform:translateY(${top}px)`;
    const p = ind._prev;
    if (CAN && p && (p.top !== top || p.h !== h))
      ind.animate([{ transform: `translateY(${p.top}px)`, height: p.h + "px" }, { transform: `translateY(${top}px)`, height: h + "px" }], { duration: 520, easing: EASE.out });
    ind._prev = { top, h };
  }
  // tab/segment: viên thuốc trượt từ tab cũ sang tab mới (khối tab bị vẽ lại mỗi lần đổi tab nên nhớ vị trí cũ theo khóa)
  const PILLS = {};
  function pills(scope, key, animate) {
    $$(".tabs, .seg", scope).forEach((c, idx) => {
      const act = $("button.active", c); if (!act) return;
      let ind = $(".pill-ind", c);
      if (!ind) { ind = doc.createElement("i"); ind.className = "pill-ind"; ind.setAttribute("aria-hidden", "true"); c.prepend(ind); c.classList.add("has-ind"); }
      const left = act.offsetLeft, w = act.offsetWidth, k = key + "#" + idx;
      ind.style.cssText = `left:${left}px;width:${w}px`;
      // hàng tab dài (điện thoại) bị cuộn ngang: đưa tab đang chọn vào giữa tầm nhìn
      if (c.scrollWidth > c.clientWidth + 2) c.scrollTo({ left: Math.max(0, left - (c.clientWidth - w) / 2), behavior: CAN && animate ? "smooth" : "auto" });
      const p = PILLS[k];
      if (CAN && animate && p && (p.left !== left || p.w !== w))
        ind.animate([{ transform: `translateX(${p.left - left}px)`, width: p.w + "px" }, { transform: "none", width: w + "px" }], { duration: 480, easing: EASE.out });
      PILLS[k] = { left, w };
    });
  }

  /* ---------- 4. THẺ KHÓA HỌC → TRANG CHI TIẾT: ảnh bìa "bay" từ thẻ sang khung đăng ký ---------- */
  let ghost = null, ghostTimer = 0;
  function dropGhost(g, fade) {
    if (!g) return;
    if (fade && CAN) g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: "forwards" }).finished.then(() => g.remove(), () => g.remove());
    else g.remove();
  }
  function morphCancel() { clearTimeout(ghostTimer); const g = ghost; ghost = null; dropGhost(g, true); }
  function morphFrom(card) {
    morphCancel();
    if (!CAN || !card) return;
    const th = $(".thumb", card); if (!th) return;
    const r = th.getBoundingClientRect();
    if (r.width < 40 || r.bottom < 0 || r.top > innerHeight) return;
    const cs = getComputedStyle(th), gl = $(".glyph", th);
    const g = doc.createElement("div");
    g.className = "morph-ghost";
    g.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;background-image:${cs.backgroundImage};border-radius:${cs.borderTopLeftRadius} ${cs.borderTopRightRadius} 0 0`;
    if (gl) { const c = gl.cloneNode(true); c.classList.add("mg-glyph"); g.appendChild(c); }
    doc.body.appendChild(g);
    ghost = g;
    ghostTimer = setTimeout(morphCancel, 5000); // chi tiết không mở được (lỗi mạng…) → gỡ ảnh bay
  }
  function morphTo() {
    const g = ghost; if (!g) return;
    ghost = null; clearTimeout(ghostTimer);
    const dst = $(".enroll-card .ec-thumb");
    if (!dst || !CAN) { dropGhost(g, true); return; }
    const r = dst.getBoundingClientRect(), from = g.getBoundingClientRect();
    dst.style.visibility = "hidden";
    const done = () => { dst.style.visibility = ""; dropGhost(g, true); };
    const kf = [
      { left: from.left + "px", top: from.top + "px", width: from.width + "px", height: from.height + "px" },
      { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" },
    ];
    g.animate(kf, { duration: 640, easing: EASE.out, fill: "forwards" }).finished.then(done, done);
    const gl = $(".mg-glyph", g);
    if (gl) gl.animate([{ transform: "scale(1)" }, { transform: "scale(1.26)" }], { duration: 640, easing: EASE.out, fill: "forwards" });
  }

  /* ---------- 5. ĐỔI SÁNG/TỐI, TÔNG MÀU: loang tròn từ nút vừa bấm (View Transitions) ---------- */
  function reveal(fn, x, y) {
    if (!CAN || lite || !doc.startViewTransition) { fn(); return; }
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.classList.add("vt-run"); // tắt transition riêng lẻ trong lúc chuyển cảnh để màu không "chạy" hai lần
    const G = window.N9Galaxy;
    if (G && G.hold) G.hold("vt", true); // nền thiên hà đứng yên trong lúc loang (đỡ phải vẽ lại canvas toàn màn hình mỗi khung)
    const release = () => { root.classList.remove("vt-run"); if (G && G.hold) G.hold("vt", false); };
    let t;
    try { t = doc.startViewTransition(fn); } catch (e) { release(); fn(); return; }
    t.ready.then(() => root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 720, easing: "cubic-bezier(.4,0,.2,1)", pseudoElement: "::view-transition-new(root)" })).catch(() => {});
    t.finished.then(() => {}, () => {}).then(release);
  }
  const centerOf = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };

  /* ---------- 6. Ô TÌM Ở TRANG CHỦ: gợi ý tự gõ chữ ---------- */
  let typeTimer = 0;
  function typewriter(input, words) {
    clearTimeout(typeTimer);
    if (!input || !CAN || !words || !words.length) return;
    const base = input.getAttribute("placeholder") || "";
    let w = 0, n = 0, dir = 1;
    const tick = () => {
      if (!input.isConnected) return;
      if (doc.hidden || doc.activeElement === input || input.value) { input.setAttribute("placeholder", base); typeTimer = setTimeout(tick, 900); return; }
      const word = words[w];
      n += dir;
      input.setAttribute("placeholder", "Thử tìm: " + word.slice(0, n) + (n % 2 || dir > 0 ? "▍" : ""));
      let wait = dir > 0 ? 70 + Math.random() * 60 : 28;
      if (dir > 0 && n >= word.length) { dir = -1; wait = 1500; }
      else if (dir < 0 && n <= 0) { dir = 1; w = (w + 1) % words.length; wait = 380; }
      typeTimer = setTimeout(tick, wait);
    };
    typeTimer = setTimeout(tick, 1800);
  }

  /* ---------- 7. HOOK GỌI SAU MỖI LẦN VẼ TRANG ---------- */
  function afterRender(o) {
    const app = $("#app");
    if (o.mode === "page") { if (o.view === "detail") morphTo(); else morphCancel(); } // vẽ lại tại chỗ (không mode) không được làm hỏng ảnh đang bay
    pills(app, o.key, o.mode === "content");
    if (o.view !== "home") clearTimeout(typeTimer);
  }

  /* ---------- 8. HIỆU ỨNG THEO CON TRỎ: ánh sáng trên thẻ kính, nút hút nhẹ, quầng sáng đi theo chuột ---------- */
  const SPOT = ".panel,.kpi,.lc-card,.resume-card,.mini-resume,.qres-card,.unpaid,.mng-row,.quiz-item,.rcard,.tile,.ccard,.goal,.todo-quiz,.review-row,.empty-state,.rc-cta,.instr,.my-rank,.cert,.lesson-bar,.composer,.pay-sum";
  const MAGNET = ".cmp-go,.btn-lg";
  function initPointer() {
    if (REDUCED) return;
    // chỉ "bật" khi thật sự thấy con chuột di chuyển (máy cảm ứng thuần không bao giờ phát pointermove kiểu chuột; laptop vừa cảm ứng vừa chuột thì bật khi dùng chuột)
    const glow = doc.createElement("div");
    glow.id = "aurora"; glow.setAttribute("aria-hidden", "true");
    let px = -999, py = -999, gx = -999, gy = -999, target = null, queued = false, looping = false, mag = null, seen = false;
    const frame = () => {
      queued = false;
      const t = target;
      if (t && t.closest) {
        const el = t.closest(SPOT);
        if (el) { const r = el.getBoundingClientRect(); el.style.setProperty("--mx", (px - r.left).toFixed(1) + "px"); el.style.setProperty("--my", (py - r.top).toFixed(1) + "px"); }
        const m = t.closest(MAGNET);
        if (m !== mag) { if (mag) { mag.style.removeProperty("--tx"); mag.style.removeProperty("--ty"); } mag = m; }
        if (m) {
          const r = m.getBoundingClientRect();
          const dx = Math.max(-8, Math.min(8, (px - (r.left + r.width / 2)) * 0.16)), dy = Math.max(-6, Math.min(6, (py - (r.top + r.height / 2)) * 0.2));
          m.style.setProperty("--tx", dx.toFixed(1) + "px"); m.style.setProperty("--ty", dy.toFixed(1) + "px");
        }
      }
    };
    // quầng sáng bám theo chuột có quán tính (lerp) — chỉ chạy vòng lặp khi còn chưa tới nơi
    const follow = () => {
      gx += (px - gx) * 0.14; gy += (py - gy) * 0.14;
      glow.style.transform = `translate3d(${(gx - 260).toFixed(1)}px,${(gy - 260).toFixed(1)}px,0)`;
      if (Math.abs(px - gx) > 0.6 || Math.abs(py - gy) > 0.6) raf(follow); else looping = false;
    };
    doc.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      px = e.clientX; py = e.clientY; target = e.target;
      if (lite) return; // chế độ nhẹ: không làm gì theo con trỏ
      if (!seen) { seen = true; gx = px; gy = py; root.classList.add("fine-pointer"); doc.body.appendChild(glow); void glow.offsetWidth; glow.classList.add("on"); }
      if (!queued) { queued = true; raf(frame); }
      if (!looping) { looping = true; raf(follow); }
    }, { passive: true });
    doc.addEventListener("pointerleave", () => glow.classList.remove("on"));
    doc.addEventListener("pointerenter", () => seen && glow.classList.add("on"));
    doc.addEventListener("pointerout", (e) => {
      if (mag && !(e.relatedTarget && mag.contains(e.relatedTarget)) && mag.contains(e.target)) { mag.style.removeProperty("--tx"); mag.style.removeProperty("--ty"); mag = null; }
    });
  }

  /* thanh trên đậm hơn + có đường kẻ khi trang đã cuộn */
  function initScroll() {
    const bar = $(".topbar"); if (!bar) return;
    let q = false;
    const upd = () => { q = false; bar.classList.toggle("scrolled", window.scrollY > 6); };
    addEventListener("scroll", () => { if (!q) { q = true; raf(upd); } }, { passive: true });
    upd();
  }

  function init() { initPointer(); initScroll(); }

  return { REDUCED, CAN, EASE, isLite: () => lite, setLite, intro, leave, sideIndicator, pills, morphFrom, morphCancel, morphTo, reveal, centerOf, typewriter, afterRender, init };
})();
