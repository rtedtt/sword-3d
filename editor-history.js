// editor-history.js — محرك التراجع/الإعادة بنمط الأوامر (Command + History)
import * as THREE from 'three';
import { bus, ctx } from './editor-state.js';

export class Command {
  constructor(name) { this.name = name; }
  execute() {}
  undo() {}
}

export class History {
  constructor() {
    this.undos = [];
    this.redos = [];
    this.limit = 300;
  }

  execute(cmd, alreadyApplied = false) {
    if (!alreadyApplied) cmd.execute();
    this.undos.push(cmd);
    this.redos.length = 0;
    if (this.undos.length > this.limit) this.undos.shift();
    bus.emit('history');
    bus.emit('scene');
  }

  undo() {
    const cmd = this.undos.pop();
    if (!cmd) return false;
    cmd.undo();
    this.redos.push(cmd);
    bus.emit('history');
    bus.emit('scene');
    return true;
  }

  redo() {
    const cmd = this.redos.pop();
    if (!cmd) return false;
    cmd.execute();
    this.undos.push(cmd);
    bus.emit('history');
    bus.emit('scene');
    return true;
  }

  // الانتقال إلى نقطة محددة في السجل (index = عدد الأوامر المطبقة)
  goto(index) {
    while (this.undos.length > index && this.undo()) { /* يتراجع حتى النقطة */ }
    while (this.undos.length < index && this.redo()) { /* يعيد حتى النقطة */ }
  }

  // يجمع كل الأوامر المنفذة داخل fn في أمر واحد (خطوة تراجع واحدة)
  batch(name, fn) {
    const before = this.undos.length;
    fn();
    const added = this.undos.splice(before);
    if (added.length > 1) this.undos.push(new MultiCommand(name, added));
    else if (added.length === 1) this.undos.push(added[0]);
    bus.emit('history');
  }

  clear() {
    this.undos.length = 0;
    this.redos.length = 0;
    bus.emit('history');
  }

  entries() {
    return [...this.undos, ...[...this.redos].reverse()];
  }
}

export function insertChild(parent, obj, index) {
  parent.add(obj);
  const arr = parent.children;
  const cur = arr.indexOf(obj);
  if (cur >= 0) arr.splice(cur, 1);
  const at = Math.max(0, Math.min(index, arr.length));
  arr.splice(at, 0, obj);
}

export function snapshotTRS(obj) {
  return {
    p: obj.position.clone(),
    q: obj.quaternion.clone(),
    s: obj.scale.clone(),
    geo: obj.isMesh ? obj.geometry : undefined,
    mat: obj.isMesh ? obj.material : undefined
  };
}

export function applyTRS(obj, st) {
  obj.position.copy(st.p);
  obj.quaternion.copy(st.q);
  obj.scale.copy(st.s);
  if (obj.isMesh) {
    if (st.geo && obj.geometry !== st.geo) obj.geometry = st.geo;
    if (st.mat && obj.material !== st.mat) obj.material = st.mat;
  }
  obj.updateMatrix();
  obj.updateMatrixWorld(true);
}

export function trsEqual(a, b) {
  return a.p.equals(b.p) && a.q.equals(b.q) && a.s.equals(b.s) && a.geo === b.geo && a.mat === b.mat;
}

// تغيير تحويلات / هندسة لمجموعة كائنات (entries: [{obj, before, after}])
export class StateCommand extends Command {
  constructor(name, entries) {
    super(name);
    this.entries = entries;
  }
  execute() { this.entries.forEach((e) => applyTRS(e.obj, e.after)); }
  undo() { this.entries.forEach((e) => applyTRS(e.obj, e.before)); }
}

export class AddObjectCommand extends Command {
  constructor(obj, parent, index) {
    super('إضافة ' + obj.name);
    this.obj = obj;
    this.parent = parent;
    this.index = index === undefined ? parent.children.length : index;
  }
  execute() {
    insertChild(this.parent, this.obj, this.index);
    this.obj.updateMatrixWorld(true);
    setSelection([this.obj]);
  }
  undo() {
    this.parent.remove(this.obj);
    setSelection(ctx.selection.filter((o) => o !== this.obj));
  }
}

export class RemoveObjectsCommand extends Command {
  constructor(objs) {
    super('حذف ' + (objs.length === 1 ? objs[0].name : objs.length + ' كائنات'));
    this.items = objs.map((o) => ({ obj: o, parent: o.parent, index: o.parent ? o.parent.children.indexOf(o) : 0 }));
  }
  execute() {
    this.items.forEach((it) => { if (it.parent) it.parent.remove(it.obj); });
    const removed = new Set(this.items.map((i) => i.obj));
    setSelection(ctx.selection.filter((o) => !removed.has(o)));
  }
  undo() {
    [...this.items].reverse().forEach((it) => { if (it.parent) insertChild(it.parent, it.obj, it.index); });
    setSelection(this.items.map((i) => i.obj));
  }
}

export class ReparentCommand extends Command {
  constructor(obj, newParent, newIndex) {
    super('ربط أبوي ' + obj.name);
    this.obj = obj;
    this.oldParent = obj.parent;
    this.oldIndex = obj.parent.children.indexOf(obj);
    this.oldState = snapshotTRS(obj);
    this.newParent = newParent;
    this.newIndex = newIndex;
    this.newState = null;
  }
  execute() {
    this.obj.updateMatrixWorld(true);
    this.newParent.updateMatrixWorld(true);
    if (this.newState) {
      insertChild(this.newParent, this.obj, this.newIndex);
      applyTRS(this.obj, this.newState);
      return;
    }
    this.newParent.attach(this.obj);
    insertChild(this.newParent, this.obj, this.newIndex);
    this.newState = snapshotTRS(this.obj);
  }
  undo() {
    insertChild(this.oldParent, this.obj, this.oldIndex);
    applyTRS(this.obj, this.oldState);
  }
}

// أمر عام بدالتين (تطبيق / عكس) لتعديلات الخصائص
export class FnCommand extends Command {
  constructor(name, doFn, undoFn) {
    super(name);
    this.doFn = doFn;
    this.undoFn = undoFn;
  }
  execute() { this.doFn(); }
  undo() { this.undoFn(); }
}

export class MultiCommand extends Command {
  constructor(name, cmds) {
    super(name);
    this.cmds = cmds;
  }
  execute() { this.cmds.forEach((c) => c.execute()); }
  undo() { [...this.cmds].reverse().forEach((c) => c.undo()); }
}

export function setSelection(list, active) {
  const clean = [];
  const seen = new Set();
  list.forEach((o) => { if (o && !seen.has(o)) { seen.add(o); clean.push(o); } });
  ctx.selection = clean;
  ctx.active = active !== undefined ? active : (clean.includes(ctx.active) ? ctx.active : clean[clean.length - 1] || null);
  bus.emit('selection');
}

export function setMaterialProp(mat, key, value, label) {
  const old = mat[key];
  const clone = (v) => (v && v.isColor ? v.clone() : v);
  const oldV = clone(old);
  const newV = clone(value);
  const apply = (v) => {
    if (mat[key] && mat[key].isColor) mat[key].copy(v);
    else mat[key] = v;
    mat.needsUpdate = true;
  };
  ctx.history.execute(new FnCommand(label || ('خامة: ' + key), () => apply(newV), () => apply(oldV)));
}

export function setObjectProp(obj, key, value, label) {
  const oldV = obj[key];
  ctx.history.execute(new FnCommand(label || ('خاصية: ' + key), () => { obj[key] = value; }, () => { obj[key] = oldV; }));
}

export { THREE };
