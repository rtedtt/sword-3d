// editor-ui.js — القوائم، المنظم (Outliner)، السجل، محرر الخصائص والخامات والإضاءة،
// اختصارات لوحة المفاتيح، شريط اللمس
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { ctx, bus, toast, $, $$, escapeHtml, storageGet, storageSet, fmt } from './editor-state.js';
import {
  FnCommand, StateCommand, MultiCommand, ReparentCommand, RemoveObjectsCommand,
  setSelection, snapshotTRS, trsEqual
} from './editor-history.js';
import * as ops from './editor-ops.js';
import { PRESET_NAMES_AR } from './presets.js';
import { PRIMITIVE_KEYS } from './editor-ops.js';

const rad = THREE.MathUtils.degToRad;
const deg = THREE.MathUtils.radToDeg;
const mousePos = { x: 200, y: 200 };
window.addEventListener('pointermove', (e) => { mousePos.x = e.clientX; mousePos.y = e.clientY; });

// =====================================================================
// القوائم المنسدلة
// =====================================================================
let openMenus = [];

function closeMenus(from = 0) {
  while (openMenus.length > from) openMenus.pop().remove();
  if (from === 0) $$('#menubar button.open').forEach((b) => b.classList.remove('open'));
}

function buildMenu(items, x, y, level = 0) {
  closeMenus(level);
  const m = document.createElement('div');
  m.className = 'menu';
  items.forEach((it) => {
    if (it === '-') { const s = document.createElement('div'); s.className = 'msep'; m.appendChild(s); return; }
    const row = document.createElement('div');
    row.className = 'mi' + (it.disabled ? ' dis' : '');
    row.innerHTML = '<span>' + escapeHtml(it.label) + (it.sub ? ' ◂' : '') + '</span><span class="key">' + escapeHtml(it.key || '') + '</span>';
    if (it.sub) {
      row.addEventListener('mouseenter', () => {
        const r = row.getBoundingClientRect();
        buildMenu(it.sub, r.left, r.top, level + 1);
      });
    } else {
      row.addEventListener('mouseenter', () => closeMenus(level + 1));
      row.addEventListener('click', () => { closeMenus(); it.action(); });
    }
    m.appendChild(row);
  });
  document.body.appendChild(m);
  const w = m.offsetWidth, h = m.offsetHeight;
  let left = level > 0 ? x - w : x;
  if (left < 4) left = level > 0 ? x + 190 : 4;
  if (left + w > window.innerWidth - 4) left = window.innerWidth - w - 4;
  let top = y;
  if (top + h > window.innerHeight - 4) top = Math.max(4, window.innerHeight - h - 4);
  m.style.left = left + 'px';
  m.style.top = top + 'px';
  openMenus[level] = m;
}

export function showMenu(items, x, y) { buildMenu(items, x, y, 0); }

document.addEventListener('pointerdown', (e) => {
  if (openMenus.length && !e.target.closest('.menu') && !e.target.closest('#menubar button')) closeMenus();
}, true);

const axisMenu = (fn) => ['x', 'y', 'z'].map((a) => ({ label: 'المحور ' + a.toUpperCase(), action: () => fn(a) }));

function addMenuItems() {
  const prims = PRIMITIVE_KEYS.map((p) => ({ label: p.label, action: () => ops.addPrimitive(p.key) }));
  const lights = [
    { label: 'شمس (Directional)', action: () => ops.addLight('sun') },
    { label: 'نقطة (Point)', action: () => ops.addLight('point') },
    { label: 'مسلّط (Spot)', action: () => ops.addLight('spot') },
    { label: 'نصف كروي (Hemisphere)', action: () => ops.addLight('hemi') }
  ];
  const group = (kind, label, keys) => ({ label, sub: keys.map((k) => ({ label: PRESET_NAMES_AR[k] || k, action: () => ops.addPreset(kind, k) })) });
  return [
    { label: 'شبكة (Mesh)', sub: prims },
    { label: 'ضوء (Light)', sub: lights },
    { label: 'مجموعة فارغة', action: () => ops.addEmpty() },
    '-',
    {
      label: 'المجسمات الجاهزة (Preset Models)', sub: [
        group('buildings', '🏛️ المباني', ['cottage', 'shop', 'villa', 'palace']),
        group('weapons', '⚔️ الأسلحة والأدوات', ['sword', 'bow', 'staff', 'hammer', 'daggers', 'axe', 'pickaxe', 'shield', 'fishingRod', 'wateringCan', 'shovel']),
        group('accessories', '👑 الإكسسوارات', ['crown', 'helmet', 'backpack', 'fountain', 'amulet', 'chalice'])
      ]
    }
  ];
}

function objectMenuItems() {
  return [
    { label: 'نسخ مستقل', key: 'Shift+D', action: () => ops.duplicateSelected(false, true) },
    { label: 'نسخ مرتبط الهندسة', key: 'Alt+D', action: () => ops.duplicateSelected(true, true) },
    { label: 'حذف', key: 'X', action: () => ops.deleteSelected() },
    '-',
    { label: 'دمج (Join)', key: 'Ctrl+J', action: () => ops.joinSelected() },
    { label: 'فصل (Separate)', key: 'P', sub: [
      { label: 'حسب الأجزاء المنفصلة', action: () => ops.separateSelected('loose') },
      { label: 'حسب الخامة', action: () => ops.separateSelected('material') }
    ] },
    { label: 'تجميع (Group)', key: 'Ctrl+G', action: () => ops.groupSelected() },
    { label: 'فك الربط الأبوي', key: 'Alt+P', action: () => ops.clearParent() },
    '-',
    { label: 'عكس / مرآة', key: 'Ctrl+M', sub: axisMenu((a) => ops.mirrorSelected(a)) },
    { label: 'تطبيق التحويلات', key: 'Ctrl+A', sub: applyMenuItems() },
    { label: 'نقل نقطة الأصل', sub: [
      { label: 'الأصل إلى الهندسة', action: () => ops.originToGeometry() },
      { label: 'الهندسة إلى الأصل', action: () => ops.geometryToOrigin() },
      { label: 'الأصل إلى المؤشر 3D', action: () => ops.originToCursor() }
    ] },
    '-',
    { label: 'إخفاء', key: 'H', action: () => ops.hideSelected() },
    { label: 'إظهار الكل', key: 'Alt+H', action: () => ops.showAll() },
    { label: 'عزل التحديد', key: '/', action: () => ops.toggleIsolate() },
    '-',
    { label: 'المؤشر 3D', key: 'Shift+S', sub: snapMenuItems() },
    { label: 'فك المجسم الجاهز إلى أجزاء', action: () => breakApart() },
    { label: 'دمج المجسم الجاهز في شبكة واحدة', action: () => mergeGroupToMesh() }
  ];
}

function applyMenuItems() {
  return [
    { label: 'الموضع', action: () => ops.applyTransforms({ loc: true }) },
    { label: 'الدوران', action: () => ops.applyTransforms({ rot: true }) },
    { label: 'التحجيم', action: () => ops.applyTransforms({ scl: true }) },
    { label: 'كل التحويلات', action: () => ops.applyTransforms({ loc: true, rot: true, scl: true }) }
  ];
}

function snapMenuItems() {
  return [
    { label: 'المؤشر إلى التحديد', action: () => ops.cursorToSelected() },
    { label: 'المؤشر إلى أصل العالم', action: () => ops.cursorToWorldOrigin() },
    { label: 'التحديد إلى المؤشر', action: () => ops.selectionToCursor() }
  ];
}

function viewMenuItems() {
  const shade = (m, label, key) => ({ label, key, action: () => setShading(m) });
  return [
    { label: 'تبديل منظور / متعامد', key: '5', action: () => ctx.toggleProjection() },
    '-',
    { label: 'أمامي', key: 'Numpad 1', action: () => ctx.setView('front') },
    { label: 'يمين', key: 'Numpad 3', action: () => ctx.setView('right') },
    { label: 'علوي', key: 'Numpad 7', action: () => ctx.setView('top') },
    { label: 'خلفي', key: 'Ctrl+Numpad 1', action: () => ctx.setView('back') },
    { label: 'يسار', key: 'Ctrl+Numpad 3', action: () => ctx.setView('left') },
    { label: 'سفلي', key: 'Ctrl+Numpad 7', action: () => ctx.setView('bottom') },
    { label: 'عكس الجهة', key: 'Numpad 9', action: () => ctx.setView('opposite') },
    '-',
    { label: 'التركيز على المحدد', key: 'F / Numpad .', action: () => ctx.frameSelected() },
    { label: 'احتواء المشهد', key: 'Home', action: () => ctx.frameAll() },
    '-',
    shade('wire', 'سلكي (Wireframe)', ''),
    shade('solid', 'Solid / Clay', ''),
    shade('preview', 'Material Preview', ''),
    shade('rendered', 'Rendered (ظلال حقيقية)', 'Z'),
    { label: 'X-Ray', key: 'Alt+Z', action: () => toggleXray() },
    '-',
    { label: 'إظهار / إخفاء الشبكة', action: () => { ctx.settings.showGrid = !ctx.settings.showGrid; } },
    { label: 'إظهار / إخفاء الإحصائيات', action: () => { ctx.settings.showStats = !ctx.settings.showStats; } }
  ];
}

function menuDefs() {
  return {
    file: [
      { label: 'جديد', action: () => bus.emit('io', { action: 'new' }) },
      { label: 'استيراد… (glb / gltf / obj / stl / json)', key: 'Ctrl+O', action: () => bus.emit('io', { action: 'import' }) },
      '-',
      { label: 'حفظ مشروع (.json)', key: 'Ctrl+S', action: () => bus.emit('io', { action: 'save-project' }) },
      { label: 'تصدير GLB', action: () => bus.emit('io', { action: 'export-glb' }) },
      { label: 'تصدير glTF', action: () => bus.emit('io', { action: 'export-gltf' }) },
      { label: 'تصدير OBJ', action: () => bus.emit('io', { action: 'export-obj' }) },
      { label: 'تصدير STL', action: () => bus.emit('io', { action: 'export-stl' }) },
      '-',
      { label: 'لقطة PNG (خلفية شفافة)', action: () => bus.emit('io', { action: 'snapshot', transparent: true }) },
      { label: 'لقطة PNG (خلفية استوديو)', action: () => bus.emit('io', { action: 'snapshot', transparent: false }) }
    ],
    edit: [
      { label: 'تراجع', key: 'Ctrl+Z', action: () => ctx.history.undo() },
      { label: 'إعادة', key: 'Ctrl+Shift+Z', action: () => ctx.history.redo() },
      '-',
      { label: 'تحديد الكل', key: 'A', action: () => ops.selectAll() },
      { label: 'إلغاء التحديد', key: 'Alt+A', action: () => ops.selectNone() },
      { label: 'عكس التحديد', key: 'Ctrl+I', action: () => ops.selectInvert() },
      { label: 'تحديد الأب', key: '[', action: () => ops.selectParent() },
      { label: 'تحديد الأبناء', key: ']', action: () => ops.selectChildren() },
      '-',
      { label: 'إعادة تسمية', key: 'F2', action: () => startRename(ctx.active) }
    ],
    add: addMenuItems(),
    view: viewMenuItems(),
    object: objectMenuItems(),
    help: [
      { label: 'اختصارات الأساسية', action: () => toast('G/R/S تحويل + X/Y/Z محور + رقم · Shift+D نسخ · Ctrl+J دمج · Z تظليل · 5 منظور · Numpad 1/3/7 زوايا · F تركيز', 7000) },
      { label: 'العودة إلى الموقع', action: () => { window.location.href = 'index.html'; } }
    ]
  };
}

$$('#menubar button[data-menu]').forEach((b) => {
  b.addEventListener('click', () => {
    const isOpen = b.classList.contains('open');
    closeMenus();
    if (isOpen) return;
    b.classList.add('open');
    const r = b.getBoundingClientRect();
    buildMenu(menuDefs()[b.dataset.menu], r.left, r.bottom, 0);
  });
});
$('#home-link').addEventListener('click', () => { window.location.href = 'index.html'; });
$('#side-toggle').addEventListener('click', () => document.body.classList.toggle('side-open'));

// =====================================================================
// أدوات النموذج (Form helpers)
// =====================================================================
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}
function section(title) {
  const s = el('div', 'sec');
  s.appendChild(el('h4', '', escapeHtml(title)));
  const body = el('div');
  s.appendChild(body);
  return { root: s, body };
}
function frow(label, ...controls) {
  const r = el('div', 'frow');
  r.appendChild(el('label', '', escapeHtml(label)));
  const box = el('div');
  controls.forEach((c) => box.appendChild(c));
  r.appendChild(box);
  return r;
}
function button(label, onClick, cls = '') {
  const b = el('button', cls, escapeHtml(label));
  b.addEventListener('click', onClick);
  return b;
}
function note(text) { return el('div', 'note', escapeHtml(text)); }

function numInput(value, onCommit, opts = {}) {
  const i = document.createElement('input');
  i.type = 'number';
  i.step = opts.step ?? 0.1;
  if (opts.min !== undefined) i.min = opts.min;
  if (opts.max !== undefined) i.max = opts.max;
  i.value = fmt(value, opts.digits ?? 4);
  i.addEventListener('change', () => {
    const v = parseFloat(i.value);
    if (Number.isFinite(v)) onCommit(v);
    else i.value = fmt(value, opts.digits ?? 4);
  });
  i.addEventListener('keydown', (e) => e.stopPropagation());
  return i;
}

function textInput(value, onCommit) {
  const i = document.createElement('input');
  i.type = 'text';
  i.value = value;
  i.style.width = '100%';
  i.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') i.blur(); });
  i.addEventListener('change', () => onCommit(i.value));
  return i;
}

function checkbox(value, onChange) {
  const i = document.createElement('input');
  i.type = 'checkbox';
  i.checked = !!value;
  i.addEventListener('change', () => onChange(i.checked));
  return i;
}

function selectInput(options, value, onChange) {
  const s = document.createElement('select');
  s.style.width = '100%';
  options.forEach(([v, label]) => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = label;
    if (String(v) === String(value)) o.selected = true;
    s.appendChild(o);
  });
  s.addEventListener('change', () => onChange(s.value));
  return s;
}

// منزلق بمعاينة حية وأمر تراجع واحد عند الإفلات
function liveRange(get, apply, min, max, step, label) {
  const wrap = el('div');
  wrap.style.cssText = 'display:grid;grid-template-columns:1fr 54px;gap:6px;align-items:center';
  const r = document.createElement('input');
  r.type = 'range'; r.min = min; r.max = max; r.step = step; r.value = get();
  const n = document.createElement('input');
  n.type = 'number'; n.step = step; n.value = fmt(get(), 3);
  let old = null;
  r.addEventListener('input', () => { if (old === null) old = get(); apply(parseFloat(r.value)); n.value = fmt(parseFloat(r.value), 3); });
  r.addEventListener('change', () => {
    const nv = parseFloat(r.value);
    const ov = old === null ? get() : old;
    old = null;
    apply(ov);
    ctx.history.execute(new FnCommand(label, () => apply(nv), () => apply(ov)));
  });
  n.addEventListener('keydown', (e) => e.stopPropagation());
  n.addEventListener('change', () => {
    const nv = parseFloat(n.value);
    if (!Number.isFinite(nv)) return;
    const ov = get();
    ctx.history.execute(new FnCommand(label, () => apply(nv), () => apply(ov)));
    r.value = nv;
  });
  wrap.append(r, n);
  return wrap;
}

function liveColor(getHex, apply, label) {
  const c = document.createElement('input');
  c.type = 'color';
  c.value = getHex();
  let old = null;
  c.addEventListener('input', () => { if (old === null) old = getHex(); apply(c.value); });
  c.addEventListener('change', () => {
    const nv = c.value;
    const ov = old === null ? getHex() : old;
    old = null;
    apply(ov);
    ctx.history.execute(new FnCommand(label, () => apply(nv), () => apply(ov)));
  });
  return c;
}

// =====================================================================
// تغييرات الكائنات
// =====================================================================
function commitTRS(obj, mutate, label = 'تحويل') {
  const before = snapshotTRS(obj);
  const after = snapshotTRS(obj);
  mutate(after);
  if (trsEqual(before, after)) return;
  ctx.history.execute(new StateCommand(label, [{ obj, before, after }]));
}

function renameObject(obj, name) {
  const nv = name.trim();
  if (!obj || !nv || nv === obj.name) return;
  const ov = obj.name;
  ctx.history.execute(new FnCommand('إعادة تسمية', () => { obj.name = nv; }, () => { obj.name = ov; }));
}

function startRename(obj) {
  if (!obj) return;
  const row = $('#outliner .orow[data-uuid="' + obj.uuid + '"] .name');
  if (!row) return;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = obj.name;
  row.innerHTML = '';
  row.appendChild(input);
  input.focus();
  input.select();
  const done = (commit) => { if (commit) renameObject(obj, input.value); scheduleOutliner(); };
  input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') done(true); else if (e.key === 'Escape') done(false); });
  input.addEventListener('blur', () => done(true));
}

function toggleVisible(obj) {
  const ov = obj.visible;
  ctx.history.execute(new FnCommand(ov ? 'إخفاء' : 'إظهار', () => { obj.visible = !ov; }, () => { obj.visible = ov; }));
}
function toggleLock(obj) {
  const ov = !!obj.userData.locked;
  ctx.history.execute(new FnCommand(ov ? 'فتح القفل' : 'قفل التحديد', () => { obj.userData.locked = !ov; }, () => { obj.userData.locked = ov; }));
}

function breakApart() {
  const groups = ctx.selection.filter((o) => !o.isMesh && !o.isLight && o.children.length);
  if (!groups.length) { toast('حدد مجموعة / مجسماً جاهزاً لفكه'); return; }
  ctx.history.batch('فك المجسم إلى أجزاء', () => {
    const released = [];
    groups.forEach((g) => {
      const parent = g.parent || ctx.world;
      [...g.children].filter((c) => !c.userData.isLightTarget).forEach((c) => {
        ctx.history.execute(new ReparentCommand(c, parent, parent.children.length));
        released.push(c);
      });
      ctx.history.execute(new RemoveObjectsCommand([g]));
    });
    setSelection(released);
  });
  toast('تم فك المجسم إلى أجزاء مستقلة في المنظم');
}

function mergeGroupToMesh() {
  const group = ctx.selection.find((o) => !o.isMesh && !o.isLight);
  if (!group) { toast('حدد مجموعة / مجسماً جاهزاً لدمجه'); return; }
  const meshes = [];
  group.traverse((o) => { if (o.isMesh) meshes.push(o); });
  if (!meshes.length) { toast('لا توجد شبكات داخل المجموعة'); return; }
  ctx.history.batch('تحويل إلى شبكة واحدة', () => {
    setSelection(meshes, meshes[0]);
    if (meshes.length > 1) ops.joinSelected();
    const target = meshes[0];
    const parent = group.parent || ctx.world;
    ctx.history.execute(new ReparentCommand(target, parent, parent.children.length));
    ctx.history.execute(new FnCommand('تسمية', () => { target.name = group.name; }, () => { target.name = 'Mesh'; }));
    ctx.history.execute(new RemoveObjectsCommand([group]));
    setSelection([target], target);
  });
  toast('تم تحويل المجسم إلى شبكة واحدة قابلة للتعديل');
}

// =====================================================================
// المنظم (Outliner)
// =====================================================================
const collapsed = new WeakSet();
let outFilter = '';
let dragged = null;
let outlinerQueued = false;

function scheduleOutliner() {
  if (outlinerQueued) return;
  outlinerQueued = true;
  requestAnimationFrame(() => { outlinerQueued = false; renderOutliner(); });
}

function iconOf(o) {
  if (o.isDirectionalLight) return '☀️';
  if (o.isPointLight) return '💡';
  if (o.isSpotLight) return '🔦';
  if (o.isHemisphereLight) return '🌗';
  if (o.isMesh) return '🔷';
  return '📁';
}

function subtreeMatches(o, q) {
  if (o.name.toLowerCase().includes(q)) return true;
  return o.children.some((c) => !c.userData.isLightTarget && subtreeMatches(c, q));
}

function isDescendant(node, ancestor) {
  for (let p = node; p; p = p.parent) if (p === ancestor) return true;
  return false;
}

function makeRow(obj, depth, hasKids) {
  const row = el('div', 'orow');
  row.dataset.uuid = obj.uuid;
  row.draggable = true;
  if (ctx.selection.includes(obj)) row.classList.add('sel');
  if (ctx.active === obj) row.classList.add('act');
  row.style.paddingRight = 6 + depth * 14 + 'px';
  const arrow = el('span', 'arrow', hasKids ? (collapsed.has(obj) ? '▸' : '▾') : '');
  arrow.addEventListener('click', (e) => { e.stopPropagation(); if (collapsed.has(obj)) collapsed.delete(obj); else collapsed.add(obj); scheduleOutliner(); });
  const name = el('span', 'name', iconOf(obj) + ' ' + escapeHtml(obj.name));
  const eye = el('span', 'tog' + (obj.visible ? '' : ' off'), obj.visible ? '👁' : '🚫');
  eye.title = 'إخفاء / إظهار';
  eye.addEventListener('click', (e) => { e.stopPropagation(); toggleVisible(obj); });
  const lock = el('span', 'tog' + (obj.userData.locked ? '' : ' off'), obj.userData.locked ? '🔒' : '🔓');
  lock.title = 'قفل التحديد';
  lock.addEventListener('click', (e) => { e.stopPropagation(); toggleLock(obj); });
  row.append(arrow, name, eye, lock);

  row.addEventListener('click', (e) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      if (ctx.selection.includes(obj)) setSelection(ctx.selection.filter((x) => x !== obj));
      else setSelection([...ctx.selection, obj], obj);
    } else setSelection([obj], obj);
  });
  row.addEventListener('dblclick', (e) => { e.stopPropagation(); startRename(obj); });

  row.addEventListener('dragstart', (e) => { dragged = obj; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', obj.uuid); } catch (err) { /* بعض المتصفحات */ } });
  row.addEventListener('dragend', () => { dragged = null; $$('.orow').forEach((r) => r.classList.remove('dropin', 'dropbefore', 'dropafter')); });
  row.addEventListener('dragover', (e) => {
    if (!dragged || dragged === obj || isDescendant(obj, dragged)) return;
    e.preventDefault();
    const r = row.getBoundingClientRect();
    const f = (e.clientY - r.top) / r.height;
    row.classList.remove('dropin', 'dropbefore', 'dropafter');
    row.classList.add(f < 0.25 ? 'dropbefore' : f > 0.75 ? 'dropafter' : 'dropin');
  });
  row.addEventListener('dragleave', () => row.classList.remove('dropin', 'dropbefore', 'dropafter'));
  row.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragged || dragged === obj || isDescendant(obj, dragged)) return;
    const r = row.getBoundingClientRect();
    const f = (e.clientY - r.top) / r.height;
    const d = dragged;
    dragged = null;
    if (f >= 0.25 && f <= 0.75) {
      ctx.history.execute(new ReparentCommand(d, obj, obj.children.filter((c) => c !== d).length));
    } else {
      const parent = obj.parent || ctx.world;
      const sibs = parent.children.filter((c) => c !== d);
      const idx = sibs.indexOf(obj) + (f > 0.75 ? 1 : 0);
      ctx.history.execute(new ReparentCommand(d, parent, idx));
    }
  });
  return row;
}

function renderOutliner() {
  const root = $('#outliner');
  const q = outFilter.trim().toLowerCase();
  root.innerHTML = '';
  const walk = (parent, depth) => {
    parent.children.forEach((c) => {
      if (c.userData.isLightTarget) return;
      if (q && !subtreeMatches(c, q)) return;
      const kids = c.children.filter((k) => !k.userData.isLightTarget);
      root.appendChild(makeRow(c, depth, kids.length > 0));
      if (kids.length && (q || !collapsed.has(c))) walk(c, depth + 1);
    });
  };
  walk(ctx.world, 0);
  if (!root.children.length) root.appendChild(note(q ? 'لا نتائج' : 'المشهد فارغ — استخدم إضافة ← المجسمات الجاهزة'));
}

$('#outliner').addEventListener('dragover', (e) => { if (dragged) e.preventDefault(); });
$('#outliner').addEventListener('drop', (e) => {
  if (!dragged) return;
  e.preventDefault();
  const d = dragged;
  dragged = null;
  ctx.history.execute(new ReparentCommand(d, ctx.world, ctx.world.children.filter((c) => c !== d).length));
});
$('#outliner-search').addEventListener('input', (e) => { outFilter = e.target.value; scheduleOutliner(); });
$('#outliner-search').addEventListener('keydown', (e) => e.stopPropagation());
$('#tab-outliner').addEventListener('click', () => { $('#outliner').style.display = ''; $('#history').style.display = 'none'; $('#tab-outliner').classList.add('active'); $('#tab-history').classList.remove('active'); });
$('#tab-history').addEventListener('click', () => { $('#outliner').style.display = 'none'; $('#history').style.display = ''; $('#tab-history').classList.add('active'); $('#tab-outliner').classList.remove('active'); renderHistory(); });

function renderHistory() {
  const box = $('#history');
  box.innerHTML = '';
  const undos = ctx.history.undos;
  const redos = [...ctx.history.redos].reverse();
  const base = el('div', 'hrow' + (undos.length === 0 ? ' cur' : ''), '⟲ البداية');
  base.addEventListener('click', () => ctx.history.goto(0));
  box.appendChild(base);
  [...undos, ...redos].forEach((cmd, i) => {
    const r = el('div', 'hrow' + (i === undos.length - 1 ? ' cur' : '') + (i >= undos.length ? ' redo' : ''), escapeHtml(cmd.name));
    r.addEventListener('click', () => ctx.history.goto(i + 1));
    box.appendChild(r);
  });
}

// =====================================================================
// الخامات: أدوات
// =====================================================================
function matListOf(mesh) { return Array.isArray(mesh.material) ? mesh.material : [mesh.material]; }

function replaceMaterialEverywhere(oldMat, newMat, label) {
  const entries = [];
  ctx.world.traverse((o) => {
    if (!o.isMesh) return;
    const list = matListOf(o);
    if (!list.includes(oldMat)) return;
    const before = snapshotTRS(o);
    const after = snapshotTRS(o);
    after.mat = Array.isArray(o.material) ? list.map((m) => (m === oldMat ? newMat : m)) : newMat;
    entries.push({ obj: o, before, after });
  });
  if (entries.length) ctx.history.execute(new StateCommand(label, entries));
}

function ensurePhysical(mesh, slot) {
  const m = matListOf(mesh)[slot];
  if (m.isMeshPhysicalMaterial) return m;
  const phys = new THREE.MeshPhysicalMaterial();
  THREE.MeshStandardMaterial.prototype.copy.call(phys, m);
  phys.name = m.name;
  replaceMaterialEverywhere(m, phys, 'ترقية الخامة إلى Physical');
  return phys;
}

function makeWoodTexture(base, dark) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * 512;
    g.strokeStyle = dark;
    g.globalAlpha = 0.05 + Math.random() * 0.16;
    g.lineWidth = 0.6 + Math.random() * 2.2;
    g.beginPath();
    g.moveTo(x, 0);
    for (let y = 0; y <= 512; y += 32) g.lineTo(x + Math.sin(y * 0.02 + i) * 4 + (Math.random() - 0.5) * 2, y);
    g.stroke();
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeNoiseTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const img = g.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) { const v = 110 + Math.random() * 90; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  return t;
}

const MAT_KEYS = ['color', 'metalness', 'roughness', 'ior', 'transmission', 'thickness', 'clearcoat', 'clearcoatRoughness', 'sheen', 'emissive', 'emissiveIntensity', 'opacity', 'transparent', 'map', 'bumpMap', 'bumpScale', 'side'];

function snapMat(m) {
  const s = {};
  MAT_KEYS.forEach((k) => { if (k in m) s[k] = m[k] && m[k].isColor ? m[k].clone() : m[k]; });
  return s;
}
function restoreMat(m, s) {
  Object.keys(s).forEach((k) => { if (m[k] && m[k].isColor) m[k].copy(s[k]); else m[k] = s[k]; });
  m.needsUpdate = true;
}

const MAT_PRESETS = {
  steel: ['فولاذ مصقول', () => ({ color: new THREE.Color('#d6dae0'), metalness: 1, roughness: 0.2, map: null, bumpMap: null })],
  iron: ['حديد داكن مطروق', () => ({ color: new THREE.Color('#3a3d42'), metalness: 0.92, roughness: 0.55, map: null, bumpMap: makeNoiseTexture(), bumpScale: 0.6 })],
  oak: ['خشب بلوط', () => ({ color: new THREE.Color('#ffffff'), metalness: 0, roughness: 0.7, map: makeWoodTexture('#b0773a', '#5b3a17'), bumpMap: null })],
  walnut: ['خشب جوز', () => ({ color: new THREE.Color('#ffffff'), metalness: 0, roughness: 0.62, map: makeWoodTexture('#5a3a22', '#24140a'), bumpMap: null })],
  gold: ['ذهب', () => ({ color: new THREE.Color('#ffd166'), metalness: 1, roughness: 0.2, map: null, bumpMap: null })],
  copper: ['نحاس', () => ({ color: new THREE.Color('#b87333'), metalness: 1, roughness: 0.3, map: null, bumpMap: null })],
  glass: ['زجاج', () => ({ color: new THREE.Color('#ffffff'), metalness: 0, roughness: 0.05, transmission: 1, ior: 1.5, thickness: 0.5, map: null, bumpMap: null })],
  plastic: ['بلاستيك', () => ({ color: new THREE.Color('#3b82f6'), metalness: 0, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2, map: null, bumpMap: null })],
  clay: ['طين نحت', () => ({ color: new THREE.Color('#b9a08a'), metalness: 0, roughness: 0.92, map: null, bumpMap: null })]
};

function applyMatPreset(mesh, slot, key) {
  const m = ensurePhysical(mesh, slot);
  const target = matListOf(mesh)[slot] === m ? m : matListOf(mesh)[slot];
  const live = target.isMeshPhysicalMaterial ? target : m;
  const before = snapMat(live);
  const props = MAT_PRESETS[key][1]();
  const after = { ...before };
  Object.keys(props).forEach((k) => { after[k] = props[k]; });
  if (props.transmission === undefined) { after.transmission = 0; after.clearcoat = props.clearcoat ?? 0; }
  ctx.history.execute(new FnCommand('خامة: ' + MAT_PRESETS[key][0], () => restoreMat(live, after), () => restoreMat(live, before)));
}

function pickTexture(cb) {
  const input = $('#file-texture');
  input.value = '';
  input.onchange = () => {
    const f = input.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      new THREE.TextureLoader().load(reader.result, (tex) => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.name = f.name;
        cb(tex);
      });
    };
    reader.readAsDataURL(f);
  };
  input.click();
}

function setTextureSlot(mat, key, tex) {
  const old = mat[key];
  ctx.history.execute(new FnCommand('خريطة: ' + key, () => { mat[key] = tex; mat.needsUpdate = true; }, () => { mat[key] = old; mat.needsUpdate = true; }));
}

function setTexTransform(tex, prop, x, y) {
  const o = tex[prop].clone();
  const n = new THREE.Vector2(x, y);
  ctx.history.execute(new FnCommand('خريطة: ' + prop, () => tex[prop].copy(n), () => tex[prop].copy(o)));
}

function slotEntries(mesh, newMats, newGeo) {
  const before = snapshotTRS(mesh);
  const after = snapshotTRS(mesh);
  after.mat = newMats.length === 1 ? newMats[0] : newMats;
  after.geo = newGeo;
  return [{ obj: mesh, before, after }];
}

function addSlot(mesh) {
  const list = matListOf(mesh);
  const g = mesh.geometry.clone();
  delete g.userData._info;
  const count = g.index ? g.index.count : g.attributes.position.count;
  if (!g.groups.length) { g.clearGroups(); g.addGroup(0, count, 0); }
  const nm = ops.defaultMaterial();
  nm.name = 'Material.' + String(list.length).padStart(3, '0');
  ctx.history.execute(new StateCommand('إضافة خانة خامة', slotEntries(mesh, [...list, nm], g)));
  uiState.slot = list.length;
}

function removeSlot(mesh, idx) {
  const list = matListOf(mesh);
  if (list.length < 2) return;
  const g = mesh.geometry.clone();
  delete g.userData._info;
  const newList = list.filter((_, i) => i !== idx);
  const groups = g.groups.map((gr) => ({ start: gr.start, count: gr.count, materialIndex: gr.materialIndex === idx ? Math.max(0, idx - 1) : gr.materialIndex > idx ? gr.materialIndex - 1 : gr.materialIndex }));
  g.clearGroups();
  if (newList.length > 1) groups.forEach((gr) => g.addGroup(gr.start, gr.count, gr.materialIndex));
  ctx.history.execute(new StateCommand('حذف خانة خامة', slotEntries(mesh, newList, g)));
  uiState.slot = 0;
}

// =====================================================================
// محرر الخصائص
// =====================================================================
const uiState = { tab: storageGet('studio.tab') || 'transform', slot: 0 };
let transformFields = null;

function geometryEditAll(label, fn) {
  const meshes = ctx.selection.filter((o) => o.isMesh);
  if (!meshes.length) { toast('حدد شبكة أولاً'); return; }
  const entries = [];
  meshes.forEach((m) => {
    const before = snapshotTRS(m);
    const ng = fn(m.geometry.clone(), m);
    if (!ng) return;
    delete ng.userData._info;
    const after = snapshotTRS(m);
    after.geo = ng;
    entries.push({ obj: m, before, after });
  });
  if (entries.length) ctx.history.execute(new StateCommand(label, entries));
}

function smoothNormals(g) {
  const pos = g.attributes.position;
  const idx = g.index;
  const keyOf = (i) => pos.getX(i).toFixed(5) + ',' + pos.getY(i).toFixed(5) + ',' + pos.getZ(i).toFixed(5);
  const keys = new Array(pos.count);
  for (let i = 0; i < pos.count; i++) keys[i] = keyOf(i);
  const acc = new Map();
  const triCount = idx ? idx.count / 3 : pos.count / 3;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < triCount; t++) {
    const ia = idx ? idx.getX(t * 3) : t * 3, ib = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, ic = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    a.fromBufferAttribute(pos, ia); b.fromBufferAttribute(pos, ib); c.fromBufferAttribute(pos, ic);
    const n = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
    [ia, ib, ic].forEach((i) => {
      const k = keys[i];
      if (!acc.has(k)) acc.set(k, new THREE.Vector3());
      acc.get(k).add(n);
    });
  }
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const n = acc.get(keys[i]).clone().normalize();
    out[i * 3] = n.x; out[i * 3 + 1] = n.y; out[i * 3 + 2] = n.z;
  }
  g.setAttribute('normal', new THREE.BufferAttribute(out, 3));
  return g;
}

const tabs = {
  transform(c) {
    const o = ctx.active;
    transformFields = null;
    if (!o) { c.appendChild(note('لا يوجد كائن نشط. انقر كائناً في النافذة أو المنظم.')); return; }
    const s1 = section('الكائن');
    s1.body.appendChild(frow('الاسم', textInput(o.name, (v) => renameObject(o, v))));
    s1.body.appendChild(frow('النوع', el('span', '', escapeHtml(o.type + (o.userData.preset ? ' · ' + o.userData.preset.key : '')))));
    s1.body.appendChild(frow('الأب', el('span', '', escapeHtml(o.parent && o.parent !== ctx.world ? o.parent.name : 'Scene Collection'))));
    c.appendChild(s1.root);

    const s2 = section('التحويل (Transform)');
    const fields = { p: [], r: [], s: [] };
    const trio = (key, getter, setter, step) => {
      const t = el('div', 'trio');
      ['x', 'y', 'z'].forEach((ax) => {
        const i = numInput(getter(ax), (v) => setter(ax, v), { step });
        fields[key].push([i, ax, getter]);
        t.appendChild(i);
      });
      return t;
    };
    s2.body.appendChild(frow('الموضع', trio('p', (ax) => o.position[ax], (ax, v) => commitTRS(o, (a) => { a.p[ax] = v; }), 0.1)));
    s2.body.appendChild(frow('الدوران °', trio('r', (ax) => deg(o.rotation[ax]), (ax, v) => commitTRS(o, (a) => { const e = o.rotation.clone(); e[ax] = rad(v); a.q.setFromEuler(e); }), 5)));
    s2.body.appendChild(frow('التحجيم', trio('s', (ax) => o.scale[ax], (ax, v) => commitTRS(o, (a) => { a.s[ax] = v; }), 0.1)));
    transformFields = fields;
    c.appendChild(s2.root);

    const s3 = section('العرض');
    s3.body.appendChild(frow('ظاهر', checkbox(o.visible, () => toggleVisible(o))));
    s3.body.appendChild(frow('مقفل', checkbox(o.userData.locked, () => toggleLock(o))));
    if (o.isMesh) {
      s3.body.appendChild(frow('يلقي ظلاً', checkbox(o.castShadow, (v) => { const ov = o.castShadow; ctx.history.execute(new FnCommand('ظل', () => { o.castShadow = v; }, () => { o.castShadow = ov; })); })));
      s3.body.appendChild(frow('يستقبل ظلاً', checkbox(o.receiveShadow, (v) => { const ov = o.receiveShadow; ctx.history.execute(new FnCommand('ظل', () => { o.receiveShadow = v; }, () => { o.receiveShadow = ov; })); })));
    }
    c.appendChild(s3.root);

    const s4 = section('نقطة الأصل والمؤشر');
    const r = el('div', 'btnrow');
    r.append(button('الأصل ← الهندسة', () => ops.originToGeometry()), button('الهندسة ← الأصل', () => ops.geometryToOrigin()), button('الأصل ← المؤشر', () => ops.originToCursor()));
    s4.body.appendChild(r);
    const r2 = el('div', 'btnrow');
    r2.append(button('مؤشر ← التحديد', () => ops.cursorToSelected()), button('مؤشر ← الأصل', () => ops.cursorToWorldOrigin()));
    s4.body.appendChild(r2);
    c.appendChild(s4.root);

    const s5 = section('تطبيق التحويلات (Ctrl+A)');
    const r3 = el('div', 'btnrow');
    r3.append(button('الموضع', () => ops.applyTransforms({ loc: true })), button('الدوران', () => ops.applyTransforms({ rot: true })), button('التحجيم', () => ops.applyTransforms({ scl: true })), button('الكل', () => ops.applyTransforms({ loc: true, rot: true, scl: true })));
    s5.body.appendChild(r3);
    c.appendChild(s5.root);
  },

  mesh(c) {
    const o = ctx.active;
    if (!o) { c.appendChild(note('لا يوجد كائن نشط.')); return; }
    if (o.isMesh) {
      const info = ctx.geometryInfo(o.geometry);
      const s1 = section('إحصائيات الشبكة');
      s1.body.append(
        frow('الرؤوس', el('span', '', String(info.verts))),
        frow('الحواف', el('span', '', String(info.edges))),
        frow('المثلثات', el('span', '', String(Math.round(info.tris)))),
        frow('الفهرسة', el('span', '', o.geometry.index ? 'مفهرسة' : 'غير مفهرسة')),
        frow('خانات الخامة', el('span', '', String(matListOf(o).length)))
      );
      c.appendChild(s1.root);

      const s2 = section('النورمالات (Normals)');
      const r = el('div', 'btnrow');
      r.append(
        button('تظليل ناعم', () => geometryEditAll('تظليل ناعم', (g) => smoothNormals(g))),
        button('تظليل مسطح', () => geometryEditAll('تظليل مسطح', (g) => { const f = g.index ? g.toNonIndexed() : g; f.computeVertexNormals(); return f; })),
        button('قلب النورمالات', () => geometryEditAll('قلب النورمالات', (g) => ops.flipWinding(g))),
        button('إعادة حساب', () => geometryEditAll('إعادة حساب النورمالات', (g) => { g.computeVertexNormals(); return g; }))
      );
      s2.body.appendChild(r);
      c.appendChild(s2.root);

      const s3 = section('دمج الرؤوس حسب المسافة');
      const dist = numInput(0.0001, () => {}, { step: 0.0001, digits: 6 });
      s3.body.appendChild(frow('المسافة', dist));
      s3.body.appendChild(button('دمج (Merge by Distance)', () => {
        const tol = Math.max(1e-7, parseFloat(dist.value) || 1e-4);
        geometryEditAll('دمج الرؤوس', (g, m) => {
          if (Array.isArray(m.material)) { toast('الدمج بالمسافة يدعم الخامة الواحدة فقط'); return null; }
          const p = new THREE.BufferGeometry();
          p.setAttribute('position', (g.index ? g.toNonIndexed() : g).attributes.position);
          const merged = mergeVertices(p, tol);
          merged.computeVertexNormals();
          return merged;
        });
      }));
      c.appendChild(s3.root);
    }
    const s4 = section('المجسمات الجاهزة والمجموعات');
    s4.body.appendChild(note('حوّل أي مجسم جاهز (سلاح، مبنى…) إلى أجزاء قابلة للتعديل أو إلى شبكة واحدة.'));
    const r4 = el('div', 'btnrow');
    r4.append(button('فك إلى أجزاء مستقلة', () => breakApart()), button('دمج في شبكة واحدة', () => mergeGroupToMesh()));
    s4.body.appendChild(r4);
    const r5 = el('div', 'btnrow');
    r5.append(button('دمج المحدد (Ctrl+J)', () => ops.joinSelected()), button('فصل حسب الأجزاء (P)', () => ops.separateSelected('loose')), button('فصل حسب الخامة', () => ops.separateSelected('material')));
    s4.body.appendChild(r5);
    c.appendChild(s4.root);
    c.appendChild(note('أدوات Edit Mode (Extrude / Inset / Bevel / Loop Cut…) تصل في المرحلة التالية.'));
  },

  modifiers(c) {
    const s = section('مكدس المعدلات غير التدميري');
    s.body.appendChild(note('المعدلات (Subdivision, Boolean, Mirror, Array, Solidify, Decimate, Bevel, Noise) تُضاف كوحدة editor-modifiers.js في المرحلة التالية، وتستبدل هذا التبويب عبر ctx.ui.tabs.modifiers.'));
    c.appendChild(s.root);
  },

  material(c) {
    const mesh = ctx.active && ctx.active.isMesh ? ctx.active : null;
    if (!mesh) { c.appendChild(note('حدد شبكة لتعديل خاماتها.')); return; }
    const list = matListOf(mesh);
    if (uiState.slot >= list.length) uiState.slot = 0;
    const s0 = section('خانات الخامات (Material Slots)');
    list.forEach((m, i) => {
      const row = el('div', 'slot' + (i === uiState.slot ? ' sel' : ''));
      const sw = el('span', 'swatch');
      sw.style.background = '#' + (m.color ? m.color.getHexString() : '888888');
      row.append(sw, el('span', '', escapeHtml((i + 1) + '. ' + (m.name || 'Material'))));
      row.addEventListener('click', () => { uiState.slot = i; renderProps(); });
      s0.body.appendChild(row);
    });
    const sr = el('div', 'btnrow');
    sr.append(button('+ خانة', () => { addSlot(mesh); }), button('− حذف الخانة', () => removeSlot(mesh, uiState.slot)));
    s0.body.appendChild(sr);
    s0.body.appendChild(note('تعيين خامة لأوجه محددة يتم في Edit Mode (المرحلة التالية). الخانات الجديدة تبدأ بلا أوجه.'));
    c.appendChild(s0.root);

    const m = list[uiState.slot];
    const sp = section('خامات سريعة');
    const pr = el('div', 'btnrow');
    Object.keys(MAT_PRESETS).forEach((k) => pr.appendChild(button(MAT_PRESETS[k][0], () => applyMatPreset(mesh, uiState.slot, k))));
    sp.body.appendChild(pr);
    c.appendChild(sp.root);

    if (!m.isMeshPhysicalMaterial) {
      const warn = section('خامة قياسية');
      warn.body.appendChild(note('هذه خامة MeshStandardMaterial. رقّها إلى Physical لتفعيل Transmission / Clearcoat / Sheen / IOR.'));
      warn.body.appendChild(button('ترقية إلى MeshPhysicalMaterial', () => { ensurePhysical(mesh, uiState.slot); }));
      c.appendChild(warn.root);
    }
    const phys = m.isMeshPhysicalMaterial;

    const s1 = section('السطح (Surface)');
    s1.body.appendChild(frow('الاسم', textInput(m.name || '', (v) => { const ov = m.name; ctx.history.execute(new FnCommand('اسم الخامة', () => { m.name = v; }, () => { m.name = ov; })); })));
    s1.body.appendChild(frow('اللون', liveColor(() => '#' + m.color.getHexString(), (hex) => { m.color.set(hex); }, 'لون الخامة')));
    const mr = (label, key, min, max, step) => s1.body.appendChild(frow(label, liveRange(() => m[key], (v) => { m[key] = v; m.needsUpdate = true; }, min, max, step, 'خامة: ' + key)));
    mr('المعدنية', 'metalness', 0, 1, 0.01);
    mr('الخشونة', 'roughness', 0, 1, 0.01);
    if (phys) {
      mr('IOR', 'ior', 1, 2.333, 0.01);
      mr('Transmission', 'transmission', 0, 1, 0.01);
      mr('السماكة', 'thickness', 0, 5, 0.01);
      mr('Clearcoat', 'clearcoat', 0, 1, 0.01);
      mr('خشونة Clearcoat', 'clearcoatRoughness', 0, 1, 0.01);
      mr('Sheen', 'sheen', 0, 1, 0.01);
    }
    c.appendChild(s1.root);

    const s2 = section('الإشعاع والشفافية');
    s2.body.appendChild(frow('Emissive', liveColor(() => '#' + m.emissive.getHexString(), (hex) => { m.emissive.set(hex); }, 'Emissive')));
    s2.body.appendChild(frow('شدة Emissive', liveRange(() => m.emissiveIntensity, (v) => { m.emissiveIntensity = v; }, 0, 5, 0.05, 'شدة Emissive')));
    s2.body.appendChild(frow('العتامة', liveRange(() => m.opacity, (v) => { m.opacity = v; m.transparent = v < 1; m.needsUpdate = true; }, 0, 1, 0.01, 'العتامة')));
    s2.body.appendChild(frow('وجهان', checkbox(m.side === THREE.DoubleSide, (v) => { const ov = m.side; ctx.history.execute(new FnCommand('DoubleSide', () => { m.side = v ? THREE.DoubleSide : THREE.FrontSide; m.needsUpdate = true; }, () => { m.side = ov; m.needsUpdate = true; })); })));
    s2.body.appendChild(frow('Flat Shading', checkbox(m.flatShading, (v) => { const ov = m.flatShading; ctx.history.execute(new FnCommand('Flat Shading', () => { m.flatShading = v; m.needsUpdate = true; }, () => { m.flatShading = ov; m.needsUpdate = true; })); })));
    c.appendChild(s2.root);

    const s3 = section('الخرائط (Textures)');
    [['map', 'اللون'], ['normalMap', 'Normal'], ['roughnessMap', 'خشونة'], ['metalnessMap', 'معدنية'], ['aoMap', 'AO']].forEach(([key, label]) => {
      const row = el('div', 'btnrow');
      const tex = m[key];
      row.append(button((tex ? '✔ ' : '+ ') + label, () => pickTexture((t) => { if (key === 'map') t.colorSpace = THREE.SRGBColorSpace; setTextureSlot(m, key, t); })));
      if (tex) row.appendChild(button('إزالة', () => setTextureSlot(m, key, null), 'warn'));
      s3.body.appendChild(row);
      if (tex) {
        const rep = el('div', 'trio');
        rep.style.gridTemplateColumns = 'repeat(4, 1fr)';
        const mk = (prop, axis, label2) => numInput(tex[prop][axis], (v) => setTexTransform(tex, prop, axis === 'x' ? v : tex[prop].x, axis === 'y' ? v : tex[prop].y), { step: 0.1, digits: 3 });
        const f1 = mk('repeat', 'x'), f2 = mk('repeat', 'y'), f3 = mk('offset', 'x'), f4 = mk('offset', 'y');
        [f1, f2, f3, f4].forEach((f, i) => { f.title = ['تكرار X', 'تكرار Y', 'إزاحة X', 'إزاحة Y'][i]; });
        rep.append(f1, f2, f3, f4);
        s3.body.appendChild(rep);
      }
    });
    s3.body.appendChild(note('الحقول: تكرار X · تكرار Y · إزاحة X · إزاحة Y'));
    c.appendChild(s3.root);
  },

  world(c) {
    const s1 = section('إضافة أضواء');
    const r = el('div', 'btnrow');
    r.append(button('☀️ شمس', () => ops.addLight('sun')), button('💡 نقطة', () => ops.addLight('point')), button('🔦 Spot', () => ops.addLight('spot')), button('🌗 Hemisphere', () => ops.addLight('hemi')));
    s1.body.appendChild(r);
    s1.body.appendChild(note('الأضواء تظهر وتؤثر في وضع Rendered فقط (مثل Blender). Material Preview يستخدم بيئة RoomEnvironment.'));
    c.appendChild(s1.root);

    const L = ctx.active && ctx.active.isLight ? ctx.active : null;
    if (L) {
      const s2 = section('الضوء المحدد: ' + L.name);
      s2.body.appendChild(frow('اللون', liveColor(() => '#' + L.color.getHexString(), (hex) => { L.color.set(hex); }, 'لون الضوء')));
      s2.body.appendChild(frow('الشدة', liveRange(() => L.intensity, (v) => { L.intensity = v; }, 0, L.isPointLight || L.isSpotLight ? 1000 : 20, L.isPointLight || L.isSpotLight ? 1 : 0.05, 'شدة الضوء')));
      if (L.isHemisphereLight) s2.body.appendChild(frow('لون الأرض', liveColor(() => '#' + L.groundColor.getHexString(), (hex) => { L.groundColor.set(hex); }, 'لون الأرض')));
      if (L.isPointLight || L.isSpotLight) {
        s2.body.appendChild(frow('المسافة', liveRange(() => L.distance, (v) => { L.distance = v; }, 0, 100, 0.5, 'مسافة الضوء')));
        s2.body.appendChild(frow('Decay', liveRange(() => L.decay, (v) => { L.decay = v; }, 0, 4, 0.1, 'Decay')));
      }
      if (L.isSpotLight) {
        s2.body.appendChild(frow('الزاوية °', liveRange(() => deg(L.angle), (v) => { L.angle = rad(v); }, 1, 89, 1, 'زاوية Spot')));
        s2.body.appendChild(frow('Penumbra', liveRange(() => L.penumbra, (v) => { L.penumbra = v; }, 0, 1, 0.01, 'Penumbra')));
      }
      if (!L.isHemisphereLight) s2.body.appendChild(frow('ظلال', checkbox(L.castShadow, (v) => { const ov = L.castShadow; ctx.history.execute(new FnCommand('ظلال الضوء', () => { L.castShadow = v; }, () => { L.castShadow = ov; })); })));
      c.appendChild(s2.root);
    }

    const S = ctx.settings;
    const s3 = section('العالم (World)');
    s3.body.appendChild(frow('الخلفية', selectInput([['color', 'لون'], ['gradient', 'تدرج'], ['env', 'بيئة']], S.bgMode, (v) => { S.bgMode = v; ctx.applyShading(); })));
    const c1 = document.createElement('input'); c1.type = 'color'; c1.value = S.bgColor; c1.addEventListener('input', () => { S.bgColor = c1.value; ctx.applyShading(); });
    const c2 = document.createElement('input'); c2.type = 'color'; c2.value = S.bgColor2; c2.addEventListener('input', () => { S.bgColor2 = c2.value; ctx.applyShading(); });
    s3.body.appendChild(frow('لون / أسفل', c1));
    s3.body.appendChild(frow('أعلى (تدرج)', c2));
    const envRange = document.createElement('input');
    envRange.type = 'range'; envRange.min = 0; envRange.max = 3; envRange.step = 0.05; envRange.value = S.envIntensity;
    envRange.addEventListener('input', () => { S.envIntensity = parseFloat(envRange.value); ctx.applyShading(); });
    s3.body.appendChild(frow('شدة البيئة', envRange));
    s3.body.appendChild(frow('بيئة في Rendered', checkbox(S.useEnv, (v) => { S.useEnv = v; ctx.applyShading(); })));
    s3.body.appendChild(frow('Tone Mapping', selectInput(['None', 'Linear', 'Reinhard', 'Cineon', 'ACES', 'AgX', 'Neutral'].map((x) => [x, x]), S.toneMapping, (v) => { S.toneMapping = v; ctx.applyShading(); })));
    const exp = document.createElement('input');
    exp.type = 'range'; exp.min = 0.1; exp.max = 4; exp.step = 0.05; exp.value = S.exposure;
    exp.addEventListener('input', () => { S.exposure = parseFloat(exp.value); ctx.applyShading(); });
    s3.body.appendChild(frow('التعرض', exp));
    c.appendChild(s3.root);
  },

  scene(c) {
    const s1 = section('استيراد');
    const r = el('div', 'btnrow');
    r.append(button('استيراد ملف…', () => bus.emit('io', { action: 'import' })));
    s1.body.appendChild(r);
    s1.body.appendChild(note('يدعم glb / gltf / obj / stl / json (مشروع). يمكنك أيضاً سحب الملف وإفلاته على النافذة.'));
    c.appendChild(s1.root);

    const s2 = section('تصدير');
    const r2 = el('div', 'btnrow');
    r2.append(button('GLB', () => bus.emit('io', { action: 'export-glb' })), button('glTF', () => bus.emit('io', { action: 'export-gltf' })), button('OBJ', () => bus.emit('io', { action: 'export-obj' })), button('STL', () => bus.emit('io', { action: 'export-stl' })));
    s2.body.appendChild(r2);
    const r3 = el('div', 'btnrow');
    r3.append(button('PNG شفاف', () => bus.emit('io', { action: 'snapshot', transparent: true })), button('PNG استوديو', () => bus.emit('io', { action: 'snapshot', transparent: false })));
    s2.body.appendChild(r3);
    c.appendChild(s2.root);

    const s3 = section('المشروع');
    const r4 = el('div', 'btnrow');
    r4.append(button('حفظ مشروع .json', () => bus.emit('io', { action: 'save-project' })), button('فتح مشروع…', () => bus.emit('io', { action: 'import' })), button('جديد', () => bus.emit('io', { action: 'new' }), 'warn'));
    s3.body.appendChild(r4);
    s3.body.appendChild(note('يُحفظ المشروع تلقائياً في IndexedDB ويُستعاد عند فتح المحرر مجدداً.'));
    c.appendChild(s3.root);

    const s4 = section('العرض');
    s4.body.appendChild(frow('الشبكة', checkbox(ctx.settings.showGrid, (v) => { ctx.settings.showGrid = v; })));
    s4.body.appendChild(frow('الإحصائيات', checkbox(ctx.settings.showStats, (v) => { ctx.settings.showStats = v; })));
    c.appendChild(s4.root);
  }
};

function renderProps() {
  const c = $('#props');
  const scroll = c.scrollTop;
  c.innerHTML = '';
  const fn = ctx.ui.tabs[uiState.tab] || ctx.ui.tabs.transform;
  fn(c);
  c.scrollTop = scroll;
  $$('#props-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.ptab === uiState.tab));
}

function refreshTransformFields() {
  if (uiState.tab !== 'transform' || !transformFields) return;
  Object.values(transformFields).forEach((list) => list.forEach(([input, ax, getter]) => {
    if (document.activeElement !== input) input.value = fmt(getter(ax), 4);
  }));
}

$$('#props-tabs button').forEach((b) => b.addEventListener('click', () => {
  uiState.tab = b.dataset.ptab;
  storageSet('studio.tab', uiState.tab);
  renderProps();
}));

let propsQueued = false;
function scheduleProps() {
  if (propsQueued) return;
  propsQueued = true;
  requestAnimationFrame(() => {
    propsQueued = false;
    const a = document.activeElement;
    if (a && a.closest && a.closest('#props') && (a.tagName === 'INPUT' || a.tagName === 'SELECT') && a.type !== 'checkbox' && a.type !== 'range') return;
    renderProps();
  });
}

// =====================================================================
// HUD: التظليل، الإسقاط، Snap، الوضع، الأدوات
// =====================================================================
function setShading(mode) {
  ctx.settings.shading = mode;
  ctx.applyShading();
}
function toggleXray() {
  ctx.settings.xray = !ctx.settings.xray;
  ctx.applyShading();
  toast(ctx.settings.xray ? 'X-Ray مفعّل' : 'X-Ray معطّل');
}

$$('#shade-seg button').forEach((b) => b.addEventListener('click', () => setShading(b.dataset.shade)));
$('#xray-btn').addEventListener('click', toggleXray);
$('#proj-btn').addEventListener('click', () => ctx.toggleProjection());
$('#snap-btn').addEventListener('click', () => { ctx.settings.snap.enabled = !ctx.settings.snap.enabled; bus.emit('settings'); });
$('#snap-mode').addEventListener('change', (e) => { ctx.settings.snap.mode = e.target.value; bus.emit('settings'); });
$('#pivot-select').addEventListener('change', (e) => { ctx.settings.pivot = e.target.value; ops.syncGizmo(); });
$('#space-select').addEventListener('change', (e) => { ctx.settings.space = e.target.value; ops.syncGizmo(); });
$('#mode-select').addEventListener('change', (e) => { if (!ops.setMode(e.target.value)) e.target.value = ctx.mode; });
$$('#toolbar button[data-tool]').forEach((b) => b.addEventListener('click', () => ops.setTool(b.dataset.tool)));
$('#tb-undo').addEventListener('click', () => ctx.history.undo());
$('#tb-redo').addEventListener('click', () => ctx.history.redo());

function refreshHud() {
  $$('#shade-seg button').forEach((b) => b.classList.toggle('active', b.dataset.shade === ctx.settings.shading));
  $('#xray-btn').classList.toggle('on', ctx.settings.xray);
  $('#proj-btn').textContent = ctx.camera && ctx.camera.isOrthographicCamera ? 'متعامد' : 'منظور';
  $('#snap-btn').classList.toggle('on', ctx.settings.snap.enabled);
  $('#mode-select').value = ctx.mode;
  $$('#toolbar button[data-tool]').forEach((b) => b.classList.toggle('active', b.dataset.tool === ctx.tool));
  $('#tb-undo').disabled = ctx.history.undos.length === 0;
  $('#tb-redo').disabled = ctx.history.redos.length === 0;
}

function refreshStatus() {
  const n = ctx.selection.length;
  $('#status-sel').textContent = n ? (ctx.active ? ctx.active.name : '') + ' · ' + n + ' محدد' : 'لا تحديد';
}

bus.on('modal-update', (t) => { const m = $('#modal-status'); m.style.display = 'block'; m.textContent = t; });
bus.on('modal', () => { if (!ctx.modal.active) $('#modal-status').style.display = 'none'; refreshHud(); });
bus.on('selection', () => { scheduleOutliner(); scheduleProps(); refreshStatus(); refreshHud(); });
bus.on('scene', () => { scheduleOutliner(); });
bus.on('history', () => {
  scheduleProps();
  refreshHud();
  if ($('#history').style.display !== 'none') renderHistory();
});
bus.on('settings', refreshHud);
bus.on('tool', refreshHud);
bus.on('mode', refreshHud);
let ocQueued = false;
bus.on('objectchange', () => {
  if (ocQueued) return;
  ocQueued = true;
  requestAnimationFrame(() => { ocQueued = false; refreshTransformFields(); });
});

// =====================================================================
// اختصارات لوحة المفاتيح (تعتمد e.code ليعمل التخطيط العربي بنفس الاختصارات الإنجليزية)
// =====================================================================
function isTyping(t) {
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

const SHADE_CYCLE = ['wire', 'solid', 'preview', 'rendered'];

function cycleShading() {
  const i = SHADE_CYCLE.indexOf(ctx.settings.shading);
  setShading(SHADE_CYCLE[(i + 1) % SHADE_CYCLE.length]);
}

function toggleEditMode() {
  if (ctx.mode === 'object') ops.setMode('edit');
  else ops.setMode('object');
}

window.addEventListener('keydown', (e) => {
  if (isTyping(e.target)) return;
  if (ctx.modal.active) {
    if (ctx.modalKey(e)) e.preventDefault();
    return;
  }
  const code = e.code;
  const ctrl = e.ctrlKey || e.metaKey;
  const shift = e.shiftKey;
  const alt = e.altKey;

  const modeDef = ctx.modes[ctx.mode];
  if (ctx.mode !== 'object' && modeDef && modeDef.onKey && modeDef.onKey(e)) { e.preventDefault(); return; }

  // لوحة الأرقام: زوايا العرض
  if (code.startsWith('Numpad')) {
    const map = { Numpad1: ctrl ? 'back' : 'front', Numpad3: ctrl ? 'left' : 'right', Numpad7: ctrl ? 'bottom' : 'top', Numpad9: 'opposite' };
    if (map[code]) { ctx.setView(map[code]); e.preventDefault(); return; }
    if (code === 'Numpad5') { ctx.toggleProjection(); e.preventDefault(); return; }
    if (code === 'NumpadDecimal') { ctx.frameSelected(); e.preventDefault(); return; }
  }

  if (ctrl) {
    switch (code) {
      case 'KeyZ': if (shift) ctx.history.redo(); else ctx.history.undo(); break;
      case 'KeyY': ctx.history.redo(); break;
      case 'KeyS': bus.emit('io', { action: 'save-project' }); break;
      case 'KeyO': bus.emit('io', { action: 'import' }); break;
      case 'KeyJ': ops.joinSelected(); break;
      case 'KeyG': ops.groupSelected(); break;
      case 'KeyI': ops.selectInvert(); break;
      case 'KeyM': buildMenu(axisMenu((a) => ops.mirrorSelected(a)), mousePos.x, mousePos.y, 0); break;
      case 'KeyA': buildMenu(applyMenuItems(), mousePos.x, mousePos.y, 0); break;
      case 'BracketLeft': ops.selectParent(); break;
      default: return;
    }
    e.preventDefault();
    return;
  }

  switch (code) {
    case 'Tab': toggleEditMode(); break;
    case 'KeyG': ops.setTool('move'); ops.beginModal('translate'); break;
    case 'KeyR': ops.setTool('rotate'); ops.beginModal('rotate'); break;
    case 'KeyS':
      if (shift) buildMenu(snapMenuItems(), mousePos.x, mousePos.y, 0);
      else { ops.setTool('scale'); ops.beginModal('scale'); }
      break;
    case 'KeyW': ops.setTool('select'); break;
    case 'KeyX': case 'Delete': ops.deleteSelected(); break;
    case 'KeyA':
      if (shift) buildMenu(addMenuItems(), mousePos.x, mousePos.y, 0);
      else if (alt) ops.selectNone();
      else ops.selectAll();
      break;
    case 'KeyD': if (shift) ops.duplicateSelected(false, true); else if (alt) ops.duplicateSelected(true, true); else return; break;
    case 'KeyH': if (alt) ops.showAll(); else ops.hideSelected(); break;
    case 'KeyP': if (alt) ops.clearParent(); else buildMenu([{ label: 'حسب الأجزاء المنفصلة', action: () => ops.separateSelected('loose') }, { label: 'حسب الخامة', action: () => ops.separateSelected('material') }], mousePos.x, mousePos.y, 0); break;
    case 'KeyF': ctx.frameSelected(); break;
    case 'Home': ctx.frameAll(); break;
    case 'KeyC': if (shift) { ops.cursorToWorldOrigin(); ctx.frameAll(); } else return; break;
    case 'KeyZ': if (alt) toggleXray(); else if (shift) setShading(ctx.settings.shading === 'wire' ? 'solid' : 'wire'); else cycleShading(); break;
    case 'Digit5': ctx.toggleProjection(); break;
    case 'Slash': ops.toggleIsolate(); break;
    case 'BracketLeft': ops.selectParent(); break;
    case 'BracketRight': ops.selectChildren(); break;
    case 'F2': startRename(ctx.active); break;
    case 'KeyO': toast('التحرير التناسبي (Proportional Editing) يعمل داخل Edit Mode في المرحلة التالية'); break;
    case 'Escape': if (openMenus.length) closeMenus(); else ops.selectNone(); break;
    default: return;
  }
  e.preventDefault();
});

// =====================================================================
// شريط اللمس العائم
// =====================================================================
const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
if (coarse || navigator.maxTouchPoints > 0 && window.innerWidth < 1100) document.body.classList.add('touch');

$$('#touchbar button').forEach((b) => b.addEventListener('click', () => {
  const k = b.dataset.tb;
  if (k === 'move') { ops.setTool('move'); ops.beginModal('translate'); }
  else if (k === 'rotate') { ops.setTool('rotate'); ops.beginModal('rotate'); }
  else if (k === 'scale') { ops.setTool('scale'); ops.beginModal('scale'); }
  else if (k.startsWith('ax-')) { const a = k.slice(3); ctx.modalKey({ key: a, code: 'Key' + a.toUpperCase(), shiftKey: false }); }
  else if (k === 'undo') ctx.history.undo();
  else if (k === 'redo') ctx.history.redo();
  else if (k === 'mode') toggleEditMode();
  else if (k === 'ok') ops.endModal(true);
  else if (k === 'cancel') ops.endModal(false);
}));

// =====================================================================
// كشف الواجهة للوحدات القادمة
// =====================================================================
ctx.ui = {
  tabs, showMenu, renderProps, scheduleProps, scheduleOutliner, section, frow, button, note, numInput,
  checkbox, selectInput, liveRange, liveColor, textInput, el, toggleXray, setShading, breakApart, mergeGroupToMesh
};

renderOutliner();
renderProps();
refreshHud();
refreshStatus();
