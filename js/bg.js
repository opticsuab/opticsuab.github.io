/* Pixel-grid background, dissolve dividers and pixelated image reveals */
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

/* Image resolving from coarse pixels to sharp */
const pxObserver = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  pxObserver.unobserve(e.target);
  resolveImage(e.target);
}), { threshold: 0.15 });
function resolveImage(box) {
  const img = box.querySelector('img');
  if (!img) return;
  const go = () => {
    const W = box.clientWidth, H = box.clientHeight;
    if (!W || !H || REDUCED) { box.classList.add('done'); return; }
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H; cv.className = 'pxcv';
    box.appendChild(cv);
    const ctx = cv.getContext('2d');
    const ar = img.naturalWidth / img.naturalHeight, br = W / H;
    let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
    if (ar > br) { sw = sh * br; sx = (img.naturalWidth - sw) / 2; } else { sh = sw / br; sy = (img.naturalHeight - sh) / 2; }
    const tmp = document.createElement('canvas'), tctx = tmp.getContext('2d');
    const levels = [6, 12, 24, 48, 96];
    let i = 0;
    (function step() {
      const n = levels[i];
      tmp.width = n; tmp.height = Math.max(1, Math.round(n / br));
      tctx.drawImage(img, sx, sy, sw, sh, 0, 0, tmp.width, tmp.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tmp, 0, 0, W, H);
      if (++i < levels.length) setTimeout(step, 110);
      else { box.classList.add('done'); setTimeout(() => cv.remove(), 450); }
    })();
  };
  img.complete && img.naturalWidth ? go() : img.addEventListener('load', go, { once: true });
}
function initPixelImages(root) { root.querySelectorAll('.pxi').forEach(b => pxObserver.observe(b)); }
