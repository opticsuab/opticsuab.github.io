/* Pixel-grid background, dissolve dividers and soft-focus photo reveals */
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => c1.map((v, i) => Math.round(lerp(v, c2[i], t)));
const STOPS = [[6, 24, 51], [10, 52, 96], [8, 98, 120], [4, 130, 90], [2, 139, 60]];
function ramp(t) {
  t = (Math.max(0, Math.min(1, t)) || 0) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(t));
  return mix(STOPS[i], STOPS[i + 1], t - i);
}
const hash = (x, y) => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263); h = Math.imul(h ^ (h >> 13), 1274126177); return ((h ^ (h >> 16)) >>> 0) / 4294967295; };

function startBackground(canvas, opts = {}) {
  const ctx = canvas.getContext('2d');
  const size = opts.size || 34, gap = 3;
  let w, h, cols, rows, dpr, raf, t0 = performance.now(), visible = true;
  const mouse = { x: -999, y: -999 };
  function resize() {
    dpr = 1;
    const r = canvas.getBoundingClientRect();
    w = r.width; h = r.height;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(w / size) + 1; rows = Math.ceil(h / size) + 1;
    draw(performance.now());
  }
  function draw(now) {
    const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, w, h);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const n = hash(x, y);
      const gx = (x * size) / w, gy = (y * size) / h;
      const wave = Math.sin(x * 0.28 + t * 0.9) * Math.cos(y * 0.24 - t * 0.7);
      const base = gx * 0.55 + gy * 0.45;
      const px = x * size + size / 2, py = y * size + size / 2;
      const d = Math.hypot(px - mouse.x, py - mouse.y);
      const glow = Math.max(0, 1 - d / 190);
      const pulse = Math.pow(Math.max(0, Math.sin(t * 0.8 + n * 40)), 14);
      const tone = Math.min(1, base * 0.9 + wave * 0.12 + glow * 0.45 + pulse * 0.25);
      const [r, g, b] = ramp(tone);
      const a = Math.max(0.05, Math.min(0.95, 0.10 + n * 0.22 + wave * 0.08 + glow * 0.7 + pulse * 0.5 + base * 0.12));
      ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
      const s = size - gap - glow * 4 * (1 - n * 0.5);
      ctx.fillRect(x * size + (size - s) / 2, y * size + (size - s) / 2, s, s);
    }
  }
  let last = 0;
  function loop(now) { if (visible && !document.hidden && now - last > 40) { last = now; draw(now); } raf = requestAnimationFrame(loop); }
  const host = canvas.parentElement;
  host.addEventListener('pointermove', e => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
  host.addEventListener('pointerleave', () => { mouse.x = mouse.y = -999; });
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(canvas);
  new ResizeObserver(resize).observe(canvas);
  resize();
  if (!REDUCED) raf = requestAnimationFrame(loop);
}

/* Square dissolve between dark and light sections */
function dissolve(canvas) {
  const ctx = canvas.getContext('2d'), size = 24;
  const color = canvas.dataset.color || '#f4f7fb';
  function paint() {
    const dpr = Math.min(devicePixelRatio || 1, 2), r = canvas.getBoundingClientRect();
    canvas.width = r.width * dpr; canvas.height = r.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = color;
    const cols = Math.ceil(r.width / size), rows = Math.ceil(r.height / size);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const p = (y + 1) / rows;
      if (hash(x + 7, y + 3) < p * p * 1.15) ctx.fillRect(x * size, y * size, size - 1, size - 1);
    }
    ctx.fillRect(0, r.height - 2, r.width, 2);
  }
  new ResizeObserver(paint).observe(canvas); paint();
}

/* Photos settle into focus as they enter the viewport */
const photoObserver = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  photoObserver.unobserve(e.target);
  revealPhoto(e.target);
}), { threshold: 0.15 });
function revealPhoto(box) {
  const img = box.querySelector('img');
  if (!img) return;
  const settle = () => {
    box.classList.remove('reveal-pending');
    box.classList.add(img.naturalWidth ? 'is-ready' : 'image-error');
  };
  if (img.complete) { settle(); return; }
  img.addEventListener('load', settle, { once: true });
  img.addEventListener('error', settle, { once: true });
}
function initPhotoReveals(root) {
  root.querySelectorAll('.photo-frame').forEach(box => {
    if (!REDUCED) box.classList.add('reveal-pending');
    photoObserver.observe(box);
  });
}

/* Maintenance screen: pixel gears turning and a pixel wrench tightening the small gear */
function startGears(canvas) {
  const ctx = canvas.getContext('2d');
  let W, H, c, raf, t0 = performance.now();
  const N = 40; // cells across
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2), r = canvas.getBoundingClientRect();
    W = r.width; H = r.height; c = W / N;
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(performance.now());
  }
  const gear = (x, y, g, th) => {
    const dx = x - g.x, dy = y - g.y, r = Math.hypot(dx, dy);
    if (r < g.hole || r > g.R + g.h) return false;
    const a = Math.atan2(dy, dx) - th;
    if (r > g.R) return Math.cos(g.n * a) > 0.15;
    for (let k = 0; k < 4; k++) { const b = th + k * Math.PI / 2 + Math.PI / 4;
      if (Math.hypot(x - (g.x + Math.cos(b) * g.R * 0.58), y - (g.y + Math.sin(b) * g.R * 0.58)) < g.R * 0.17) return false; }
    return true;
  };
  const wrench = (x, y, g, phi) => { // open-end wrench gripping the nut
    const dx = x - g.x, dy = y - g.y, ca = Math.cos(-phi), sa = Math.sin(-phi);
    const lx = dx * ca - dy * sa, ly = dx * sa + dy * ca, r = Math.hypot(lx, ly);
    const ri = g.hole * 1.0, ro = g.hole * 1.65, L = g.hole * 5.4, hw = g.hole * 0.55;
    if (r >= ri && r <= ro && !(lx < 0 && Math.abs(ly) < ri * 0.95)) return true;
    if (lx > ro * 0.8 && lx < L && Math.abs(ly) < hw) return true;
    return Math.hypot(lx - L, ly) < hw * 1.35 && Math.hypot(lx - L, ly) > hw * 0.45;
  };
  function draw(now) {
    const t = REDUCED ? 0.8 : (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);
    const rows = Math.ceil(H / c);
    const A = { x: N * 0.38, y: rows * 0.6, R: N * 0.2, h: N * 0.05, hole: N * 0.06, n: 12 };
    const B = { x: 0, y: 0, R: N * 0.13, h: N * 0.05, hole: N * 0.05, n: 8 };
    const d = A.R + B.R + A.h * 0.9, ang = -0.62;
    B.x = A.x + Math.cos(ang) * d; B.y = A.y + Math.sin(ang) * d;
    const thA = t * 0.45, thB = -thA * A.n / B.n + Math.PI / B.n + ang * (1 + A.n / B.n);
    const phi = 0.75 + Math.sin(t * 1.6) * 0.28;
    for (let y = 0; y < rows; y++) for (let x = 0; x < N; x++) {
      const px = x + 0.5, py = y + 0.5, n = hash(x + 11, y + 5);
      let col = null, a = 1;
      if (wrench(px, py, B, phi)) { col = [255, 255, 255]; a = 0.88 + n * 0.12; }
      else if (gear(px, py, A, thA)) { col = ramp(0.7 + n * 0.3); a = 0.9 + n * 0.1; }
      else if (gear(px, py, B, thB)) { col = [110 + n * 40 | 0, 175 + n * 30 | 0, 235]; a = 0.95; }
      else { const tw = Math.pow(Math.max(0, Math.sin(t * 1.2 + n * 30)), 10); if (n > 0.86 || tw > 0.6) { col = ramp(n); a = 0.08 + tw * 0.25; } }
      if (!col) continue;
      ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${a})`;
      const s = c * 0.86; ctx.fillRect(x * c + (c - s) / 2, y * c + (c - s) / 2, s, s);
    }
  }
  let last = 0;
  function loop(now) { if (!document.hidden && now - last > 50) { last = now; draw(now); } raf = requestAnimationFrame(loop); }
  new ResizeObserver(resize).observe(canvas); resize();
  if (!REDUCED) raf = requestAnimationFrame(loop);
}
