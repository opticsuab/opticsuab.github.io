/* 3D map of Edifici C (Faculty of Sciences, UAB) for the "How to reach us" page.
   Source of js/building3d.js: after editing, run `bash tools/build-3d.sh` and commit both files.
   Footprints and streets come from OpenStreetMap (tools/src/campus-data.js, © OpenStreetMap contributors, ODbL);
   heights are approximate. The Optics Group is in C3 Parell, floor 0/−1; the way in is through C3B Parell and the
   bridge between the two wings. Two routes are drawn: from the main entrance and from Av. de Serragalliners.
   The camera orbits around the destination, which always stays in the centre; buttons switch the route and the 3D/top view.

   mountBuilding(container, { labels }) builds the scene inside `container` and returns a function that frees it. */
import {
  WebGLRenderer, Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, AmbientLight, Group, Mesh, Shape,
  ExtrudeGeometry, BoxGeometry, PlaneGeometry, CylinderGeometry, ConeGeometry, RingGeometry, CircleGeometry, SphereGeometry,
  TubeGeometry, CurvePath, LineCurve3, CatmullRomCurve3, MeshStandardMaterial, MeshBasicMaterial, ShaderMaterial, LineSegments,
  LineBasicMaterial, EdgesGeometry, BufferGeometry, Float32BufferAttribute, Vector3, Vector2, PCFShadowMap, SRGBColorSpace,
  Color, Fog, AdditiveBlending, DoubleSide, GridHelper, Line, MathUtils,
} from 'three';
import { BUILDINGS, ROADS, ROUTES, SPOTS } from './campus-data.js';

const CX = 35, CY = 45;                                   /* origin of the scene, in map metres */
const W = ([x, y], h = 0) => new Vector3(x - CX, h, -(y - CY));
const C = {
  ground: 0x071a35, grid: 0x2a5d94, fac: 0xdfeaf7, tower: 0xf2f8ff, link: 0xc9d9ec, c0: 0xd3e2f3, ctx: 0x1e4270, edge: 0x6fb6f2,
  us: 0x14a35a, usGlow: 0x5fd39a, access: 0xd3f0e1, avenue: 0x3f8fe0, avenueLine: 0xbfe3ff, street: 0x2c5f95, path: 0x3a6e9f,
  island: 0x173f2c, glass: 0xbfe0ff, main: 0x5fd39a, serra: 0x7cd0ff,
};

export function mountBuilding(container, opts = {}) {
  const L = Object.assign({
    us: 'Optics Group', usSub: 'C3 Parell · floor 0/−1', main: 'Main entrance', serra: 'From Av. de Serragalliners',
    bridge: 'Bridge to C3 Parell', cafe: 'Sciences cafeteria', north: 'N',
  }, opts.labels || {});
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = container.querySelector('canvas');
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFShadowMap;

  const scene = new Scene();
  scene.fog = new Fog(0x061833, 520, 1300);
  const camera = new PerspectiveCamera(30, 1, 1, 3000);
  scene.add(new HemisphereLight(0xdbeaff, 0x061833, 1.25));
  scene.add(new AmbientLight(0xffffff, 0.22));
  const sun = new DirectionalLight(0xffffff, 1.7);
  sun.position.set(-160, 260, 120); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -260, right: 260, top: 260, bottom: -260, near: 10, far: 900 });
  sun.shadow.bias = -0.0006;
  scene.add(sun);

  const disposables = [];
  const keep = x => (disposables.push(x), x);
  const std = o => keep(new MeshStandardMaterial(o));
  const mats = {
    fac: std({ color: C.fac, roughness: 0.75, metalness: 0.05 }),
    tower: std({ color: C.tower, roughness: 0.7, metalness: 0.05 }),
    link: std({ color: C.link, roughness: 0.8 }),
    c0: std({ color: C.c0, roughness: 0.75 }),
    plaza: std({ color: 0xb9cde4, roughness: 0.9 }),
    ctx: std({ color: C.ctx, roughness: 0.9, transparent: true, opacity: 0.75 }),
    access: std({ color: C.access, roughness: 0.7, emissive: new Color(C.main), emissiveIntensity: 0.06 }),
    us: std({ color: C.us, roughness: 0.4, metalness: 0.1, emissive: new Color(C.usGlow), emissiveIntensity: 0.35, transparent: true, opacity: 0.94 }),
    glass: std({ color: C.glass, roughness: 0.25, metalness: 0.2, emissive: new Color(0x3d7fc4), emissiveIntensity: 0.25 }),
    edge: keep(new LineBasicMaterial({ color: C.edge, transparent: true, opacity: 0.85 })),
    ctxEdge: keep(new LineBasicMaterial({ color: C.edge, transparent: true, opacity: 0.16 })),
    usEdge: keep(new LineBasicMaterial({ color: 0xb8ffd9 })),
  };
  const world = new Group(); scene.add(world);

  /* ---------- ground ---------- */
  const ground = new Mesh(keep(new PlaneGeometry(2400, 2400)), std({ color: C.ground, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; world.add(ground);
  const grid = new GridHelper(1200, 120, C.grid, C.grid);
  grid.material.transparent = true; grid.material.opacity = 0.16; grid.position.y = 0.04; world.add(grid); keep(grid.geometry); keep(grid.material);

  /* ---------- streets: smooth curves through the map points, drawn as flat ribbons ---------- */
  const smooth = (pts, closed = false) => {
    const curve = new CatmullRomCurve3(pts.map(p => W(p)), closed, 'centripetal');
    return curve.getSpacedPoints(Math.max(8, Math.round(curve.getLength() / 3)));
  };
  const ribbon = (P, width, y) => {
    const v = [], idx = [];
    P.forEach((p, i) => {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
      const d = new Vector3().subVectors(b, a).setY(0).normalize();
      v.push(p.x - d.z * width / 2, y, p.z + d.x * width / 2, p.x + d.z * width / 2, y, p.z - d.x * width / 2);
      if (i) { const k = 2 * i; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
    });
    const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(v, 3)); g.setIndex(idx); g.computeVertexNormals();
    return keep(g);
  };
  const flat = color => keep(new MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: DoubleSide }));
  const roadMat = { avenue: flat(C.avenue), street: flat(C.street), path: flat(C.path) };
  const lineMat = keep(new LineBasicMaterial({ color: C.avenueLine, transparent: true, opacity: 0.9 }));
  const WIDTH = { avenue: 11, street: 6, path: 2.2 }, LIFT = { avenue: 0.12, street: 0.1, path: 0.08 };
  const roadLabels = [];
  for (const r of ROADS) {
    const P = smooth(r.p);
    world.add(new Mesh(ribbon(P, WIDTH[r.k], LIFT[r.k]), roadMat[r.k]));
    if (r.k === 'avenue') world.add(new Line(keep(new BufferGeometry().setFromPoints(P.map(p => p.clone().setY(0.2)))), lineMat));
    if (r.n && r.l) roadLabels.push({ text: r.n, pos: W(r.l, 2), cls: r.k === 'avenue' ? 'bldg-road' : 'bldg-road bldg-road-s' });
  }
  /* roundabouts: a ring of avenue around a planted island */
  for (const o of SPOTS.rings) {
    const P = [];
    for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2; P.push(W([o.c[0] + o.r * Math.cos(a), o.c[1] + o.r * Math.sin(a)])); }
    world.add(new Mesh(ribbon(P, 9, LIFT.avenue), roadMat.avenue));
    world.add(new Line(keep(new BufferGeometry().setFromPoints(P.map(p => p.clone().setY(0.2)))), lineMat));
    const island = new Mesh(keep(new CircleGeometry(o.r - 4.6, 48)), keep(new MeshBasicMaterial({ color: C.island })));
    island.rotation.x = -Math.PI / 2; island.position.copy(W(o.c, 0.14)); world.add(island);
  }

  /* ---------- buildings: extruded footprints ---------- */
  const extrude = (pts, h, y0 = 0) => {
    const g = new ExtrudeGeometry(new Shape(pts.map(([x, y]) => new Vector2(x - CX, y - CY))), { depth: h, bevelEnabled: false });
    g.rotateX(-Math.PI / 2); g.translate(0, y0, 0);
    return keep(g);
  };
  const addSolid = (g, mat, edge, cast = true) => {
    const m = new Mesh(g, mat); m.castShadow = cast; m.receiveShadow = true;
    m.add(new LineSegments(keep(new EdgesGeometry(g, 25)), edge)); world.add(m); return m;
  };
  let usTop = 0, c0Top = 0;
  for (const b of BUILDINGS) {
    addSolid(extrude(b.p, b.h, b.y || 0), mats[b.c] || mats.fac,
      b.c === 'us' ? mats.usEdge : b.c === 'ctx' ? mats.ctxEdge : mats.edge, b.c !== 'ctx');
    if (b.c === 'us') usTop = b.h;
    if (b.c === 'c0') c0Top = b.h;
  }
  /* C0: the two large square skylights of the roof */
  for (const q of SPOTS.skylights) {
    addSolid(extrude(q, 1.4, c0Top), mats.glass, mats.edge, false);
    const c = q.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4], [0, 0]);
    const side = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]);
    const roof = new Mesh(keep(new ConeGeometry(side / Math.SQRT2 * 0.92, 3.6, 4, 1)), mats.glass);
    roof.position.copy(W(c, c0Top + 1.4 + 1.8));
    roof.rotation.y = Math.PI / 4 - Math.atan2(q[1][1] - q[0][1], q[1][0] - q[0][0]);
    roof.add(new LineSegments(keep(new EdgesGeometry(roof.geometry)), mats.edge)); world.add(roof);
  }
  /* the bridge between C3B Parell and C3 Parell */
  const [b0, b1] = SPOTS.bridge.map(p => W(p));
  const bridge = new Mesh(keep(new BoxGeometry(5, 4, b0.distanceTo(b1) + 2)), std({ color: 0xe9fff3, emissive: new Color(C.main), emissiveIntensity: 0.55, roughness: 0.4 }));
  bridge.position.copy(b0).add(b1).multiplyScalar(0.5).setY(2.2);
  bridge.lookAt(b1.x, 2.2, b1.z); bridge.castShadow = true;
  bridge.add(new LineSegments(keep(new EdgesGeometry(bridge.geometry)), mats.usEdge));
  world.add(bridge);

  /* ---------- light beams at the start of each route ---------- */
  const beam = (p, color) => {
    const g = new Group();
    const m = keep(new ShaderMaterial({
      uniforms: { color: { value: new Color(color) }, time: { value: 0 } },
      vertexShader: 'varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 color; uniform float time; varying float vY; void main(){ float a = (1.0 - vY) * (0.55 + 0.15 * sin(time * 2.0)); gl_FragColor = vec4(color, a * 0.6); }',
      transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
    }));
    const cyl = new Mesh(keep(new CylinderGeometry(2, 3.2, 30, 32, 1, true)), m); cyl.position.y = 15; g.add(cyl);
    const ring = new Mesh(keep(new RingGeometry(4, 6, 48)), keep(new MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: DoubleSide, depthWrite: false })));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.3; g.add(ring);
    g.position.copy(p); world.add(g);
    return { g, m, ring };
  };
  const beams = { main: beam(W(SPOTS.main, 5), C.main), serra: beam(W(SPOTS.serra), C.serra) };   /* the main entrance is the square over Eix Central */

  /* ---------- routes: glowing tubes with moving chevrons, drawn over the buildings ---------- */
  const routes = {};
  for (const [k, pts] of Object.entries(ROUTES)) {
    const path = new CurvePath();
    const P = pts.map(p => W(p, 1.6));
    for (let i = 1; i < P.length; i++) path.add(new LineCurve3(P[i - 1], P[i]));
    const len = path.getLength();
    const m = keep(new ShaderMaterial({
      uniforms: { color: { value: new Color(C[k]) }, time: { value: 0 }, len: { value: len } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 color; uniform float time; uniform float len; varying vec2 vUv;
        void main(){ float s = fract(vUv.x * len / 9.0 - time * 0.9); float dash = smoothstep(0.0, 0.25, s) * (1.0 - smoothstep(0.55, 0.8, s));
          gl_FragColor = vec4(mix(color, vec3(1.0), dash * 0.65), 0.62 + 0.38 * dash); }`,
      transparent: true, depthTest: false, depthWrite: false,
    }));
    const tube = new Mesh(keep(new TubeGeometry(path, Math.max(64, Math.round(len / 2)), 1.6, 8, false)), m);
    tube.renderOrder = 10; world.add(tube);
    const dot = new Mesh(keep(new SphereGeometry(2.4, 20, 14)), keep(new MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true })));
    dot.renderOrder = 11; world.add(dot);
    routes[k] = { tube, m, dot, path, len };
  }

  /* ---------- HTML labels ---------- */
  const layer = container.querySelector('.bldg-labels');
  const label = (cls, text, pos, extra = {}) => {
    const el = document.createElement('span'); el.className = cls; el.textContent = text; layer.appendChild(el);
    return Object.assign({ el, pos }, extra);
  };
  const labels = [
    ...roadLabels.map(r => label(r.cls, r.text, r.pos)),
    ...Object.entries(SPOTS.modules).map(([n, m]) => label('bldg-mod', n, W(m.gap, m.top))),
    label('bldg-pin bldg-pin-cafe', L.cafe, W(SPOTS.cafe, c0Top + 12)),
    label('bldg-pin bldg-pin-main', L.main, W(SPOTS.main, 31), { route: 'main' }),
    label('bldg-pin bldg-pin-serra', L.serra, W(SPOTS.serra, 31), { route: 'serra' }),
    label('bldg-pin bldg-pin-bridge', L.bridge, bridge.position.clone().setY(0), { below: true }),
  ];
  /* a thin stem under the cafeteria pin */
  const cafeBase = W(SPOTS.cafe, c0Top + 3.4);
  world.add(new Line(keep(new BufferGeometry().setFromPoints([cafeBase, cafeBase.clone().setY(c0Top + 12)])), keep(new LineBasicMaterial({ color: 0xffd28a }))));
  const usLabel = document.createElement('div'); usLabel.className = 'bldg-us';
  usLabel.innerHTML = '<div class="bldg-card"><b></b><span></span></div>';
  usLabel.querySelector('b').textContent = L.us; usLabel.querySelector('span').textContent = L.usSub;
  layer.appendChild(usLabel);
  const usPos = W(SPOTS.us);
  const usAnchor = usPos.clone().setY(usTop + 1);
  const compass = document.createElement('span'); compass.className = 'bldg-compass'; compass.innerHTML = '<i></i><b></b>';
  compass.querySelector('b').textContent = L.north; layer.appendChild(compass);

  /* ---------- camera: orbits around the destination, which stays in the centre ---------- */
  const VIEWS = { '3d': { az: 2.05, el: 0.62, zoom: 1 }, top: { az: Math.PI / 2, el: 1.53, zoom: 1.12 } };
  const BASE = 430;
  let active = 'main', raf = 0, visible = true, dirty = true, dragging = false, last = null, pinch = null;
  const target = usPos.clone();
  const cur = { ...VIEWS['3d'] }, goal = { ...VIEWS['3d'] };
  const placeCamera = () => {
    const dist = BASE * cur.zoom * Math.max(1, 1.15 / (camera.aspect || 1));   /* portrait screens: step back to keep both avenues */
    camera.position.set(target.x + dist * Math.cos(cur.el) * Math.cos(cur.az), target.y + dist * Math.sin(cur.el), target.z + dist * Math.cos(cur.el) * Math.sin(cur.az));
    camera.lookAt(target); camera.updateMatrixWorld();
  };
  const setView = name => { Object.assign(goal, VIEWS[name]); container.querySelector('[data-b="view"]')?.setAttribute('aria-pressed', String(name === 'top')); kick(); };
  const showRoute = k => {
    active = k;
    for (const [r, o] of Object.entries(routes)) { o.tube.visible = o.dot.visible = r === k; beams[r].g.visible = r === k; }
    container.querySelectorAll('[data-b^="route-"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.b === `route-${k}`)));
    dirty = true; kick();
  };
  const size = () => {
    const w = container.clientWidth, h = Math.max(320, Math.round(w * (w < 640 ? 1.1 : 0.6)));
    canvas.style.height = h + 'px';
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); placeCamera();
    dirty = true; kick();
  };
  const tmp = new Vector3();
  const project = (v, out) => { tmp.copy(v).project(camera); out.x = (tmp.x + 1) / 2 * canvas.clientWidth; out.y = (1 - tmp.y) / 2 * canvas.clientHeight; return tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1; };
  const s2 = new Vector2(), s3 = new Vector2();
  const frame = t => {
    raf = 0;
    const time = reduced ? 0 : (t || 0) / 1000;
    const k = reduced ? 1 : 0.14;
    let moving = false;
    for (const key of ['az', 'el', 'zoom']) { const d = goal[key] - cur[key]; if (Math.abs(d) > 1e-4) { cur[key] += d * k; moving = true; } else cur[key] = goal[key]; }
    if (moving) { placeCamera(); dirty = true; }
    for (const o of Object.values(routes)) {
      o.m.uniforms.time.value = time;
      o.dot.position.copy(o.path.getPointAt(reduced ? 1 : (time / Math.max(6, o.len / 45)) % 1));
    }
    for (const b of Object.values(beams)) { b.m.uniforms.time.value = time; const f = (time * 0.8) % 1; b.ring.scale.setScalar(1 + 0.35 * f); b.ring.material.opacity = reduced ? 0.6 : 0.8 * (1 - f); }
    mats.us.emissiveIntensity = reduced ? 0.4 : 0.3 + 0.2 * (0.5 + 0.5 * Math.sin(time * 2.2));
    renderer.render(scene, camera);
    if (dirty) {                                                /* labels only move when the view changes */
      const Wd = canvas.clientWidth, Hd = canvas.clientHeight;
      for (const l of labels) {
        const ok = (!l.route || l.route === active) && project(l.pos, s2);
        l.el.style.opacity = ok ? 1 : 0;
        if (ok) { const hw = l.el.offsetWidth / 2 + 6, hh = l.el.offsetHeight + 6; l.el.style.transform = `translate(${MathUtils.clamp(s2.x, hw, Wd - hw)}px,${l.below ? Math.min(s2.y, Hd - 2 * hh) : Math.max(s2.y, hh)}px) translate(-50%,${l.below ? '60%' : '-100%'})`; }
      }
      project(usAnchor, s2);
      const card = usLabel.firstElementChild, cw = card.offsetWidth;
      card.style.left = `${Math.max(8 - s2.x, Math.min(-1, Wd - 8 - s2.x - cw))}px`;
      usLabel.style.transform = `translate(${MathUtils.clamp(s2.x, 8, Wd - 8)}px,${MathUtils.clamp(s2.y, card.offsetHeight + 56, Hd - 8)}px)`;
      project(target, s2); project(target.clone().add(new Vector3(0, 0, -60)), s3);
      compass.firstElementChild.style.transform = `rotate(${Math.atan2(s3.x - s2.x, -(s3.y - s2.y))}rad)`;
      dirty = false;
    }
    if (visible && (!reduced || moving || dragging)) raf = requestAnimationFrame(frame);
  };
  function kick() { if (!raf && visible) raf = requestAnimationFrame(frame); }

  /* ---------- input: drag to rotate, Ctrl/⌘ + wheel or pinch to zoom, arrow keys ---------- */
  const clampEl = v => MathUtils.clamp(v, 0.18, 1.53), clampZoom = v => MathUtils.clamp(v, 0.35, 1.8);
  const onDown = e => { if (e.pointerType === 'touch' && pinch) return; dragging = true; last = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); container.classList.add('grabbing'); kick(); };
  const onMove = e => {
    if (!dragging || !last) return;
    goal.az += (e.clientX - last.x) * 0.008; goal.el = clampEl(goal.el + (e.clientY - last.y) * 0.006); last = { x: e.clientX, y: e.clientY }; kick();
  };
  const onUp = e => { dragging = false; last = null; container.classList.remove('grabbing'); try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* already released */ } };
  const onWheel = e => {
    if (!(e.ctrlKey || e.metaKey)) { container.classList.add('hinting'); clearTimeout(onWheel.t); onWheel.t = setTimeout(() => container.classList.remove('hinting'), 1400); return; }
    e.preventDefault(); goal.zoom = clampZoom(goal.zoom * (1 + Math.sign(e.deltaY) * 0.1)); kick();
  };
  const dist2 = e => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  const onTouchStart = e => { if (e.touches.length === 2) { pinch = dist2(e); dragging = false; } };
  const onTouchMove = e => { if (e.touches.length !== 2 || !pinch) return; e.preventDefault(); const d = dist2(e); goal.zoom = clampZoom(goal.zoom * pinch / d); pinch = d; kick(); };
  const onTouchEnd = e => { if (e.touches.length < 2) pinch = null; };
  const onKey = e => {
    const step = { ArrowLeft: [-0.2, 0], ArrowRight: [0.2, 0], ArrowUp: [0, -0.12], ArrowDown: [0, 0.12] }[e.key];
    if (step) { e.preventDefault(); goal.az += step[0]; goal.el = clampEl(goal.el + step[1]); kick(); }
    else if (e.key === '+' || e.key === '=') { goal.zoom = clampZoom(goal.zoom * 0.88); kick(); }
    else if (e.key === '-' || e.key === '_') { goal.zoom = clampZoom(goal.zoom * 1.12); kick(); }
    else if (e.key === '0' || e.key === 'Home') setView('3d');
  };
  const onButton = e => {
    const b = e.target.closest('[data-b]'); if (!b) return;
    const a = b.dataset.b;
    if (a.startsWith('route-') && routes[a.slice(6)]) showRoute(a.slice(6));
    else if (a === 'view') setView(b.getAttribute('aria-pressed') === 'true' ? '3d' : 'top');
  };
  const listeners = [['pointerdown', onDown], ['pointermove', onMove], ['pointerup', onUp], ['pointercancel', onUp], ['wheel', onWheel, { passive: false }],
    ['touchstart', onTouchStart, { passive: true }], ['touchmove', onTouchMove, { passive: false }], ['touchend', onTouchEnd], ['keydown', onKey]];
  listeners.forEach(([n, f, o]) => canvas.addEventListener(n, f, o));
  container.addEventListener('click', onButton);
  const ro = new ResizeObserver(size); ro.observe(container);
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) kick(); });
  io.observe(container);
  showRoute('main');
  size();

  return function dispose() {
    cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
    container.removeEventListener('click', onButton);
    listeners.forEach(([n, f]) => canvas.removeEventListener(n, f));
    disposables.forEach(d => d.dispose && d.dispose());
    renderer.dispose();
    layer.replaceChildren();
  };
}
