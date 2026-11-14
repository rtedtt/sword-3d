// editor-io.js — الاستيراد/التصدير، IndexedDB، BroadcastChannel، تسلّم المجسم من index.html، الحفظ التلقائي
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { ctx, bus, toast, $, downloadBlob, storageSet } from './editor-state.js';
import { setSelection } from './editor-history.js';
import * as ops from './editor-ops.js';

// ---------- IndexedDB (كل الاستدعاءات محمية بـ try/catch) ----------
function idbOpen() {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open('studio-db', 1);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('kv')) req.result.createObjectStore('kv'); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) { reject(e); }
  });
}
async function idbGet(key) {
  try {
    const db = await idbOpen();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readonly');
      const rq = tx.objectStore('kv').get(key);
      rq.onsuccess = () => { db.close(); resolve(rq.result); };
      rq.onerror = () => { db.close(); reject(rq.error); };
    });
  } catch (e) { return undefined; }
}
async function idbPut(key, value) {
  try {
    const db = await idbOpen();
    return await new Promise((resolve) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(value, key);
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => { db.close(); resolve(false); };
    });
  } catch (e) { return false; }
}
async function idbDelete(key) {
  try {
    const db = await idbOpen();
    await new Promise((resolve) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').delete(key);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); };
    });
  } catch (e) { /* لا شيء */ }
}

let channel = null;
try { channel = new BroadcastChannel('studio-editor'); } catch (e) { channel = null; }

// ---------- تحميل ----------
function markShadows(root) {
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
}

function stem(name) { return name.replace(/\.[^.]+$/, ''); }

function addImported(group, name) {
  group.name = ops.uniqueName(name || group.name || 'Imported');
  ops.fixLightTargets(group);
  markShadows(group);
  ops.addObject(group, { atCursor: false });
}

async function importGLBBuffer(buffer, name) {
  const loader = new GLTFLoader();
  const gltf = await loader.parseAsync(buffer, '');
  const g = gltf.scene;
  addImported(g, name);
}

async function importFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const base = stem(file.name);
  try {
    if (ext === 'glb' || ext === 'gltf') {
      const buf = ext === 'glb' ? await file.arrayBuffer() : await file.text();
      const loader = new GLTFLoader();
      const gltf = await loader.parseAsync(buf, '');
      addImported(gltf.scene, base);
    } else if (ext === 'obj') {
      const g = new OBJLoader().parse(await file.text());
      addImported(g, base);
    } else if (ext === 'stl') {
      const geo = new STLLoader().parse(await file.arrayBuffer());
      if (!geo.attributes.normal) geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, ops.defaultMaterial());
      addImported(mesh, base);
    } else if (ext === 'json') {
      const data = JSON.parse(await file.text());
      if (data && data.format === 'StudioProject') {
        if (ctx.world.children.length && !window.confirm('فتح المشروع سيستبدل المشهد الحالي. متابعة؟')) return;
        await loadProject(data);
        toast('تم فتح المشروع');
      } else if (data && data.metadata && data.metadata.type === 'Object') {
        const obj = await new THREE.ObjectLoader().parseAsync(data);
        addImported(obj, base);
      } else toast('ملف JSON غير معروف');
    } else toast('صيغة غير مدعومة: ' + ext);
  } catch (err) {
    console.error(err);
    toast('تعذر استيراد ' + file.name);
  }
}

async function importFiles(files) {
  for (const f of files) await importFile(f);
  ctx.frameAll();
}

const fileInput = $('#file-import');
fileInput.addEventListener('change', async () => {
  if (fileInput.files.length) await importFiles([...fileInput.files]);
  fileInput.value = '';
});

const stage = $('#stage');
const dropzone = $('#dropzone');
let dragDepth = 0;
stage.addEventListener('dragenter', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { dragDepth++; dropzone.style.display = 'flex'; } });
stage.addEventListener('dragover', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
stage.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) dropzone.style.display = 'none'; });
stage.addEventListener('drop', async (e) => {
  dragDepth = 0;
  dropzone.style.display = 'none';
  if (!e.dataTransfer || !e.dataTransfer.files.length) return;
  e.preventDefault();
  await importFiles([...e.dataTransfer.files]);
});

// ---------- المشروع ----------
function projectJSON() {
  return {
    format: 'StudioProject',
    version: 1,
    savedAt: new Date().toISOString(),
    cursor: ctx.cursor.position.toArray(),
    settings: {
      shading: ctx.settings.shading, bgMode: ctx.settings.bgMode, bgColor: ctx.settings.bgColor, bgColor2: ctx.settings.bgColor2,
      envIntensity: ctx.settings.envIntensity, useEnv: ctx.settings.useEnv, exposure: ctx.settings.exposure, toneMapping: ctx.settings.toneMapping
    },
    scene: ctx.world.toJSON()
  };
}

async function loadProject(data) {
  const root = await new THREE.ObjectLoader().parseAsync(data.scene);
  ctx.world.clear();
  [...root.children].forEach((c) => ctx.world.add(c));
  ops.fixLightTargets(ctx.world);
  markShadows(ctx.world);
  if (data.settings) Object.assign(ctx.settings, data.settings);
  if (Array.isArray(data.cursor)) ctx.setCursor(new THREE.Vector3().fromArray(data.cursor));
  ctx.history.clear();
  setSelection([]);
  ctx.applyShading();
  bus.emit('scene');
}

async function saveProject() {
  const data = projectJSON();
  const text = JSON.stringify(data);
  downloadBlob(new Blob([text], { type: 'application/json' }), 'studio_project_' + new Date().toISOString().slice(0, 10) + '.json');
  await idbPut('autosave', { time: Date.now(), json: text });
  toast('تم حفظ المشروع');
}

let autosaveTimer = 0;
bus.on('history', () => {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(async () => {
    try { await idbPut('autosave', { time: Date.now(), json: JSON.stringify(projectJSON()) }); storageSet('studio.autosave.time', String(Date.now())); } catch (e) { /* ممتلئ أو غير متاح */ }
  }, 1500);
});

function newScene() {
  if (ctx.world.children.length && !window.confirm('سيتم مسح المشهد الحالي. متابعة؟')) return;
  ctx.world.clear();
  ctx.history.clear();
  setSelection([]);
  ops.addDefaultSun();
  idbDelete('autosave');
  toast('مشهد جديد');
}

// ---------- التصدير ----------
async function exportGLB(binary) {
  try {
    const result = await new GLTFExporter().parseAsync(ctx.world, { binary, onlyVisible: true });
    if (binary) downloadBlob(new Blob([result], { type: 'model/gltf-binary' }), 'studio_scene.glb');
    else downloadBlob(new Blob([JSON.stringify(result)], { type: 'model/gltf+json' }), 'studio_scene.gltf');
    toast('تم التصدير');
  } catch (err) { console.error(err); toast('تعذر التصدير'); }
}

function exportOBJ() {
  try {
    const text = new OBJExporter().parse(ctx.world);
    downloadBlob(new Blob([text], { type: 'text/plain' }), 'studio_scene.obj');
    toast('تم تصدير OBJ');
  } catch (err) { console.error(err); toast('تعذر تصدير OBJ'); }
}

function exportSTL() {
  try {
    const view = new STLExporter().parse(ctx.world, { binary: true });
    downloadBlob(new Blob([view], { type: 'model/stl' }), 'studio_scene.stl');
    toast('تم تصدير STL');
  } catch (err) { console.error(err); toast('تعذر تصدير STL'); }
}

async function exportSnapshot(transparent) {
  const blob = await ctx.snapshot({ transparent, scale: 2 });
  if (blob) { downloadBlob(blob, 'studio_snapshot_' + (transparent ? 'transparent' : 'studio') + '.png'); toast('تم حفظ اللقطة'); }
}

bus.on('io', (msg) => {
  switch (msg.action) {
    case 'import': fileInput.click(); break;
    case 'export-glb': exportGLB(true); break;
    case 'export-gltf': exportGLB(false); break;
    case 'export-obj': exportOBJ(); break;
    case 'export-stl': exportSTL(); break;
    case 'save-project': saveProject(); break;
    case 'snapshot': exportSnapshot(!!msg.transparent); break;
    case 'new': newScene(); break;
    default: break;
  }
});

// ---------- التسلّم من index.html ----------
let waitingHandoff = false;

async function consumeHandoff() {
  const rec = await idbGet('handoff');
  if (!rec || !rec.glb) return false;
  await importGLBBuffer(rec.glb, rec.name || 'FromSite');
  await idbDelete('handoff');
  return true;
}

if (channel) {
  channel.onmessage = async (ev) => {
    if (ev.data && ev.data.type === 'handoff-ready' && waitingHandoff) {
      if (await consumeHandoff()) { waitingHandoff = false; ctx.frameAll(); toast('وصل المجسم من الموقع'); }
    }
  };
}

async function waitForHandoff(timeoutMs) {
  waitingHandoff = true;
  const start = performance.now();
  while (waitingHandoff && performance.now() - start < timeoutMs) {
    if (await consumeHandoff()) { waitingHandoff = false; return true; }
    await new Promise((r) => setTimeout(r, 400));
  }
  const ok = !waitingHandoff;
  waitingHandoff = false;
  return ok;
}

(async function startup() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('handoff')) {
    ops.addDefaultSun();
    toast('بانتظار المجسم من الموقع…', 5000);
    const ok = await waitForHandoff(15000);
    try { window.history.replaceState({}, '', window.location.pathname); } catch (e) { /* أصل مقيد */ }
    if (ok) {
      ctx.settings.shading = 'preview';
      ctx.applyShading();
      ctx.history.clear();
      ctx.frameAll();
      toast('تم فتح المجسم في الاستوديو');
    } else toast('لم يصل مجسم من الموقع — ابدأ من إضافة ← المجسمات الجاهزة');
    return;
  }
  const rec = await idbGet('autosave');
  if (rec && rec.json) {
    try {
      await loadProject(JSON.parse(rec.json));
      ctx.frameAll();
      toast('تمت استعادة آخر جلسة');
      return;
    } catch (err) { console.warn('فشلت استعادة الجلسة', err); }
  }
  ops.addDefaultSun();
  toast('مرحباً! Shift+A لإضافة مجسم أو مجسم جاهز', 4500);
})();

ctx.io = { importFiles, loadProject, projectJSON, idbGet, idbPut };
