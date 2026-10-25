/* Nền thiên hà cho chế độ tối: bầu trời đen sâu, sao nhấp nháy, cả bầu trời + tinh vân + dải ngân hà
 * xoay chậm quanh một tâm đang trôi vòng, 3 lớp sao ở độ sâu khác nhau, thỉnh thoảng có sao băng.
 * - Chỉ chạy khi giao diện đang ở chế độ tối VÀ người dùng không tắt (menu 🎨 → "Nền thiên hà").
 * - Tự dừng khi tab bị ẩn.
 * - Nếu hệ điều hành bật "giảm chuyển động" thì mặc định chỉ vẽ 1 khung tĩnh; người dùng có thể
 *   bật công tắc "Cho phép chuyển động" trong menu 🎨 để nền vẫn chuyển động nhẹ.
 * - Canvas nằm sau toàn bộ nội dung (z-index:-1), không nhận chuột. */
(function () {
  "use strict";
  const html = document.documentElement;
  const OS_REDUCED = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const DARK_MQ = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
  const KEY = "n9-galaxy", KEY_MOTION = "n9-galaxy-motion";

  let pref = true, forceMotion = false;
  try { pref = localStorage.getItem(KEY) !== "0"; forceMotion = localStorage.getItem(KEY_MOTION) === "1"; } catch (e) {}
  const still = () => OS_REDUCED && !forceMotion; // true → chỉ vẽ khung tĩnh

  const cv = document.createElement("canvas");
  cv.id = "galaxy"; cv.setAttribute("aria-hidden", "true");
  document.body.insertBefore(cv, document.body.firstChild);
  const ctx = cv.getContext("2d");

  let W = 0, H = 0, DPR = 1, R = 0, D = 0;
  let stars = [], neb = null, vignette = null, glow = null;
  let raf = 0, running = false, last = 0;
  const t0 = performance.now();
  let mx = 0, my = 0, px = 0, py = 0;            // thị sai theo chuột (mục tiêu / hiện tại)
  let shoot = null, nextShoot = performance.now() + 3500;

  const COLORS = ["255,255,255", "190,212,255", "255,232,198", "210,190,255"];
  const LAYER = [{ rot: 0.6, par: 0.3 }, { rot: 1, par: 0.8 }, { rot: 1.5, par: 1.6 }];
  // ROT: rad/giây. 0.016 ≈ 1 vòng / 6,5 phút → sao ở rìa màn hình trôi ~8–12px/s (cộng tâm trôi vòng ~7px/s): thấy rõ mà vẫn nhẹ nhàng.
  const ROT = 0.016;
  // NEB: độ đậm tinh vân (1 = gốc). Giảm để các tấm kính tím phía trên nổi bật hơn.
  const NEB = 0.5;

  const isDark = () => {
    const t = html.getAttribute("data-theme");
    return t === "dark" || (t !== "light" && !!DARK_MQ && DARK_MQ.matches);
  };
  const rand = (a, b) => a + Math.random() * (b - a);
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

  function toRGB(s, fb) {
    s = String(s || "").trim();
    let m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (m) { let h = m[1]; if (h.length === 3) h = h.split("").map((c) => c + c).join(""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
    m = s.match(/rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/i);
    return m ? [+m[1], +m[2], +m[3]] : fb;
  }
  const cssVar = (n, fb) => toRGB(getComputedStyle(html).getPropertyValue(n), fb);

  // sprite quầng sáng cho sao lớn
  function makeGlow() {
    const g = document.createElement("canvas"); g.width = g.height = 64;
    const c = g.getContext("2d"), grd = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,255,255,.9)"); grd.addColorStop(0.25, "rgba(255,255,255,.28)"); grd.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = grd; c.fillRect(0, 0, 64, 64);
    return g;
  }

  // Tinh vân + dải ngân hà vẽ 1 lần ra canvas vuông (1/3 độ phân giải) lớn hơn màn hình, rồi XOAY + trôi bằng drawImage — rất rẻ.
  function buildNebula() {
    const S = 3, side = Math.ceil(D / S);
    const c = document.createElement("canvas"); c.width = c.height = side;
    const g = c.getContext("2d");
    const pri = cssVar("--primary", [67, 182, 148]), acc = cssVar("--accent", [237, 154, 90]);
    // toạ độ blob theo tỉ lệ màn hình (fx,fy ∈ 0..1) quy về hình vuông tâm D/2
    const at = (fx, fy) => [(D / 2 + (fx - 0.5) * W) / S, (D / 2 + (fy - 0.5) * H) / S];
    const blobs = [
      [0.16, 0.22, 0.34, [110, 70, 225], 0.42], [0.84, 0.28, 0.30, pri, 0.26],
      [0.52, 0.88, 0.36, [34, 84, 200], 0.36], [0.10, 0.90, 0.26, acc, 0.16],
      [0.70, 0.62, 0.26, [165, 80, 205], 0.22], [0.40, 0.40, 0.30, [70, 60, 190], 0.20],
    ];
    g.globalCompositeOperation = "lighter";
    blobs.forEach(([fx, fy, fr, col, a]) => {
      const [x, y] = at(fx, fy), r = fr * Math.max(W, H) / S * 1.5;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${a * NEB})`);
      gr.addColorStop(0.55, `rgba(${col[0]},${col[1]},${col[2]},${a * 0.35 * NEB})`);
      gr.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
      g.fillStyle = gr; g.fillRect(0, 0, side, side);
    });
    // dải ngân hà chéo (cùng góc với chỗ sao tụ dày)
    g.save(); g.translate(side / 2, side / 2); g.rotate(-0.5);
    const bw = side * 1.3, bh = side * 0.17;
    const band = g.createLinearGradient(0, -bh, 0, bh);
    band.addColorStop(0, "rgba(170,185,255,0)"); band.addColorStop(0.5, `rgba(195,205,255,${0.26 * NEB})`); band.addColorStop(1, "rgba(170,185,255,0)");
    g.fillStyle = band; g.fillRect(-bw / 2, -bh, bw, bh * 2);
    g.restore();
    neb = c;
  }

  function build() {
    R = Math.hypot(W, H) / 2 * 1.22;     // dư để khi tâm trôi vòng + xoay vẫn không lộ mép
    D = Math.hypot(W, H) * 1.25;
    const count = Math.max(190, Math.min(560, Math.round((Math.PI * R * R) / 5200)));
    const ang = -0.5, ca = Math.cos(ang), sa = Math.sin(ang);
    stars = [];
    for (let i = 0; i < count; i++) {
      const layer = Math.random() < 0.55 ? 0 : Math.random() < 0.67 ? 1 : 2;
      let dx, dy;
      if (Math.random() < 0.4) { // tụ quanh dải ngân hà
        const along = rand(-R, R), off = gauss() * R * 0.14;
        dx = along * ca - off * sa; dy = along * sa + off * ca;
      } else { const rr = R * Math.sqrt(Math.random()), a = rand(0, Math.PI * 2); dx = rr * Math.cos(a); dy = rr * Math.sin(a); }
      stars.push({
        dx, dy, layer, c: Math.random() < 0.6 ? 0 : 1 + ((Math.random() * 3) | 0),
        r: layer === 0 ? rand(0.45, 0.8) : layer === 1 ? rand(0.7, 1.15) : rand(1.1, 1.9),
        a: rand(0.5, 1), sp: rand(0.6, 3), ph: rand(0, 6.28),
      });
    }
    buildNebula();
    vignette = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.62);
    vignette.addColorStop(0, "rgba(0,0,0,0)"); vignette.addColorStop(1, "rgba(0,0,0,.55)");
    if (!glow) glow = makeGlow();
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    cv.style.width = W + "px"; cv.style.height = H + "px";
    build();
  }

  function frame(now, force, keepT) {
    if (!force) {
      raf = requestAnimationFrame(frame);
      if (now - last < 32) return; // ~30fps là đủ cho chuyển động chậm, đỡ tốn pin
    }
    last = now;
    const t = force && !keepT ? 0 : (now - t0) / 1000;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // tâm xoay trôi theo vòng tròn chậm → toàn bộ bầu trời "lướt" chứ không chỉ quay tại chỗ
    const cx = W / 2 + Math.sin(t * 0.09) * 80, cy = H / 2 + Math.cos(t * 0.065) * 55;

    // tinh vân + dải ngân hà: xoay theo bầu trời, nhấp nhô to nhỏ
    if (neb) {
      const sc = 1 + Math.sin(t * 0.04) * 0.05;
      ctx.globalAlpha = 1;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * ROT * 0.8); ctx.scale(sc, sc);
      ctx.drawImage(neb, -D / 2, -D / 2, D, D);
      ctx.restore();
    }

    // thị sai theo chuột (mượt dần)
    px += (mx - px) * 0.05; py += (my - py) * 0.05;
    const sets = LAYER.map((l) => { const a = t * ROT * l.rot; return [Math.cos(a), Math.sin(a), l.par]; });
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i], k = sets[s.layer];
      const x = cx + s.dx * k[0] - s.dy * k[1] + px * k[2];
      const y = cy + s.dx * k[1] + s.dy * k[0] + py * k[2];
      if (x < -6 || x > W + 6 || y < -6 || y > H + 6) continue;
      const a = s.a * (0.55 + 0.45 * Math.sin(t * s.sp + s.ph));
      ctx.fillStyle = `rgb(${COLORS[s.c]})`;
      ctx.globalAlpha = a;
      if (s.r < 1.1) ctx.fillRect(x - s.r, y - s.r, s.r * 2, s.r * 2);
      else {
        ctx.beginPath(); ctx.arc(x, y, s.r, 0, 6.2832); ctx.fill();
        if (s.layer === 2) { ctx.globalAlpha = a * 0.55; ctx.drawImage(glow, x - s.r * 5, y - s.r * 5, s.r * 10, s.r * 10); }
      }
    }
    ctx.globalAlpha = 1;

    // sao băng
    if (!still()) {
      if (!shoot && now > nextShoot) {
        const a = rand(2.55, 2.85); // hướng xuống-trái
        shoot = { x: rand(W * 0.35, W * 1.0), y: rand(-20, H * 0.35), vx: Math.cos(a) * 920, vy: Math.sin(a) * 920, born: now, life: 900 };
        nextShoot = now + rand(6500, 14000);
      }
      if (shoot) {
        const age = now - shoot.born, p = age / shoot.life;
        if (p >= 1) shoot = null;
        else {
          const hx = shoot.x + shoot.vx * (age / 1000), hy = shoot.y + shoot.vy * (age / 1000), len = 150;
          const n = Math.hypot(shoot.vx, shoot.vy), tx = hx - (shoot.vx / n) * len, ty = hy - (shoot.vy / n) * len;
          const gr = ctx.createLinearGradient(hx, hy, tx, ty);
          const al = Math.sin(p * Math.PI);
          gr.addColorStop(0, `rgba(255,255,255,${0.9 * al})`); gr.addColorStop(1, "rgba(255,255,255,0)");
          ctx.strokeStyle = gr; ctx.lineWidth = 1.6; ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
        }
      }
    }

    // vignette: làm sâu viền màn hình thành đen
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
  }

  // "tạm dừng" theo từng lý do (hộp thoại đang mở, đang chuyển cảnh sáng/tối…): nền nằm sau lớp làm mờ nên không ai thấy nó chuyển động,
  // dừng vẽ lại ở những lúc đó giúp hộp thoại / chuyển cảnh mượt hơn rõ rệt. Khung hình cuối vẫn giữ nguyên trên canvas.
  const holds = new Set();
  function start() {
    if (running || holds.size) return;
    running = true;
    if (!W) resize();
    if (still()) { frame(performance.now(), true); return; }
    last = 0; raf = requestAnimationFrame(frame);
  }
  function stop() { running = false; cancelAnimationFrame(raf); }

  function sync() {
    const on = pref && isDark();
    html.classList.toggle("galaxy-on", on);
    stop();
    if (on && !document.hidden) start();
  }

  window.N9Galaxy = {
    enabled: () => pref,
    set(v) { pref = !!v; try { localStorage.setItem(KEY, pref ? "1" : "0"); } catch (e) {} sync(); },
    osReduced: () => OS_REDUCED,           // hệ điều hành đang bật "giảm chuyển động"
    motionForced: () => forceMotion,
    setMotion(v) { forceMotion = !!v; try { localStorage.setItem(KEY_MOTION, forceMotion ? "1" : "0"); } catch (e) {} sync(); },
    hold(key, on) { on ? holds.add(key) : holds.delete(key); if (holds.size) stop(); else sync(); },
  };

  let rt = 0;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { if (W) { resize(); if (still()) frame(performance.now(), true); } }, 160); });
  document.addEventListener("visibilitychange", sync);
  if (DARK_MQ && DARK_MQ.addEventListener) DARK_MQ.addEventListener("change", sync);
  window.addEventListener("pointermove", (e) => { if (!W || still()) return; mx = (e.clientX / W - 0.5) * -22; my = (e.clientY / H - 0.5) * -22; }, { passive: true });
  // đổi chế độ sáng/tối hoặc tông màu → bật/tắt nền và vẽ lại màu tinh vân
  new MutationObserver(() => { sync(); if (W && html.classList.contains("galaxy-on")) { buildNebula(); if (still()) frame(performance.now(), true); else if (holds.size) frame(performance.now(), true, true); } })
    .observe(html, { attributes: true, attributeFilter: ["data-theme", "data-accent"] });

  sync();
})();
