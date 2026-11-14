// editor-viewport.js — نافذة العرض: المشهد، الكاميرتان، OrbitControls، TransformControls،
// ViewHelper، أوضاع التظليل، الشبكة، مؤشر 3D، الإحصائيات، الالتقاط (Picking)
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { ViewHelper } from 'three/addons/helpers/ViewHelper.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ctx, bus, toast } from './editor-state.js';
import { History } from './editor-history.js';

// ---------- تسريع الأشعة بـ three-mesh-bvh (اختياري: يعمل المحرر بدونه) ----------
export const bvh = { loaded: false, lib: null };
try {
  const m = await import('three-mesh-bvh');
  THREE.BufferGeometry.prototype.computeBoundsTree = m.computeBoundsTree;
  THREE.BufferGeometry.prototype.disposeBoundsTree = m.disposeBoundsTree;
  THREE.Mesh.prototype.raycast = m.acceleratedRaycast;
  bvh.loaded = true;
  bvh.lib = m;
} catch (e) {
  console.warn('three-mesh-bvh غير متاح، سيُستخدم الالتقاط القياسي', e);
}

export function invalidateBVH(geometry) {
  if (bvh.loaded && geometry && geometry.boundsTree) geometry.disposeBoundsTree();
  if (geometry && geometry.userData) delete geometry.userData._info;
}

// ---------- المصيّر والمشهد ----------
const viewportEl = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.info.autoReset = false;
renderer.domElement.style.display = 'block';
viewportEl.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const world = new THREE.Group();
world.name = 'Scene Collection';
scene.add(world);
const overlayRoot = new THREE.Group();
overlayRoot.name = '__overlay__';
scene.add(overlayRoot);

// ---------- الكاميرتان (منظور + متعامد) ----------
export const ORTHO_H = 10;
const persp = new THREE.PerspectiveCamera(50, 1, 0.01, 5000);
persp.position.set(6.5, 5, 8.5);
const ortho = new THREE.OrthographicCamera(-ORTHO_H / 2, ORTHO_H / 2, ORTHO_H / 2, -ORTHO_H / 2, -2000, 5000);
let camera = persp;

const orbit = new OrbitControls(persp, renderer.domElement);
orbit.enableDamping = false;
orbit.screenSpacePanning = true;
orbit.minDistance = 0.02;
orbit.maxDistance = 3000;
orbit.target.set(0, 0.8, 0);
orbit.mouseButtons = { LEFT: -1, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN };
orbit.update();

const transform = new TransformControls(camera, renderer.domElement);
transform.setSize(0.9);
overlayRoot.add(transform.getHelper());
transform.addEventListener('dragging-changed', (event) => {
  orbit.enabled = !event.value;
  bus.emit('gizmo-drag', event.value);
});

// ---------- ViewHelper (لوحة محاور تفاعلية أعلى اليمين، بمصيّر صغير مستقل) ----------
const vhHost = document.getElementById('view-helper');
const vhRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
vhRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
vhRenderer.setSize(128, 128);
vhRenderer.domElement.style.display = 'block';
vhHost.appendChild(vhRenderer.domElement);
const viewHelper = new ViewHelper(camera, vhRenderer.domElement);
viewHelper.center = orbit.target;
vhRenderer.domElement.addEventListener('pointerup', (e) => {
  e.stopPropagation();
  viewHelper.center = orbit.target;
  viewHelper.handleClick(e);
});

// ---------- البيئة والخلفية ----------
const pmrem = new THREE.PMREMGenerator(renderer);
const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

function makeMatcap() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(100, 86, 8, 128, 128, 132);
  grd.addColorStop(0, '#ffffff');
  grd.addColorStop(0.3, '#d7d7d7');
  grd.addColorStop(0.7, '#8a8a8a');
  grd.addColorStop(1, '#3d3d3d');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const matcapTex = makeMatcap();
const overrides = {
  wire: new THREE.MeshBasicMaterial({ color: 0xd8d8d8, wireframe: true }),
  solid: new THREE.MeshMatcapMaterial({ matcap: matcapTex, side: THREE.DoubleSide }),
  xray: new THREE.MeshMatcapMaterial({ matcap: matcapTex, side: THREE.DoubleSide, transparent: true, opacity: 0.38, depthWrite: false })
};

let gradientTex = null;
function buildGradient() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, ctx.settings.bgColor2);
  grd.addColorStop(1, ctx.settings.bgColor);
  g.fillStyle = grd;
  g.fillRect(0, 0, 4, 256);
  if (gradientTex) gradientTex.dispose();
  gradientTex = new THREE.CanvasTexture(c);
  gradientTex.colorSpace = THREE.SRGBColorSpace;
}

const TONE = {
  None: THREE.NoToneMapping, Linear: THREE.LinearToneMapping, Reinhard: THREE.ReinhardToneMapping,
  Cineon: THREE.CineonToneMapping, ACES: THREE.ACESFilmicToneMapping, AgX: THREE.AgXToneMapping, Neutral: THREE.NeutralToneMapping
};

export function applyShading() {
  const s = ctx.settings;
  const lit = s.shading === 'rendered';
  const real = s.shading === 'preview' || lit;
  [persp, ortho].forEach((c) => { if (lit) c.layers.enable(1); else c.layers.disable(1); });
  renderer.toneMapping = lit ? (TONE[s.toneMapping] ?? THREE.ACESFilmicToneMapping) : THREE.NoToneMapping;
  renderer.toneMappingExposure = s.exposure;
  scene.environment = (s.shading === 'preview' || (lit && s.useEnv)) ? envTexture : null;
  scene.environmentIntensity = s.envIntensity;
  scene.backgroundIntensity = 1;
  scene.backgroundBlurriness = 0.5;
  if (real && s.bgMode === 'gradient') { buildGradient(); scene.background = gradientTex; }
  else if (real && s.bgMode === 'env') scene.background = envTexture;
  else scene.background = new THREE.Color(s.bgColor);
  if (s.shading === 'wire') scene.overrideMaterial = overrides.wire;
  else if (s.xray) scene.overrideMaterial = overrides.xray;
  else if (s.shading === 'solid') scene.overrideMaterial = overrides.solid;
  else scene.overrideMaterial = null;
  bus.emit('settings');
}

// ---------- الشبكة والمحاور ومؤشر 3D ----------
const grid = new THREE.GridHelper(200, 200, 0x707070, 0x474747);
grid.material.transparent = true;
grid.material.opacity = 0.7;
grid.material.toneMapped = false;
overlayRoot.add(grid);
const axisX = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1000, 0, 0), new THREE.Vector3(1000, 0, 0)]),
  new THREE.LineBasicMaterial({ color: 0xc04a4a, toneMapped: false }));
const axisZ = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -1000), new THREE.Vector3(0, 0, 1000)]),
  new THREE.LineBasicMaterial({ color: 0x4a76c0, toneMapped: false }));
overlayRoot.add(axisX, axisZ);

const cursor = new THREE.Group();
cursor.name = '3D Cursor';
(function buildCursor() {
  const ring = (r, color) => {
    const pts = [];
    for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0)); }
    return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, depthTest: false, toneMapped: false }));
  };
  const ticks = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-1.5, 0, 0), new THREE.Vector3(-0.6, 0, 0), new THREE.Vector3(0.6, 0, 0), new THREE.Vector3(1.5, 0, 0),
    new THREE.Vector3(0, -1.5, 0), new THREE.Vector3(0, -0.6, 0), new THREE.Vector3(0, 0.6, 0), new THREE.Vector3(0, 1.5, 0)
  ]), new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false, toneMapped: false }));
  cursor.add(ring(1, 0xff3030), ring(0.82, 0xffffff), ticks);
  cursor.children.forEach((c) => { c.renderOrder = 999; });
})();
overlayRoot.add(cursor);

// ---------- اللوحات المساعدة: التحديد، نقاط الأصل، رموز الأضواء ----------
const selectionGroup = new THREE.Group();
overlayRoot.add(selectionGroup);
const originGeo = new THREE.BufferGeometry();
const originPoints = new THREE.Points(originGeo, new THREE.PointsMaterial({ color: 0xffa028, size: 7, sizeAttenuation: false, depthTest: false, toneMapped: false }));
originPoints.renderOrder = 998;
originPoints.frustumCulled = false;
overlayRoot.add(originPoints);

const lightHelpers = new Map();
const pickerGeo = new THREE.SphereGeometry(0.32, 8, 6);
const pickerMat = new THREE.MeshBasicMaterial({ visible: false });

function makeLightHelper(light) {
  if (light.isDirectionalLight) return new THREE.DirectionalLightHelper(light, 0.9);
  if (light.isSpotLight) return new THREE.SpotLightHelper(light);
  if (light.isPointLight) return new THREE.PointLightHelper(light, 0.22);
  if (light.isHemisphereLight) return new THREE.HemisphereLightHelper(light, 0.6);
  return null;
}

function reconcileLightHelpers() {
  const present = new Set();
  world.traverse((o) => { if (o.isLight) present.add(o); });
  lightHelpers.forEach((entry, light) => {
    if (!present.has(light)) {
      overlayRoot.remove(entry.helper, entry.picker);
      if (entry.helper.dispose) entry.helper.dispose();
      lightHelpers.delete(light);
    }
  });
  present.forEach((light) => {
    if (lightHelpers.has(light)) return;
    const helper = makeLightHelper(light);
    if (!helper) return;
    const picker = new THREE.Mesh(pickerGeo, pickerMat);
    picker.userData.target = light;
    overlayRoot.add(helper, picker);
    lightHelpers.set(light, { helper, picker });
  });
}
bus.on('scene', reconcileLightHelpers);

function isEffectivelyVisible(o) {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

function updateLightHelpers() {
  lightHelpers.forEach((entry, light) => {
    entry.helper.visible = isEffectivelyVisible(light);
    light.updateWorldMatrix(true, false);
    if (light.target) light.target.updateWorldMatrix(true, false);
    entry.helper.update();
    entry.picker.position.setFromMatrixPosition(light.matrixWorld);
    entry.picker.updateMatrixWorld(true);
    const sel = ctx.selection.includes(light);
    if (entry.helper.material && entry.helper.material.color && !light.isPointLight && !light.isHemisphereLight) {
      entry.helper.material.color.set(sel ? 0xffa028 : 0xdddddd);
    }
  });
}

function rebuildSelectionVisuals() {
  while (selectionGroup.children.length) {
    const c = selectionGroup.children[0];
    selectionGroup.remove(c);
    if (c.geometry) c.geometry.dispose();
    if (c.material) c.material.dispose();
  }
  ctx.selection.forEach((o) => {
    o.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(o);
    if (box.isEmpty()) return;
    const bh = new THREE.BoxHelper(o, o === ctx.active ? 0xffa028 : 0xc05e00);
    bh.material.toneMapped = false;
    bh.material.depthTest = false;
    bh.userData.target = o;
    selectionGroup.add(bh);
  });
}
bus.on('selection', rebuildSelectionVisuals);
bus.on('scene', rebuildSelectionVisuals);

function updateSelectionVisuals() {
  selectionGroup.children.forEach((bh) => { bh.update(); });
  const pts = [];
  ctx.selection.forEach((o) => { const v = new THREE.Vector3(); o.updateWorldMatrix(true, false); v.setFromMatrixPosition(o.matrixWorld); pts.push(v.x, v.y, v.z); });
  originGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  originPoints.visible = pts.length > 0 && ctx.mode === 'object';
}

// ---------- الإسقاط: تبديل منظور/متعامد مع حفظ الحجم ----------
function cameraDistance() {
  return camera.position.distanceTo(orbit.target);
}

function visibleHeight() {
  if (camera.isPerspectiveCamera) return 2 * cameraDistance() * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  return ORTHO_H / camera.zoom;
}

function bindCamera(cam) {
  camera = cam;
  ctx.camera = cam;
  orbit.object = cam;
  transform.camera = cam;
  viewHelper.camera = cam;
  viewHelper.center = orbit.target;
  orbit.update();
  resize();
  bus.emit('settings');
}

export function toggleProjection() {
  const target = orbit.target.clone();
  const dir = camera.position.clone().sub(target);
  if (dir.lengthSq() < 1e-8) dir.set(0.6, 0.5, 0.8);
  dir.normalize();
  if (camera.isPerspectiveCamera) {
    const h = visibleHeight();
    ortho.position.copy(target).addScaledVector(dir, 200);
    ortho.quaternion.copy(persp.quaternion);
    ortho.zoom = ORTHO_H / Math.max(h, 1e-4);
    ortho.updateProjectionMatrix();
    bindCamera(ortho);
    toast('إسقاط متعامد (Orthographic)');
  } else {
    const h = ORTHO_H / ortho.zoom;
    const d = h / (2 * Math.tan(THREE.MathUtils.degToRad(persp.fov / 2)));
    persp.position.copy(target).addScaledVector(dir, Math.max(d, 0.05));
    persp.quaternion.copy(ortho.quaternion);
    bindCamera(persp);
    toast('إسقاط منظوري (Perspective)');
  }
}

// ---------- زوايا العرض والتأطير ----------
const viewAnim = { active: false, from: new THREE.Vector3(), to: new THREE.Vector3(), dist: 10, t: 0 };

function startViewAnim(toDir) {
  viewAnim.from.copy(camera.position).sub(orbit.target);
  viewAnim.dist = camera.isPerspectiveCamera ? Math.max(viewAnim.from.length(), 0.05) : 200;
  if (viewAnim.from.lengthSq() < 1e-8) viewAnim.from.set(0, 0, 1);
  viewAnim.from.normalize();
  viewAnim.to.copy(toDir).normalize();
  viewAnim.t = 0;
  viewAnim.active = true;
}

const VIEW_DIRS = {
  front: new THREE.Vector3(0, 0, 1), back: new THREE.Vector3(0, 0, -1),
  right: new THREE.Vector3(1, 0, 0), left: new THREE.Vector3(-1, 0, 0),
  top: new THREE.Vector3(0, 1, 0), bottom: new THREE.Vector3(0, -1, 0)
};

export function setView(name) {
  if (name === 'opposite') {
    const d = camera.position.clone().sub(orbit.target).normalize().negate();
    startViewAnim(d);
    return;
  }
  const dir = VIEW_DIRS[name];
  if (dir) startViewAnim(dir);
}

function updateViewAnim() {
  if (!viewAnim.active) return;
  viewAnim.t = Math.min(1, viewAnim.t + 0.14);
  const e = 1 - Math.pow(1 - viewAnim.t, 3);
  const q = new THREE.Quaternion().setFromUnitVectors(viewAnim.from, viewAnim.to);
  const qi = new THREE.Quaternion().slerp(q, e);
  const dir = viewAnim.from.clone().applyQuaternion(qi);
  camera.position.copy(orbit.target).addScaledVector(dir, viewAnim.dist);
  orbit.update();
  if (viewAnim.t >= 1) viewAnim.active = false;
}

export function frameBox(box) {
  if (!box || box.isEmpty()) return;
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const r = Math.max(sphere.radius, 0.05);
  const dir = camera.position.clone().sub(orbit.target);
  if (dir.lengthSq() < 1e-8) dir.set(1, 0.8, 1);
  dir.normalize();
  orbit.target.copy(sphere.center);
  if (camera.isPerspectiveCamera) {
    const d = (r / Math.sin(THREE.MathUtils.degToRad(Math.min(camera.fov, camera.fov * camera.aspect) / 2))) * 1.1;
    camera.position.copy(sphere.center).addScaledVector(dir, d);
  } else {
    camera.position.copy(sphere.center).addScaledVector(dir, 200);
    camera.zoom = ORTHO_H / (r * 2.4);
    camera.updateProjectionMatrix();
  }
  viewHelper.center = orbit.target;
  orbit.update();
}

function boxOfObjects(objs) {
  const box = new THREE.Box3();
  objs.forEach((o) => {
    o.updateWorldMatrix(true, true);
    const b = new THREE.Box3().setFromObject(o);
    if (b.isEmpty()) box.expandByPoint(new THREE.Vector3().setFromMatrixPosition(o.matrixWorld));
    else box.union(b);
  });
  return box;
}

export function frameSelected() {
  if (!ctx.selection.length) { toast('لا يوجد تحديد للتركيز عليه'); return; }
  frameBox(boxOfObjects(ctx.selection));
}
export function frameAll() {
  const objs = world.children.filter((o) => !o.userData.isLightTarget);
  if (!objs.length) { orbit.target.set(0, 0, 0); orbit.update(); return; }
  frameBox(boxOfObjects(objs));
}

// ---------- الالتقاط ----------
const raycaster = new THREE.Raycaster();
raycaster.firstHitOnly = true;
const ndc = new THREE.Vector2();

export function setRayFromClient(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  return raycaster;
}

function prepareBVH(mesh) {
  if (!bvh.loaded) return;
  const g = mesh.geometry;
  if (g.boundsTree || !g.attributes.position) return;
  const tris = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
  if (tris > 3000) { try { g.computeBoundsTree(); } catch (e) { /* يستمر بالالتقاط القياسي */ } }
}

export function collectPickables(excludeSet) {
  const list = [];
  world.traverse((o) => {
    if (o.isMesh && isEffectivelyVisible(o) && !o.userData.locked && !(excludeSet && excludeSet.has(o))) {
      prepareBVH(o);
      list.push(o);
    }
  });
  lightHelpers.forEach((entry, light) => { if (!light.userData.locked) list.push(entry.picker); });
  return list;
}

export function pickAt(clientX, clientY, excludeSet) {
  setRayFromClient(clientX, clientY);
  const hits = raycaster.intersectObjects(collectPickables(excludeSet), false);
  if (!hits.length) return null;
  const h = hits[0];
  return { object: h.object.userData.target || h.object, point: h.point, face: h.face, hit: h };
}

export function groundPoint(clientX, clientY, y = 0) {
  setRayFromClient(clientX, clientY);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
  const p = new THREE.Vector3();
  return raycaster.ray.intersectPlane(plane, p) ? p : null;
}

export function setCursor(pos) {
  cursor.position.copy(pos);
  bus.emit('cursor');
}

// ---------- الإحصائيات ----------
function geometryInfo(geo) {
  if (geo.userData._info) return geo.userData._info;
  const pos = geo.attributes.position;
  const count = pos ? pos.count : 0;
  const idx = geo.index;
  const triCount = idx ? idx.count / 3 : count / 3;
  let verts = count;
  let edges = Math.round(triCount * 1.5);
  if (pos && count <= 150000) {
    const ids = new Uint32Array(count);
    const map = new Map();
    for (let i = 0; i < count; i++) {
      const key = pos.getX(i).toFixed(4) + ',' + pos.getY(i).toFixed(4) + ',' + pos.getZ(i).toFixed(4);
      let id = map.get(key);
      if (id === undefined) { id = map.size; map.set(key, id); }
      ids[i] = id;
    }
    verts = map.size;
    const es = new Set();
    const stride = Math.max(1, map.size);
    for (let t = 0; t < triCount; t++) {
      const a = ids[idx ? idx.getX(t * 3) : t * 3];
      const b = ids[idx ? idx.getX(t * 3 + 1) : t * 3 + 1];
      const c = ids[idx ? idx.getX(t * 3 + 2) : t * 3 + 2];
      [[a, b], [b, c], [c, a]].forEach(([u, v]) => { es.add(u < v ? u * stride + v : v * stride + u); });
    }
    edges = es.size;
  }
  geo.userData._info = { verts, edges, tris: triCount };
  return geo.userData._info;
}

const statsEl = document.getElementById('stats');
let statsClock = 0;
let fpsSmooth = 60;

function updateStats(delta) {
  if (delta > 0) fpsSmooth += (1 / delta - fpsSmooth) * 0.1;
  statsClock += delta;
  if (statsClock < 0.3) return;
  statsClock = 0;
  if (!statsEl || !ctx.settings.showStats) { if (statsEl) statsEl.style.display = 'none'; return; }
  statsEl.style.display = 'block';
  let objects = 0, verts = 0, edges = 0, tris = 0;
  world.traverse((o) => {
    if (o === world || o.userData.isLightTarget) return;
    objects++;
    if (o.isMesh && o.geometry && isEffectivelyVisible(o)) {
      const info = geometryInfo(o.geometry);
      verts += info.verts; edges += info.edges; tris += info.tris;
    }
  });
  const sel = ctx.selection.length;
  statsEl.innerHTML =
    `<div><b>الكائنات</b> ${sel}/${objects}</div><div><b>الرؤوس</b> ${verts.toLocaleString()}</div>` +
    `<div><b>الحواف</b> ${edges.toLocaleString()}</div><div><b>المثلثات</b> ${Math.round(tris).toLocaleString()}</div>` +
    `<div><b>Draw Calls</b> ${renderer.info.render.calls}</div><div><b>FPS</b> ${Math.round(fpsSmooth)}</div>`;
}

// ---------- الرسم (مرحلتان: العالم ثم الطبقة المساعدة) ----------
function renderFrame(opts = {}) {
  const overlay = opts.overlay !== false;
  const bg = scene.background;
  const override = scene.overrideMaterial;
  renderer.info.reset();

  world.visible = true;
  overlayRoot.visible = false;
  renderer.autoClear = true;
  if (opts.transparent) { scene.background = null; renderer.setClearColor(0x000000, 0); }
  renderer.render(scene, camera);

  if (overlay) {
    scene.overrideMaterial = null;
    scene.background = null;
    world.visible = false;
    overlayRoot.visible = true;
    renderer.autoClear = false;
    renderer.render(scene, camera);
  }
  world.visible = true;
  overlayRoot.visible = true;
  scene.overrideMaterial = override;
  scene.background = bg;
  renderer.autoClear = true;
  if (opts.transparent) renderer.setClearColor(0x000000, 1);
}

export function snapshot(opts = {}) {
  return new Promise((resolve) => {
    const prevRatio = renderer.getPixelRatio();
    if (opts.scale) renderer.setPixelRatio(Math.max(prevRatio, opts.scale));
    renderFrame({ overlay: false, transparent: !!opts.transparent });
    renderer.domElement.toBlob((blob) => {
      renderer.setPixelRatio(prevRatio);
      resolve(blob);
    }, 'image/png');
  });
}

// ---------- تغيير الحجم ----------
function resize() {
  const w = Math.max(1, viewportEl.clientWidth);
  const h = Math.max(1, viewportEl.clientHeight);
  renderer.setSize(w, h);
  const aspect = w / h;
  persp.aspect = aspect;
  persp.updateProjectionMatrix();
  ortho.left = (-ORTHO_H / 2) * aspect;
  ortho.right = (ORTHO_H / 2) * aspect;
  ortho.top = ORTHO_H / 2;
  ortho.bottom = -ORTHO_H / 2;
  ortho.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewportEl);
window.addEventListener('resize', resize);

// ---------- الحلقة الرئيسية ----------
const timer = new THREE.Timer();
timer.connect(document);
const cursorTmp = new THREE.Vector3();

function animate(timestamp) {
  requestAnimationFrame(animate);
  timer.update(timestamp);
  const delta = timer.getDelta();

  updateViewAnim();
  if (viewHelper.animating) {
    viewHelper.update(delta);
    orbit.update();
  }
  viewHelper.center = orbit.target;

  const scale = visibleHeight() * 0.035;
  cursor.scale.setScalar(scale);
  cursor.quaternion.copy(camera.quaternion);

  const cell = Math.min(1000, Math.max(0.001, 10 ** Math.round(Math.log10(Math.max(visibleHeight(), 1e-4) / 14))));
  grid.scale.setScalar(cell);
  grid.visible = ctx.settings.showGrid;
  axisX.visible = axisZ.visible = ctx.settings.showGrid;

  scene.updateMatrixWorld(true);
  updateLightHelpers();
  updateSelectionVisuals();
  bus.emit('frame', delta);
  renderFrame();

  vhRenderer.clear();
  viewHelper.render(vhRenderer);
  updateStats(delta);
}

// ---------- كشف الحالة للوحدات الأخرى ----------
ctx.renderer = renderer;
ctx.scene = scene;
ctx.world = world;
ctx.overlay = overlayRoot;
ctx.camera = camera;
ctx.cameras = { persp, ortho };
ctx.orbit = orbit;
ctx.transform = transform;
ctx.viewHelper = viewHelper;
ctx.cursor = cursor;
ctx.history = new History();
ctx.applyShading = applyShading;
ctx.toggleProjection = toggleProjection;
ctx.setView = setView;
ctx.frameSelected = frameSelected;
ctx.frameAll = frameAll;
ctx.frameBox = frameBox;
ctx.pickAt = pickAt;
ctx.groundPoint = groundPoint;
ctx.setCursor = setCursor;
ctx.setRayFromClient = setRayFromClient;
ctx.raycaster = raycaster;
ctx.collectPickables = collectPickables;
ctx.snapshot = snapshot;
ctx.invalidateBVH = invalidateBVH;
ctx.isEffectivelyVisible = isEffectivelyVisible;
ctx.visibleHeight = visibleHeight;
ctx.geometryInfo = geometryInfo;
ctx.envTexture = envTexture;
ctx.bvh = bvh;

applyShading();
resize();
requestAnimationFrame(animate);
