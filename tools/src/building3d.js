/* Interactive 3D model of Edifici C (Faculty of Sciences, UAB) for the "How to reach us" page.
   Source of js/building3d.js: after editing, run `bash tools/build-3d.sh` and commit both files.
   Schematic model drawn from the faculty's floor-plan diagram: a central spine with paired "Senar" (west) and
   "Parell" (east) towers, wings ("ala") and the C0 block with two courtyards. The Optics Group is highlighted in
   C3 Parell, floor 0/−1: the lower wing next to C3 ("C3B" in the faculty's diagram), half a level below the ground
   floor (the translucent ground plane cuts that floor in half).

   mountBuilding(container, { labels }) builds the scene inside `container` and returns a function that frees it. */
import {
  WebGLRenderer, Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, AmbientLight, Group, Mesh, BoxGeometry,
  PlaneGeometry, MeshStandardMaterial, LineSegments, LineBasicMaterial, BufferGeometry, Float32BufferAttribute,
  EdgesGeometry, Vector3, Vector2, Raycaster, PCFSoftShadowMap, SRGBColorSpace, Color, Box3, MathUtils,
} from 'three';

const FLOOR = 0.42;                 /* height of one floor (scene units ≈ 8 m) */
const GROUND = FLOOR;               /* floor −1 is half below the sloping ground */
const COLORS = {
  body: 0xeef3f9, bodyTop: 0xffffff, edge: 0x0d3a6b, spine: 0xd5dfeb,
  us: 0x028b3c, usGlow: 0x5fd39a, ground: 0x0a2a52,
};

/* ---------- the building, in plan: [name, x0, x1, z0, z1, floors (from −1)] ---------- */
function plan() {
  const T = { d: 1.7, h: 7 };       /* towers: depth, floors */
  const W = { d: 1.1, h: 4 };       /* wings */
  const parts = [];
  const tower = (m, z) => {
    parts.push([`${m} Senar`, -2.7, -0.18, z - T.d / 2, z + T.d / 2, T.h]);
    parts.push([`${m} Parell`, 0.18, 2.7, z - T.d / 2, z + T.d / 2, T.h]);
  };
  const wing = (name, side, x0, x1, z) => parts.push([name, side < 0 ? -x1 : x0, side < 0 ? -x0 : x1, z - W.d / 2, z + W.d / 2, W.h]);
  /* north to south */
  tower('C7', 1.0); wing('C7 Parell ala', 1, 2.7, 6.4, 1.0);
  wing('C7B Parell ala', 1, 0.18, 6.9, 3.0);
  tower('C5', 5.0); wing('C5 Senar ala', -1, 2.7, 5.4, 5.0); wing('C5 Parell ala', 1, 2.7, 7.0, 5.0);
  wing('C5B Parell ala', 1, 0.18, 6.9, 7.0);
  tower('C3', 9.0); wing('C3 Senar ala', -1, 2.7, 5.4, 9.0); wing('C3 Parell ala', 1, 2.7, 6.8, 9.0);
  wing('C3B Senar ala', -1, 0.18, 5.0, 11.0); wing('C3B Parell ala', 1, 0.18, 5.6, 11.0);
  tower('C1', 13.0); wing('C1 Senar ala', -1, 2.7, 5.4, 13.0); wing('C1 Parell ala', 1, 2.7, 7.0, 13.0);
  /* C0: a block with two courtyards */
  const c0 = [15.0, 19.4], hole = [[15.7, 16.7], [17.7, 18.7]], hx = 0.75, c0h = 6;
  parts.push(['C0', -2.6, -hx, c0[0], c0[1], c0h], ['C0', hx, 2.6, c0[0], c0[1], c0h]);
  parts.push(['C0', -hx, hx, c0[0], hole[0][0], c0h], ['C0', -hx, hx, hole[0][1], hole[1][0], c0h], ['C0', -hx, hx, hole[1][1], c0[1], c0h]);
  tower('C2', 21.4); wing('C2 Senar ala', -1, 2.7, 5.4, 21.4); wing('C2 Parell ala', 1, 2.7, 7.0, 21.4);
  /* the central corridor */
  parts.push(['Central corridor', -0.18, 0.18, 0.2, 22.2, 5]);
  return parts;
}
const US = 'C3B Parell ala';
const US_FLOORS = 1;                /* floor 0/−1, half a level below the ground floor */
const MODULE_LABELS = ['C7', 'C5', 'C3', 'C1', 'C0', 'C2'];

/* horizontal floor lines around a box */
function floorLines(x0, x1, z0, z1, floors) {
  const v = [];
  for (let f = 1; f < floors; f++) {
    const y = f * FLOOR;
    v.push(x0, y, z0, x1, y, z0, x1, y, z0, x1, y, z1, x1, y, z1, x0, y, z1, x0, y, z1, x0, y, z0);
  }
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(v, 3)); return g;
}

export function mountBuilding(container, opts = {}) {
  const L = Object.assign({ us: 'Optics Group', usSub: 'C3 Parell · floor 0/−1', hint: 'Drag to rotate' }, opts.labels || {});
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = container.querySelector('canvas');
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFSoftShadowMap;

  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1, 0.1, 200);
  scene.add(new HemisphereLight(0xffffff, 0x0a2a52, 1.35));
  scene.add(new AmbientLight(0xffffff, 0.25));
  const sun = new DirectionalLight(0xffffff, 1.6);
  sun.position.set(-14, 22, -8); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 });
  sun.shadow.bias = -0.0008;
  scene.add(sun);

  const model = new Group(); scene.add(model);
  const mats = {
    body: new MeshStandardMaterial({ color: COLORS.body, roughness: 0.85, metalness: 0 }),
    spine: new MeshStandardMaterial({ color: COLORS.spine, roughness: 0.9 }),
    us: new MeshStandardMaterial({ color: COLORS.us, roughness: 0.55, emissive: new Color(COLORS.usGlow), emissiveIntensity: 0.25 }),
    usUpper: new MeshStandardMaterial({ color: COLORS.body, roughness: 0.85, transparent: true, opacity: 0.55 }),
    edge: new LineBasicMaterial({ color: COLORS.edge, transparent: true, opacity: 0.55 }),
    floor: new LineBasicMaterial({ color: COLORS.edge, transparent: true, opacity: 0.22 }),
    usEdge: new LineBasicMaterial({ color: COLORS.usGlow }),
  };
  const pickables = [];
  const addBox = (name, x0, x1, z0, z1, y0, y1, mat, edgeMat = mats.edge) => {
    const g = new BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    const m = new Mesh(g, mat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.castShadow = true; m.receiveShadow = true; m.userData.name = name;
    const e = new LineSegments(new EdgesGeometry(g), edgeMat); m.add(e);
    model.add(m); pickables.push(m);
    return m;
  };
  let usCenter = null, usTop = 0;
  for (const [name, x0, x1, z0, z1, floors] of plan()) {
    const h = floors * FLOOR;
    if (name === US) {
      addBox(name, x0, x1, z0, z1, 0, US_FLOORS * FLOOR, mats.us, mats.usEdge);
      addBox(name, x0, x1, z0, z1, US_FLOORS * FLOOR, h, mats.usUpper);
      usCenter = new Vector3((x0 + x1) / 2, US_FLOORS * FLOOR, (z0 + z1) / 2); usTop = h;
    } else {
      addBox(name, x0, x1, z0, z1, 0, h, name === 'Central corridor' ? mats.spine : mats.body);
    }
    if (floors > 1) model.add(new LineSegments(floorLines(x0, x1, z0, z1, name === US ? US_FLOORS + 1 : floors), name === US ? mats.usEdge : mats.floor));
  }
  /* ground at the level of floor 0 (floor −1 half sunk), translucent so the lower floor shows */
  const ground = new Mesh(new PlaneGeometry(60, 60), new MeshStandardMaterial({ color: COLORS.ground, transparent: true, opacity: 0.35, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(1.5, GROUND * 0.5, 11); ground.receiveShadow = true; scene.add(ground);

  /* ---------- labels (HTML, positioned every frame), in model coordinates ---------- */
  model.updateMatrixWorld(true);
  const labelLayer = container.querySelector('.bldg-labels');
  const moduleLabels = MODULE_LABELS.map(m => {
    const meshes = pickables.filter(p => p.userData.name === m || p.userData.name === `${m} Senar`);
    const b = new Box3(); meshes.forEach(x => b.expandByObject(x));
    const el = document.createElement('span'); el.className = 'bldg-mod'; el.textContent = m; labelLayer.appendChild(el);
    return { el, pos: new Vector3((b.min.x + b.max.x) / 2, b.max.y + 0.15, (b.min.z + b.max.z) / 2) };
  });
  const usLabel = document.createElement('div'); usLabel.className = 'bldg-us';
  usLabel.innerHTML = '<div class="bldg-card"><b></b><span></span></div>';
  usLabel.querySelector('b').textContent = L.us; usLabel.querySelector('span').textContent = L.usSub;
  labelLayer.appendChild(usLabel);
  const usAnchor = usCenter ? usCenter.clone().setY(usTop + 0.1) : new Vector3();
  const tip = container.querySelector('.bldg-tip');

  /* centre the model on the origin (labels above stay in model coordinates; project() adds the offset) */
  const box = new Box3().setFromObject(model), centre = box.getCenter(new Vector3());
  model.position.set(-centre.x, 0, -centre.z); ground.position.x -= centre.x; ground.position.z -= centre.z;
  const usWorld = usCenter ? usCenter.clone().add(model.position) : new Vector3();

  /* ---------- camera orbit ---------- */
  /* camera around the target: az 90° = from the south, so north (C7) is up and the Parell side on the right,
     as in the faculty's floor-plan diagram */
  const HOME = { az: 1.05, el: 0.66, dist: 36, target: new Vector3(0, 0.6, 0) };
  const TOP = { az: Math.PI / 2, el: 1.5, dist: 38, target: new Vector3(0, 0, 0) };
  const FOCUS = { az: 0.42, el: 0.52, dist: 18, target: usWorld.clone() };
  const view = { az: HOME.az, el: HOME.el, dist: HOME.dist, target: HOME.target.clone() };
  const goal = { ...view, target: view.target.clone() };
  const setGoal = g => { Object.assign(goal, { az: g.az, el: g.el, dist: g.dist }); goal.target.copy(g.target); kick(); };
  let auto = !reduced, dragging = false, last = null, pinch = null, raf = 0, visible = true, hoverName = '';

  const size = () => {
    const w = container.clientWidth, h = Math.max(280, Math.round(w * (w < 640 ? 0.95 : 0.56)));
    canvas.style.height = h + 'px';
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    kick();
  };
  const project = (v, out) => { const p = v.clone().add(model.position).project(camera); out.x = (p.x + 1) / 2 * canvas.clientWidth; out.y = (1 - p.y) / 2 * canvas.clientHeight; return p.z < 1; };
  const tmp = new Vector2();
  const frame = t => {
    raf = 0;
    if (auto && !dragging) goal.az += 0.0016;
    const k = reduced ? 1 : 0.12;
    view.az += (goal.az - view.az) * k; view.el += (goal.el - view.el) * k; view.dist += (goal.dist - view.dist) * k;
    view.target.lerp(goal.target, k);
    camera.position.set(
      view.target.x + view.dist * Math.cos(view.el) * Math.cos(view.az),
      view.target.y + view.dist * Math.sin(view.el),
      view.target.z + view.dist * Math.cos(view.el) * Math.sin(view.az));
    camera.lookAt(view.target);
    mats.us.emissiveIntensity = reduced ? 0.3 : 0.22 + 0.18 * (0.5 + 0.5 * Math.sin((t || 0) / 520));
    renderer.render(scene, camera);
    moduleLabels.forEach(({ el, pos }) => { const ok = project(pos, tmp); el.style.transform = `translate(${tmp.x}px,${tmp.y}px) translate(-50%,-100%)`; el.style.opacity = ok ? 1 : 0; });
    project(usAnchor, tmp);
    const card = usLabel.firstElementChild, cw = card.offsetWidth, W = canvas.clientWidth;
    /* the card starts at the leader line and slides left when it would leave the stage */
    card.style.left = `${Math.max(8 - tmp.x, Math.min(-1, W - 8 - tmp.x - cw))}px`;
    usLabel.style.transform = `translate(${MathUtils.clamp(tmp.x, 8, W - 8)}px,${MathUtils.clamp(tmp.y, card.offsetHeight + 56, canvas.clientHeight - 8)}px)`;
    const moving = Math.abs(goal.az - view.az) + Math.abs(goal.el - view.el) + Math.abs(goal.dist - view.dist) + view.target.distanceTo(goal.target) > 1e-3;
    if (visible && (auto || moving || dragging || !reduced)) raf = requestAnimationFrame(frame);
  };
  function kick() { if (!raf && visible) raf = requestAnimationFrame(frame); }

  /* ---------- input ---------- */
  const stopAuto = () => { if (auto) { auto = false; container.querySelector('[data-b="auto"]')?.setAttribute('aria-pressed', 'false'); } };
  const onDown = e => {
    if (e.pointerType === 'touch' && pinch) return;
    dragging = true; last = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); stopAuto(); container.classList.add('grabbing'); kick();
  };
  const onMove = e => {
    if (dragging && last) {
      const dx = e.clientX - last.x, dy = e.clientY - last.y; last = { x: e.clientX, y: e.clientY };
      goal.az += dx * 0.008; goal.el = MathUtils.clamp(goal.el + dy * 0.006, 0.18, 1.48); kick();
      return;
    }
    if (e.pointerType !== 'mouse') return;
    const r = canvas.getBoundingClientRect(), ray = new Raycaster();
    ray.setFromCamera(new Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    const name = hit ? hit.object.userData.name : '';
    if (name !== hoverName) { hoverName = name; tip.textContent = name ? (L.names && L.names[name]) || name : ''; tip.hidden = !name; }
    if (name) tip.style.transform = `translate(${e.clientX - r.left + 14}px,${e.clientY - r.top + 14}px)`;
  };
  const onUp = e => { dragging = false; last = null; container.classList.remove('grabbing'); try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* already released */ } };
  const onLeave = () => { hoverName = ''; tip.hidden = true; };
  const onWheel = e => {
    if (!(e.ctrlKey || e.metaKey)) { container.classList.add('hinting'); clearTimeout(onWheel.t); onWheel.t = setTimeout(() => container.classList.remove('hinting'), 1400); return; }
    e.preventDefault(); stopAuto(); goal.dist = MathUtils.clamp(goal.dist * (1 + Math.sign(e.deltaY) * 0.1), 9, 60); kick();
  };
  const onTouchStart = e => { if (e.touches.length === 2) { pinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); dragging = false; stopAuto(); } };
  const onTouchMove = e => {
    if (e.touches.length !== 2 || !pinch) return;
    e.preventDefault();
    const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    goal.dist = MathUtils.clamp(goal.dist * pinch / d, 9, 60); pinch = d; kick();
  };
  const onTouchEnd = e => { if (e.touches.length < 2) pinch = null; };
  const onKey = e => {
    const step = { ArrowLeft: [-0.2, 0], ArrowRight: [0.2, 0], ArrowUp: [0, -0.12], ArrowDown: [0, 0.12] }[e.key];
    if (step) { e.preventDefault(); stopAuto(); goal.az += step[0]; goal.el = MathUtils.clamp(goal.el + step[1], 0.18, 1.48); kick(); return; }
    if (e.key === '+' || e.key === '=') { stopAuto(); goal.dist = Math.max(9, goal.dist * 0.88); kick(); }
    else if (e.key === '-' || e.key === '_') { stopAuto(); goal.dist = Math.min(60, goal.dist * 1.12); kick(); }
    else if (e.key === '0' || e.key === 'Home') { setGoal(HOME); }
  };
  const onButton = e => {
    const b = e.target.closest('[data-b]'); if (!b) return;
    const a = b.dataset.b;
    if (a === 'home') { stopAuto(); setGoal(HOME); }
    else if (a === 'top') { stopAuto(); setGoal(TOP); }
    else if (a === 'us') { stopAuto(); setGoal(FOCUS); }
    else if (a === 'in') { stopAuto(); goal.dist = Math.max(9, goal.dist * 0.8); kick(); }
    else if (a === 'out') { stopAuto(); goal.dist = Math.min(60, goal.dist * 1.25); kick(); }
    else if (a === 'auto') { auto = !auto; b.setAttribute('aria-pressed', String(auto)); kick(); }
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
  container.querySelector('[data-b="auto"]')?.setAttribute('aria-pressed', String(auto));
  size(); kick();

  return function dispose() {
    cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
    canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp);
    canvas.removeEventListener('pointerleave', onLeave); canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('touchstart', onTouchStart); canvas.removeEventListener('touchmove', onTouchMove);
    canvas.removeEventListener('touchend', onTouchEnd); canvas.removeEventListener('keydown', onKey);
    container.removeEventListener('click', onButton);
    scene.traverse(o => { o.geometry?.dispose(); });
    Object.values(mats).forEach(m => m.dispose());
    renderer.dispose();
    labelLayer.replaceChildren();
  };
}
