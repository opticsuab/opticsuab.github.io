/* Interactive 3D map of Edifici C (Faculty of Sciences, UAB) for the "How to reach us" page.
   Source of js/building3d.js: after editing, run `bash tools/build-3d.sh` and commit both files.
   Footprints and streets come from OpenStreetMap (tools/src/campus-data.js, © OpenStreetMap contributors, ODbL);
   heights are approximate. The Optics Group is in C3 Parell, floor 0/−1; the way in is through C3B Parell and the
   bridge between the two wings. Two routes are drawn: from the main entrance (the square by Av. de l'Eix Central)
   and from Av. de Serragalliners (crossing C. de l'Albareda).

   mountBuilding(container, { labels }) builds the scene inside `container` and returns a function that frees it. */
import {
  WebGLRenderer, Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, AmbientLight, Group, Mesh, Shape,
  ExtrudeGeometry, BoxGeometry, PlaneGeometry, CylinderGeometry, RingGeometry, SphereGeometry, TubeGeometry, CurvePath,
  LineCurve3, MeshStandardMaterial, MeshBasicMaterial, ShaderMaterial, LineSegments, LineBasicMaterial, EdgesGeometry,
  BufferGeometry, Float32BufferAttribute, Vector3, Vector2, Raycaster, PCFShadowMap, SRGBColorSpace, Color, MathUtils,
  Fog, AdditiveBlending, DoubleSide, GridHelper, Line,
} from 'three';
import { BUILDINGS, ROADS, SPINE, ROUTES, SPOTS } from './campus-data.js';

const CX = 35, CY = 45;                                   /* centre of the scene, in map metres */
const W = ([x, y], h = 0) => new Vector3(x - CX, h, -(y - CY));
const C = {
  ground: 0x071a35, grid: 0x2a5d94, fac: 0xdfeaf7, tower: 0xf2f8ff, c0: 0xd3e2f3, ctx: 0x1e4270, edge: 0x6fb6f2,
  us: 0x14a35a, usGlow: 0x5fd39a, access: 0xd3f0e1, avenue: 0x3f8fe0, avenueLine: 0xbfe3ff, street: 0x2c5f95, path: 0x3a6e9f,
  main: 0x5fd39a, serra: 0x7cd0ff,
};

export function mountBuilding(container, opts = {}) {
  const L = Object.assign({
    us: 'Optics Group', usSub: 'C3 Parell · floor 0/−1', main: 'Main entrance', serra: 'From Av. de Serragalliners',
    cross: "Cross C. de l'Albareda", bridge: 'Bridge to C3 Parell', access: 'C3B Parell · way in', north: 'N',
  }, opts.labels || {});
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = container.querySelector('canvas');
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFShadowMap;

  const scene = new Scene();
  scene.fog = new Fog(0x061833, 420, 1100);
  const camera = new PerspectiveCamera(30, 1, 1, 3000);
  scene.add(new HemisphereLight(0xdbeaff, 0x061833, 1.25));
  scene.add(new AmbientLight(0xffffff, 0.22));
  const sun = new DirectionalLight(0xffffff, 1.7);
  sun.position.set(-160, 260, 120); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -230, right: 230, top: 230, bottom: -230, near: 10, far: 800 });
  sun.shadow.bias = -0.0006;
  scene.add(sun);

  const disposables = [];
  const keep = x => (disposables.push(x), x);
  const mats = {
    fac: keep(new MeshStandardMaterial({ color: C.fac, roughness: 0.75, metalness: 0.05 })),
    tower: keep(new MeshStandardMaterial({ color: C.tower, roughness: 0.7, metalness: 0.05 })),
    c0: keep(new MeshStandardMaterial({ color: C.c0, roughness: 0.75 })),
    ctx: keep(new MeshStandardMaterial({ color: C.ctx, roughness: 0.9, transparent: true, opacity: 0.75 })),
    access: keep(new MeshStandardMaterial({ color: C.access, roughness: 0.7, emissive: new Color(C.main), emissiveIntensity: 0.06 })),
    us: keep(new MeshStandardMaterial({ color: C.us, roughness: 0.4, metalness: 0.1, emissive: new Color(C.usGlow), emissiveIntensity: 0.35, transparent: true, opacity: 0.92 })),
    edge: keep(new LineBasicMaterial({ color: C.edge, transparent: true, opacity: 0.85 })),
    ctxEdge: keep(new LineBasicMaterial({ color: C.edge, transparent: true, opacity: 0.16 })),
    usEdge: keep(new LineBasicMaterial({ color: 0xb8ffd9 })),
  };

  const world = new Group(); scene.add(world);
  const pickables = [];

  /* ---------- ground: dark plane with a fine grid ---------- */
  const ground = new Mesh(keep(new PlaneGeometry(2400, 2400)), keep(new MeshStandardMaterial({ color: C.ground, roughness: 1 })));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; world.add(ground);
  const grid = new GridHelper(1200, 120, C.grid, C.grid);
  grid.material.transparent = true; grid.material.opacity = 0.16; grid.position.y = 0.04; world.add(grid); keep(grid.geometry); keep(grid.material);

  /* ---------- streets: flat ribbons ---------- */
  const ribbon = (pts, width, y) => {
    const v = [], idx = [];
    const P = pts.map(p => W(p));
    P.forEach((p, i) => {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
      const d = new Vector3().subVectors(b, a).setY(0).normalize();
      const n = new Vector3(-d.z, 0, d.x).multiplyScalar(width / 2);
      v.push(p.x + n.x, y, p.z + n.z, p.x - n.x, y, p.z - n.z);
      if (i) { const k = 2 * i; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
    });
    const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(v, 3)); g.setIndex(idx); g.computeVertexNormals();
    return keep(g);
  };
  const roadMat = {
    avenue: keep(new MeshBasicMaterial({ color: C.avenue, transparent: true, opacity: 0.85, side: DoubleSide })),
    street: keep(new MeshBasicMaterial({ color: C.street, transparent: true, opacity: 0.9, side: DoubleSide })),
    path: keep(new MeshBasicMaterial({ color: C.path, transparent: true, opacity: 0.75, side: DoubleSide })),
    line: keep(new LineBasicMaterial({ color: C.avenueLine, transparent: true, opacity: 0.9 })),
  };
  const roadLabels = [];
  for (const r of ROADS) {
    const width = { avenue: 11, street: 6, path: 2.2 }[r.k];
    world.add(new Mesh(ribbon(r.p, width, { avenue: 0.12, street: 0.1, path: 0.08 }[r.k]), roadMat[r.k]));
    if (r.k === 'avenue') {
      world.add(new Line(keep(new BufferGeometry().setFromPoints(r.p.map(p => W(p, 0.2)))), roadMat.line));
    }
    if (r.n && r.l) roadLabels.push({ text: r.n, pos: W(r.l, 2), cls: r.k === 'avenue' ? 'bldg-road' : 'bldg-road bldg-road-s' });
  }

  /* ---------- buildings: extruded footprints ---------- */
  const extrude = (pts, h, y0 = 0) => {
    const s = new Shape(pts.map(([x, y]) => new Vector2(x - CX, y - CY)));
    const g = new ExtrudeGeometry(s, { depth: h, bevelEnabled: false });
    g.rotateX(-Math.PI / 2); g.translate(0, y0, 0);
    return keep(g);
  };
  const centroid = pts => pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
  const moduleLabels = [];
  let usTop = 0;
  for (const b of BUILDINGS) {
    const y0 = b.c === 'bridgeroad' ? 5 : 0, h = b.c === 'bridgeroad' ? 9 : b.h;
    const g = extrude(b.p, h, y0);
    const mat = b.c === 'bridgeroad' ? mats.c0 : (mats[b.c] || mats.fac);
    const m = new Mesh(g, mat);
    m.castShadow = b.c !== 'ctx'; m.receiveShadow = true;
    m.userData.name = b.c === 'us' ? `${L.us} · ${L.usSub}` : b.c === 'access' ? L.access : b.n;
    m.add(new LineSegments(keep(new EdgesGeometry(g, 25)), b.c === 'us' ? mats.usEdge : b.c === 'ctx' ? mats.ctxEdge : mats.edge));
    world.add(m);
    if (b.c !== 'ctx') pickables.push(m);
    if (b.c === 'us') usTop = h;
    if (b.c === 'tower' || b.c === 'c0') moduleLabels.push({ text: b.n, pos: W(centroid(b.p), h + 3) });
  }

  /* the bridge between C3B Parell and C3 Parell */
  const [b0, b1] = SPOTS.bridge.map(p => W(p));
  const blen = b0.distanceTo(b1) + 2;
  const bridge = new Mesh(keep(new BoxGeometry(5, 4, blen)), keep(new MeshStandardMaterial({ color: 0xe9fff3, emissive: new Color(C.main), emissiveIntensity: 0.55, roughness: 0.4 })));
  bridge.position.copy(b0).add(b1).multiplyScalar(0.5).setY(2.2);
  bridge.lookAt(b1.x, 2.2, b1.z); bridge.castShadow = true; bridge.userData.name = L.bridge;
  bridge.add(new LineSegments(keep(new EdgesGeometry(bridge.geometry)), mats.usEdge));
  world.add(bridge); pickables.push(bridge);

  /* central corridor of Edifici C, faint line on the ground */
  const spinePts = SPINE.map(p => W(p, 0.6));
  world.add(new LineSegments(keep(new BufferGeometry().setFromPoints(spinePts.flatMap((p, i) => i ? [spinePts[i - 1], p] : []))),
    keep(new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }))));

  /* ---------- light beams (Optics Group and entrances) ---------- */
  const beamMat = color => keep(new ShaderMaterial({
    uniforms: { color: { value: new Color(color) }, time: { value: 0 } },
    vertexShader: 'varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 color; uniform float time; varying float vY; void main(){ float a = (1.0 - vY) * (0.55 + 0.15 * sin(time * 2.0)); gl_FragColor = vec4(color, a * 0.6); }',
    transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
  }));
  const beam = (p, color, height, radius) => {
    const g = new Group();
    const m = beamMat(color);
    const cyl = new Mesh(keep(new CylinderGeometry(radius * 0.6, radius, height, 32, 1, true)), m);
    cyl.position.y = height / 2; g.add(cyl);
    const ring = new Mesh(keep(new RingGeometry(radius * 1.2, radius * 1.8, 48)), keep(new MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: DoubleSide, depthWrite: false })));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.3; g.add(ring);
    g.position.copy(p); world.add(g);
    return { g, m, ring };
  };
  const usPos = W(SPOTS.us);
  const usBeam = beam(usPos.clone().setY(usTop + 0.2), C.usGlow, 46, 4.2);
  const beams = { main: beam(W(SPOTS.main), C.main, 30, 3), serra: beam(W(SPOTS.serra), C.serra, 30, 3) };

  /* ---------- routes: glowing tubes with moving chevrons, drawn over the buildings ---------- */
  const routeMat = color => keep(new ShaderMaterial({
    uniforms: { color: { value: new Color(color) }, time: { value: 0 }, len: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 color; uniform float time; uniform float len; varying vec2 vUv;
      void main(){ float s = fract(vUv.x * len / 9.0 - time * 0.9); float dash = smoothstep(0.0, 0.25, s) * (1.0 - smoothstep(0.55, 0.8, s));
        vec3 c = mix(color, vec3(1.0), dash * 0.65); gl_FragColor = vec4(c, 0.62 + 0.38 * dash); }`,
    transparent: true, depthTest: false, depthWrite: false,
  }));
  const routes = {};
  for (const [k, pts] of Object.entries(ROUTES)) {
    const path = new CurvePath();
    const P = pts.map(p => W(p, 1.6));
    for (let i = 1; i < P.length; i++) path.add(new LineCurve3(P[i - 1], P[i]));
    const len = path.getLength();
    const m = routeMat(C[k]); m.uniforms.len.value = len;
    const tube = new Mesh(keep(new TubeGeometry(path, Math.max(64, Math.round(len / 2)), 1.6, 8, false)), m);
    tube.renderOrder = 10; world.add(tube);
    const dot = new Mesh(keep(new SphereGeometry(2.4, 20, 14)), keep(new MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true })));
    dot.renderOrder = 11; world.add(dot);
    const bb = P.reduce((a, p) => ({ min: a.min.min(p), max: a.max.max(p) }), { min: P[0].clone(), max: P[0].clone() });
    routes[k] = { tube, m, dot, path, len, centre: bb.min.clone().add(bb.max).multiplyScalar(0.5), radius: bb.min.distanceTo(bb.max) / 2 };
  }

  /* ---------- HTML labels ---------- */
  const layer = container.querySelector('.bldg-labels');
  const label = (cls, text, pos, extra = {}) => {
    const el = document.createElement('span'); el.className = cls; el.textContent = text; layer.appendChild(el);
    return Object.assign({ el, pos }, extra);
  };
  const labels = [
    ...roadLabels.map(r => label(r.cls, r.text, r.pos)),
    ...moduleLabels.map(m => label('bldg-mod', m.text, m.pos)),
    label('bldg-pin bldg-pin-main', L.main, W(SPOTS.main, 31), { route: 'main' }),
    label('bldg-pin bldg-pin-serra', L.serra, W(SPOTS.serra, 31), { route: 'serra' }),
    label('bldg-pin bldg-pin-cross', L.cross, W(SPOTS.crossing, 6), { route: 'serra' }),
    label('bldg-pin bldg-pin-bridge', L.bridge, bridge.position.clone().setY(0), { route: 'any', below: true }),
  ];
  const usLabel = document.createElement('div'); usLabel.className = 'bldg-us';
  usLabel.innerHTML = '<div class="bldg-card"><b></b><span></span></div>';
  usLabel.querySelector('b').textContent = L.us; usLabel.querySelector('span').textContent = L.usSub;
  layer.appendChild(usLabel);
  const usAnchor = usPos.clone().setY(usTop + 4);
  const compass = document.createElement('span'); compass.className = 'bldg-compass'; compass.innerHTML = '<i></i><b></b>';
  compass.querySelector('b').textContent = L.north; layer.appendChild(compass);
  const tip = container.querySelector('.bldg-tip');

  /* ---------- camera ---------- */
  const HOME = { az: 2.05, el: 0.62, dist: 520, target: new Vector3(14, 0, -12) };
  const TOP = { az: Math.PI / 2, el: 1.53, dist: 560, target: new Vector3(10, 0, -10) };
  const FOCUS = { az: 2.25, el: 0.55, dist: 150, target: usPos.clone().setY(2) };
  const routeView = k => ({ az: k === 'serra' ? 2.6 : 1.95, el: 0.7, dist: Math.max(260, routes[k].radius * 3.4), target: routes[k].centre.clone().setY(0) });
  const view = { az: HOME.az, el: HOME.el, dist: HOME.dist, target: HOME.target.clone() };
  const goal = { ...view, target: view.target.clone() };
  const setGoal = g => { Object.assign(goal, { az: g.az, el: g.el, dist: g.dist }); goal.target.copy(g.target); kick(); };
  let auto = false, dragging = false, last = null, pinch = null, raf = 0, visible = true, hoverName = '', active = 'main';
  const showRoute = k => {
    active = k;
    for (const [r, o] of Object.entries(routes)) { o.tube.visible = o.dot.visible = r === k; beams[r].g.visible = r === k; }
    container.querySelectorAll('[data-b^="route-"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.b === `route-${k}`)));
  };

  const size = () => {
    const w = container.clientWidth, h = Math.max(320, Math.round(w * (w < 640 ? 1.1 : 0.6)));
    canvas.style.height = h + 'px';
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    kick();
  };
  const tmp = new Vector3();
  const project = (v, out) => { tmp.copy(v).project(camera); out.x = (tmp.x + 1) / 2 * canvas.clientWidth; out.y = (1 - tmp.y) / 2 * canvas.clientHeight; return tmp.z < 1 && Math.abs(tmp.x) < 1.15 && Math.abs(tmp.y) < 1.15; };
  const s2 = new Vector2(), s3 = new Vector2();
  const frame = t => {
    raf = 0;
    const time = (t || 0) / 1000;
    if (auto && !dragging) goal.az += 0.0012;
    const k = reduced ? 1 : 0.1;
    view.az += (goal.az - view.az) * k; view.el += (goal.el - view.el) * k; view.dist += (goal.dist - view.dist) * k;
    view.target.lerp(goal.target, k);
    camera.position.set(
      view.target.x + view.dist * Math.cos(view.el) * Math.cos(view.az),
      view.target.y + view.dist * Math.sin(view.el),
      view.target.z + view.dist * Math.cos(view.el) * Math.sin(view.az));
    camera.lookAt(view.target);
    const tt = reduced ? 0 : time;
    for (const o of Object.values(routes)) {
      o.m.uniforms.time.value = tt;
      o.dot.position.copy(o.path.getPointAt(reduced ? 1 : (time / Math.max(6, o.len / 45)) % 1));
    }
    for (const b of [usBeam, ...Object.values(beams)]) { b.m.uniforms.time.value = tt; const s = 1 + 0.35 * ((tt * 0.8) % 1); b.ring.scale.set(s, s, s); b.ring.material.opacity = 0.8 * (1 - ((tt * 0.8) % 1)); }
    mats.us.emissiveIntensity = reduced ? 0.4 : 0.3 + 0.2 * (0.5 + 0.5 * Math.sin(time * 2.2));
    renderer.render(scene, camera);
    const Wd = canvas.clientWidth, Hd = canvas.clientHeight;
    for (const l of labels) {
      const on = !l.route || l.route === 'any' || l.route === active;
      const ok = on && project(l.pos, s2);
      l.el.style.opacity = ok ? 1 : 0;
      if (ok) l.el.style.transform = `translate(${s2.x}px,${s2.y}px) translate(-50%,${l.below ? '60%' : '-100%'})`;
    }
    project(usAnchor, s2);
    const card = usLabel.firstElementChild, cw = card.offsetWidth;
    card.style.left = `${Math.max(8 - s2.x, Math.min(-1, Wd - 8 - s2.x - cw))}px`;
    usLabel.style.transform = `translate(${MathUtils.clamp(s2.x, 8, Wd - 8)}px,${MathUtils.clamp(s2.y, card.offsetHeight + 56, Hd - 8)}px)`;
    /* compass: direction of north on screen */
    project(view.target, s2); project(view.target.clone().add(new Vector3(0, 0, -60)), s3);
    compass.firstElementChild.style.transform = `rotate(${Math.atan2(s3.x - s2.x, -(s3.y - s2.y))}rad)`;
    if (visible && !(reduced && !dragging && Math.abs(goal.az - view.az) + Math.abs(goal.el - view.el) + Math.abs(goal.dist - view.dist) + view.target.distanceTo(goal.target) < 1e-3)) raf = requestAnimationFrame(frame);
  };
  function kick() { if (!raf && visible) raf = requestAnimationFrame(frame); }

  /* ---------- input ---------- */
  const stopAuto = () => { if (auto) { auto = false; container.querySelector('[data-b="auto"]')?.setAttribute('aria-pressed', 'false'); } };
  const clampEl = v => MathUtils.clamp(v, 0.15, 1.53), clampDist = v => MathUtils.clamp(v, 70, 900);
  const onDown = e => {
    if (e.pointerType === 'touch' && pinch) return;
    dragging = true; last = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); stopAuto(); container.classList.add('grabbing'); kick();
  };
  const onMove = e => {
    if (dragging && last) {
      const dx = e.clientX - last.x, dy = e.clientY - last.y; last = { x: e.clientX, y: e.clientY };
      goal.az += dx * 0.008; goal.el = clampEl(goal.el + dy * 0.006); kick();
      return;
    }
    if (e.pointerType !== 'mouse') return;
    const r = canvas.getBoundingClientRect(), ray = new Raycaster();
    ray.setFromCamera(new Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.intersectObjects(pickables, false).find(h => h.object.userData.name);
    const name = hit ? hit.object.userData.name : '';
    if (name !== hoverName) { hoverName = name; tip.textContent = name; tip.hidden = !name; }
    if (name) tip.style.transform = `translate(${e.clientX - r.left + 14}px,${e.clientY - r.top + 14}px)`;
  };
  const onUp = e => { dragging = false; last = null; container.classList.remove('grabbing'); try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* already released */ } kick(); };
  const onLeave = () => { hoverName = ''; tip.hidden = true; };
  const onWheel = e => {
    if (!(e.ctrlKey || e.metaKey)) { container.classList.add('hinting'); clearTimeout(onWheel.t); onWheel.t = setTimeout(() => container.classList.remove('hinting'), 1400); return; }
    e.preventDefault(); stopAuto(); goal.dist = clampDist(goal.dist * (1 + Math.sign(e.deltaY) * 0.1)); kick();
  };
  const onTouchStart = e => { if (e.touches.length === 2) { pinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); dragging = false; stopAuto(); } };
  const onTouchMove = e => {
    if (e.touches.length !== 2 || !pinch) return;
    e.preventDefault();
    const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    goal.dist = clampDist(goal.dist * pinch / d); pinch = d; kick();
  };
  const onTouchEnd = e => { if (e.touches.length < 2) pinch = null; };
  const onKey = e => {
    const step = { ArrowLeft: [-0.2, 0], ArrowRight: [0.2, 0], ArrowUp: [0, -0.12], ArrowDown: [0, 0.12] }[e.key];
    if (step) { e.preventDefault(); stopAuto(); goal.az += step[0]; goal.el = clampEl(goal.el + step[1]); kick(); return; }
    if (e.key === '+' || e.key === '=') { stopAuto(); goal.dist = clampDist(goal.dist * 0.88); kick(); }
    else if (e.key === '-' || e.key === '_') { stopAuto(); goal.dist = clampDist(goal.dist * 1.12); kick(); }
    else if (e.key === '0' || e.key === 'Home') { setGoal(HOME); }
  };
  const onButton = e => {
    const b = e.target.closest('[data-b]'); if (!b) return;
    const a = b.dataset.b;
    if (a !== 'auto') stopAuto();
    if (a === 'home') setGoal(HOME);
    else if (a === 'top') setGoal(TOP);
    else if (a === 'us') setGoal(FOCUS);
    else if (a === 'in') { goal.dist = clampDist(goal.dist * 0.8); kick(); }
    else if (a === 'out') { goal.dist = clampDist(goal.dist * 1.25); kick(); }
    else if (a === 'auto') { auto = !auto; b.setAttribute('aria-pressed', String(auto)); kick(); }
    else if (a.startsWith('route-')) { const k = a.slice(6); if (routes[k]) { showRoute(k); setGoal(routeView(k)); } }
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('touchstart', onTouchStart, { passive: true });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd);
  canvas.addEventListener('keydown', onKey);
  container.addEventListener('click', onButton);
  const ro = new ResizeObserver(size); ro.observe(container);
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) kick(); });
  io.observe(container);
  container.querySelector('[data-b="auto"]')?.setAttribute('aria-pressed', 'false');
  showRoute('main');
  size(); kick();

  return function dispose() {
    cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
    canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp);
    canvas.removeEventListener('pointerleave', onLeave); canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('touchstart', onTouchStart); canvas.removeEventListener('touchmove', onTouchMove);
    canvas.removeEventListener('touchend', onTouchEnd); canvas.removeEventListener('keydown', onKey);
    container.removeEventListener('click', onButton);
    disposables.forEach(d => d.dispose && d.dispose());
    renderer.dispose();
    layer.replaceChildren();
  };
}
