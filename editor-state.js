// editor-state.js — الحالة المشتركة + ناقل الأحداث + أدوات صغيرة
import * as THREE from 'three';

const listeners = new Map();

export const bus = {
  on(evt, fn) {
    if (!listeners.has(evt)) listeners.set(evt, new Set());
    listeners.get(evt).add(fn);
    return () => listeners.get(evt).delete(fn);
  },
  emit(evt, data) {
    const set = listeners.get(evt);
    if (!set) return;
    [...set].forEach((fn) => {
      try { fn(data); } catch (e) { console.error('[bus:' + evt + ']', e); }
    });
  }
};

// الحالة العامة (تُملأ من editor-viewport.js وبقية الوحدات)
export const ctx = {
  THREE,
  selection: [],
  active: null,
  mode: 'object',
  modes: {},
  tool: 'select',
  settings: {
    shading: 'solid',
    xray: false,
    space: 'global',
    pivot: 'median',
    snap: { enabled: false, mode: 'increment', inc: 0.25, rot: 15, scl: 0.1 },
    envIntensity: 1.0,
    useEnv: true,
    exposure: 1.0,
    toneMapping: 'ACES',
    bgMode: 'color',
    bgColor: '#303030',
    bgColor2: '#0b0f19',
    showGrid: true,
    showStats: true
  }
};

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let toastTimer = 0;
export function toast(msg, ms = 2600) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

export function storageGet(key) {
  try { return window.localStorage.getItem(key); } catch (e) { return null; }
}
export function storageSet(key, value) {
  try { window.localStorage.setItem(key, value); return true; } catch (e) { return false; }
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export const AXES = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1)
};

export function fmt(n, d = 3) {
  return (Math.round(n * 10 ** d) / 10 ** d).toString();
}
