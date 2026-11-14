// presets.js — مكتبة المجسمات الجاهزة المشتركة بين index.html و editor.html
// تُنشئ خامات وبانيات المجسمات (مباني / أسلحة / إكسسوارات) بعد إصلاح الأعطال الهندسية.
import * as THREE from 'three';

export const PRESET_NAMES_AR = {
  cottage: 'كوخ بشرفة', shop: 'متجر القرية', villa: 'فيلا 6 غرف', palace: 'قصر ملكي',
  sword: 'سيف سحري', bow: 'قوس ونشاب', staff: 'عصا سحرية', hammer: 'مطرقة حرب',
  daggers: 'خنجران مزدوجان', axe: 'فأس المعركة', pickaxe: 'معول التعدين',
  shield: 'درع الفارس', fishingRod: 'صنارة صيد', wateringCan: 'مرشة نحاسية', shovel: 'شافل حديدي',
  crown: 'التاج الملكي', helmet: 'خوذة الفارس', backpack: 'حقيبة المغامر',
  fountain: 'نافورة القرية', amulet: 'التميمة السحرية', chalice: 'الكأس الملكي'
};

export const PRESET_CATALOG = {
  buildings: ['cottage', 'shop', 'villa', 'palace'],
  weapons: ['sword', 'bow', 'staff', 'hammer', 'daggers', 'axe', 'pickaxe', 'shield', 'fishingRod', 'wateringCan', 'shovel'],
  accessories: ['crown', 'helmet', 'backpack', 'fountain', 'amulet', 'chalice']
};

export function createPresetLibrary() {
    function createProceduralTexture(type, repeatX = 2, repeatY = 2) {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext('2d');

      if (type === 'wood') {
        ctx.fillStyle = '#8b5a2b';
        ctx.fillRect(0, 0, 256, 256);
        for (let y = 0; y < 256; y += 32) {
          ctx.fillStyle = (y / 32) % 2 === 0 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.05)';
          ctx.fillRect(0, y, 256, 30);
          ctx.fillStyle = '#3e220f';
          ctx.fillRect(0, y + 30, 256, 2);
        }
        for (let i = 0; i < 160; i++) {
          ctx.fillStyle = 'rgba(40,20,5,0.12)';
          ctx.fillRect(Math.random() * 256, Math.random() * 256, 35, 1.5);
        }
      } else if (type === 'shingles') {
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(0, 0, 256, 256);
        const rows = 8, cols = 6;
        const rw = 256 / cols, rh = 256 / rows;
        for (let r = 0; r < rows; r++) {
          const offset = (r % 2) * (rw * 0.5);
          for (let col = -1; col <= cols; col++) {
            const shade = 190 + ((r * 7 + col * 13) % 35);
            ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
            ctx.fillRect(col * rw + offset + 1, r * rh + 1, rw - 2, rh - 3);
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillRect(col * rw + offset, r * rh + rh - 2, rw, 2);
          }
        }
      } else if (type === 'stone') {
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(0, 0, 256, 256);
        for (let r = 0; r < 8; r++) {
          const y = r * 32;
          const off = (r % 2) * 24;
          for (let x = -32; x < 256; x += 48) {
            const v = 135 + ((r * 19 + x) % 45);
            ctx.fillStyle = `rgb(${v},${v + 4},${v + 10})`;
            ctx.fillRect(x + off + 2, y + 2, 44, 28);
          }
        }
      } else if (type === 'tiles') {
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(0, 0, 256, 256);
        for (let y = 0; y < 256; y += 32) {
          for (let x = 0; x < 256; x += 32) {
            const isAlt = ((x / 32) + (y / 32)) % 2 === 0;
            ctx.fillStyle = isAlt ? '#f8fafc' : '#cbd5e1';
            ctx.fillRect(x + 1, y + 1, 30, 30);
          }
        }
      } else if (type === 'metal') {
        ctx.fillStyle = '#d4d4d8';
        ctx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 350; i++) {
          ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
          ctx.fillRect(0, Math.random() * 256, 256, 1);
        }
      }

      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repeatX, repeatY);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }

    const texWood = createProceduralTexture('wood', 2, 2);
    const texShingles = createProceduralTexture('shingles', 4, 4);
    const texStone = createProceduralTexture('stone', 3, 2);
    const texTiles = createProceduralTexture('tiles', 4, 4);
    const texMetal = createProceduralTexture('metal', 1, 2);

    const archMats = {
      roof: new THREE.MeshStandardMaterial({ color: 0xb91c1c, map: texShingles, bumpMap: texShingles, bumpScale: 0.04, roughness: 0.65 }),
      wallExt: new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.85 }),
      wallWood: new THREE.MeshStandardMaterial({ color: 0xb47b44, map: texWood, bumpMap: texWood, bumpScale: 0.025, roughness: 0.78 }),
      stone: new THREE.MeshStandardMaterial({ color: 0x94a3b8, map: texStone, bumpMap: texStone, bumpScale: 0.04, roughness: 0.88 }),
      marble: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25, metalness: 0.08 }),
      floorWood: new THREE.MeshStandardMaterial({ color: 0x9a6332, map: texWood, bumpMap: texWood, bumpScale: 0.02, roughness: 0.72 }),
      floorTile: new THREE.MeshStandardMaterial({ map: texTiles, bumpMap: texTiles, bumpScale: 0.015, roughness: 0.35 }),
      timber: new THREE.MeshStandardMaterial({ color: 0x451a03, map: texWood, roughness: 0.8 }),
      glass: new THREE.MeshStandardMaterial({ color: 0xbae6fd, emissive: 0x38bdf8, emissiveIntensity: 0.25, roughness: 0.1, metalness: 0.2 }),
      lanternGlow: new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xf59e0b, emissiveIntensity: 1.2, roughness: 0.2 }),
      brass: new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.85, roughness: 0.22 }),
      fabricRed: new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.85 }),
      fabricBlue: new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.85 }),
      fabricCream: new THREE.MeshStandardMaterial({ color: 0xfef9c3, roughness: 0.85 }),
      porcelain: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, metalness: 0.05 }),
      foliage: new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.78, flatShading: true }),
      foliageDark: new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.82, flatShading: true }),
      farmSoil: new THREE.MeshStandardMaterial({ color: 0x5c3419, map: texWood, bumpMap: texWood, bumpScale: 0.035, roughness: 0.95 }),
      water: new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.12, metalness: 0.15 })
    };

    const weaponMats = {
      blade: new THREE.MeshStandardMaterial({ color: 0xf1f5f9, map: texMetal, bumpMap: texMetal, bumpScale: 0.012, metalness: 0.88, roughness: 0.18 }),
      accentMetal: new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.24 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x7c4a27, map: texWood, bumpMap: texWood, bumpScale: 0.025, roughness: 0.78 }),
      leather: new THREE.MeshStandardMaterial({ color: 0x3b1d0e, roughness: 0.88 }),
      gem: new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.95, roughness: 0.1, metalness: 0.2 }),
      string: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 })
    };

    const accMats = {
      primaryMetal: new THREE.MeshStandardMaterial({ color: 0xfbbf24, map: texMetal, bumpMap: texMetal, bumpScale: 0.012, metalness: 0.90, roughness: 0.18 }),
      secondaryMetal: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, map: texMetal, bumpMap: texMetal, bumpScale: 0.01, metalness: 0.88, roughness: 0.20 }),
      velvet: new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.90 }),
      leather: new THREE.MeshStandardMaterial({ color: 0x78350f, map: texWood, bumpMap: texWood, bumpScale: 0.02, roughness: 0.78 }),
      gemMain: new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x991b1b, emissiveIntensity: 0.85, roughness: 0.10, metalness: 0.25 }),
      gemAlt: new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.85, roughness: 0.10, metalness: 0.25 }),
      darkSlit: new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.95 })
    };

    function enableShadows(obj) {
      obj.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
    }

    // =========================================================
    // 3. مكتبة المباني المطورة بفتحات أبواب داخلية
    // =========================================================
    function createClosedGableRoof(width, depth, height, wallMat = archMats.wallExt) {
      const roofGroup = new THREE.Group();
      roofGroup.name = 'Roof_Group';
      roofGroup.userData.isRoof = true;

      const gableShape = new THREE.Shape();
      gableShape.moveTo(-width / 2, 0);
      gableShape.lineTo(0, height);
      gableShape.lineTo(width / 2, 0);
      gableShape.closePath();

      const gableGeom = new THREE.ExtrudeGeometry(gableShape, { depth: depth - 0.04, bevelEnabled: false });
      gableGeom.translate(0, 0, -(depth - 0.04) / 2);
      roofGroup.add(new THREE.Mesh(gableGeom, wallMat));

      const overhang = 0.30;
      const slopeLen = Math.hypot(width / 2, height) + overhang;
      const angle = Math.atan2(height, width / 2);

      [-1, 1].forEach((side) => {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(slopeLen, 0.14, depth + overhang * 1.6), archMats.roof);
        panel.position.set(side * (width / 4), height / 2 + 0.04, 0);
        panel.rotation.z = -side * angle;
        roofGroup.add(panel);
      });

      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, depth + overhang * 1.7), archMats.timber);
      ridge.position.set(0, height + 0.08, 0);
      roofGroup.add(ridge);
      return roofGroup;
    }

    function createHippedRoof(width, depth, height) {
      const roofGroup = new THREE.Group();
      roofGroup.name = 'Roof_Group';
      roofGroup.userData.isRoof = true;
      const geo = new THREE.ConeGeometry(1, height, 4);
      geo.rotateY(Math.PI / 4);
      const mesh = new THREE.Mesh(geo, archMats.roof);
      mesh.scale.set((width + 0.48) * 0.72, 1, (depth + 0.48) * 0.72);
      mesh.position.y = height / 2;
      roofGroup.add(mesh);
      return roofGroup;
    }

    function createWallWithDoorway(length, height, thick, doorOffset = 0, doorW = 0.68, doorH = 1.25, mat = archMats.wallExt) {
      const g = new THREE.Group();
      const leftLen = (length / 2 + doorOffset) - doorW / 2;
      const rightLen = (length / 2 - doorOffset) - doorW / 2;
      if (leftLen > 0.05) {
        const leftWall = new THREE.Mesh(new THREE.BoxGeometry(leftLen, height, thick), mat);
        leftWall.position.set(-length / 2 + leftLen / 2, height / 2, 0);
        g.add(leftWall);
      }
      if (rightLen > 0.05) {
        const rightWall = new THREE.Mesh(new THREE.BoxGeometry(rightLen, height, thick), mat);
        rightWall.position.set(length / 2 - rightLen / 2, height / 2, 0);
        g.add(rightWall);
      }
      const headerH = height - doorH;
      if (headerH > 0.04) {
        const header = new THREE.Mesh(new THREE.BoxGeometry(doorW, headerH, thick), mat);
        header.position.set(doorOffset, doorH + headerH / 2, 0);
        g.add(header);
      }
      const postL = new THREE.Mesh(new THREE.BoxGeometry(0.06, doorH, thick + 0.03), archMats.timber);
      postL.position.set(doorOffset - doorW / 2, doorH / 2, 0);
      const postR = new THREE.Mesh(new THREE.BoxGeometry(0.06, doorH, thick + 0.03), archMats.timber);
      postR.position.set(doorOffset + doorW / 2, doorH / 2, 0);
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.12, 0.07, thick + 0.03), archMats.timber);
      lintel.position.set(doorOffset, doorH, 0);
      g.add(postL, postR, lintel);
      return g;
    }

    function addWindow(parent, x, y, z, rotY = 0, w = 0.65, h = 0.75) {
      const wg = new THREE.Group();
      wg.position.set(x, y, z);
      wg.rotation.y = rotY;
      wg.add(new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, h + 0.12, 0.14), archMats.timber));
      wg.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.16), archMats.glass));
      wg.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, h, 0.18), archMats.timber));
      wg.add(new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, 0.18), archMats.timber));
      const sill = new THREE.Mesh(new THREE.BoxGeometry(w + 0.20, 0.07, 0.24), archMats.stone);
      sill.position.set(0, -h / 2 - 0.05, 0.04);
      wg.add(sill);
      parent.add(wg);
    }

    function addDoor(parent, x, y, z, rotY = 0, w = 0.78, h = 1.35) {
      const dg = new THREE.Group();
      dg.position.set(x, y, z);
      dg.rotation.y = rotY;
      dg.add(new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, h + 0.10, 0.16), archMats.timber));
      dg.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.18), archMats.wallWood));
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), archMats.brass);
      knob.position.set(w * 0.34, -0.05, 0.11);
      dg.add(knob);
      parent.add(dg);
    }

    function addWallLantern(parent, x, y, z) {
      const lg = new THREE.Group();
      lg.position.set(x, y, z);
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.22), archMats.timber);
      const bulb = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), archMats.lanternGlow);
      bulb.position.set(0, -0.10, 0.12);
      lg.add(bracket, bulb);
      parent.add(lg);
    }

    function createBookshelf() {
      const g = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.32, 0.28), archMats.timber);
      frame.position.y = 0.66;
      g.add(frame);
      [0.35, 0.72, 1.08].forEach((y, idx) => {
        const books = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.20, 0.22), idx % 2 === 0 ? archMats.fabricRed : archMats.fabricBlue);
        books.position.set(0, y, 0.04);
        g.add(books);
      });
      return g;
    }

    function createBed(isDouble = false, blanketMat = archMats.fabricRed) {
      const g = new THREE.Group();
      const w = isDouble ? 1.25 : 0.78, d = 1.55;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(w, 0.24, d), archMats.timber);
      frame.position.y = 0.12;
      const headboard = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.68, 0.10), archMats.timber);
      headboard.position.set(0, 0.34, -d / 2 + 0.04);
      const mattress = new THREE.Mesh(new THREE.BoxGeometry(w - 0.08, 0.18, d - 0.12), archMats.porcelain);
      mattress.position.set(0, 0.30, 0.03);
      const quilt = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, 0.20, d * 0.65), blanketMat);
      quilt.position.set(0, 0.31, 0.22);
      g.add(frame, headboard, mattress, quilt);
      const pillowCount = isDouble ? 2 : 1;
      for (let i = 0; i < pillowCount; i++) {
        const px = isDouble ? (i === 0 ? -0.30 : 0.30) : 0;
        const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.10, 0.26), archMats.fabricCream);
        pillow.position.set(px, 0.42, -d / 2 + 0.26);
        g.add(pillow);
      }
      return g;
    }

    function createSofa(width = 1.45, mat = archMats.fabricBlue) {
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(width, 0.26, 0.68), mat);
      base.position.y = 0.13;
      const back = new THREE.Mesh(new THREE.BoxGeometry(width, 0.56, 0.16), mat);
      back.position.set(0, 0.28, -0.26);
      g.add(base, back);
      [-width / 2 + 0.08, width / 2 - 0.08].forEach(x => {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.38, 0.68), mat);
        arm.position.set(x, 0.19, 0);
        g.add(arm);
      });
      return g;
    }

    function createKitchenCounter(width = 1.6) {
      const g = new THREE.Group();
      const cabinet = new THREE.Mesh(new THREE.BoxGeometry(width, 0.62, 0.56), archMats.wallWood);
      cabinet.position.y = 0.31;
      const counterTop = new THREE.Mesh(new THREE.BoxGeometry(width + 0.04, 0.06, 0.60), archMats.marble);
      counterTop.position.y = 0.64;
      const sink = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.34), archMats.stone);
      sink.position.set(-width * 0.24, 0.66, 0);
      const stove = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.04, 0.42), archMats.timber);
      stove.position.set(width * 0.24, 0.66, 0);
      g.add(cabinet, counterTop, sink, stove);
      return g;
    }

    function createDiningSet() {
      const g = new THREE.Group();
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.07, 0.72), archMats.wallWood);
      top.position.y = 0.52;
      g.add(top);
      [[-0.42, -0.28], [0.42, -0.28], [-0.42, 0.28], [0.42, 0.28]].forEach(([x, z]) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.52, 0.07), archMats.timber);
        leg.position.set(x, 0.26, z);
        g.add(leg);
      });
      [-0.55, 0.55].forEach(z => {
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.36), archMats.timber);
        seat.position.set(0, 0.30, z);
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.06), archMats.timber);
        back.position.set(0, 0.48, z + (z > 0 ? 0.15 : -0.15));
        g.add(seat, back);
      });
      return g;
    }

    function createBathroomSet(withTub = true) {
      const g = new THREE.Group();
      const toiletBase = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.42), archMats.porcelain);
      toiletBase.position.set(-0.38, 0.16, -0.28);
      const tank = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.52, 0.16), archMats.porcelain);
      tank.position.set(-0.38, 0.34, -0.44);
      const vanity = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.54, 0.38), archMats.wallWood);
      vanity.position.set(0.28, 0.27, -0.32);
      const basin = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.08, 0.40), archMats.porcelain);
      basin.position.set(0.28, 0.56, -0.32);
      g.add(toiletBase, tank, vanity, basin);
      if (withTub) {
        const tubOuter = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.42, 0.56), archMats.porcelain);
        tubOuter.position.set(0, 0.21, 0.34);
        const tubWater = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.36, 0.42), archMats.water);
        tubWater.position.set(0, 0.23, 0.34);
        g.add(tubOuter, tubWater);
      }
      return g;
    }

    const buildingBuilders = {
      cottage() {
        const g = new THREE.Group();
        g.name = 'Furnished_Cottage_V2';
        const W = 3.4, D = 2.8, H = 1.65;
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 0.24, D + 1.05), archMats.stone);
        plinth.position.set(0, 0.12, 0.36);
        const floor = new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, 0.06, D - 0.1), archMats.floorWood);
        floor.position.y = 0.25;
        g.add(plinth, floor);

        const wallsGroup = new THREE.Group();
        wallsGroup.userData.isWallGroup = true;
        wallsGroup.position.y = 0.24;
        const t = 0.14;
        const backW = new THREE.Mesh(new THREE.BoxGeometry(W, H, t), archMats.wallWood);
        backW.position.set(0, H / 2, -D / 2 + t / 2);
        const frontW = new THREE.Mesh(new THREE.BoxGeometry(W, H, t), archMats.wallWood);
        frontW.position.set(0, H / 2, D / 2 - t / 2);
        const leftW = new THREE.Mesh(new THREE.BoxGeometry(t, H, D - t * 2), archMats.wallWood);
        leftW.position.set(-W / 2 + t / 2, H / 2, 0);
        const rightW = new THREE.Mesh(new THREE.BoxGeometry(t, H, D - t * 2), archMats.wallWood);
        rightW.position.set(W / 2 - t / 2, H / 2, 0);
        wallsGroup.add(backW, frontW, leftW, rightW);

        addDoor(wallsGroup, -0.60, 0.68, D / 2, 0);
        addWindow(wallsGroup, 0.70, 0.85, D / 2, 0);
        addWindow(wallsGroup, W / 2, 0.85, 0, Math.PI / 2);
        addWindow(wallsGroup, -W / 2, 0.85, 0, -Math.PI / 2);
        addWallLantern(wallsGroup, -1.25, 1.15, D / 2 + 0.05);
        g.add(wallsGroup);

        [-1.55, 0.05, 1.55].forEach(px => {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.11, H, 0.11), archMats.timber);
          post.position.set(px, 0.24 + H / 2, D / 2 + 0.75);
          g.add(post);
        });
        const rail = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.08), archMats.timber);
        rail.position.set(0.80, 0.65, D / 2 + 0.75);
        g.add(rail);

        const interior = new THREE.Group();
        interior.name = 'Interior_Furniture';
        interior.position.y = 0.28;
        const bed = createBed(false, archMats.fabricRed);
        bed.position.set(-1.05, 0, -0.45);
        const shelf = createBookshelf();
        shelf.position.set(-1.15, 0, 0.85);
        shelf.rotation.y = Math.PI / 2;
        const kitchen = createKitchenCounter(1.3);
        kitchen.position.set(0.82, 0, -0.95);
        const dining = createDiningSet();
        dining.position.set(0.75, 0, 0.38);
        const rug = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.02, 0.85), archMats.fabricCream);
        rug.position.set(-0.35, 0.01, 0.55);
        interior.add(bed, shelf, kitchen, dining, rug);
        g.add(interior);

        const roof = createClosedGableRoof(W + 0.1, D + 0.9, 1.15, archMats.wallWood);
        roof.position.set(0, 0.24 + H, 0.35);
        const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.45, 0.45), archMats.stone);
        chimney.position.set(1.05, 0.72, -0.75);
        const chimneyCap = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.12, 0.56), archMats.timber);
        chimneyCap.position.set(1.05, 1.48, -0.75);
        roof.add(chimney, chimneyCap);
        g.add(roof);
        enableShadows(g);
        return g;
      },

      shop() {
        const g = new THREE.Group();
        g.name = 'Village_Shop_V2';
        const W = 4.2, D = 3.2, H = 1.85;
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 0.24, D + 0.8), archMats.stone);
        plinth.position.set(0, 0.12, 0.25);
        const floor = new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, 0.06, D - 0.1), archMats.floorTile);
        floor.position.y = 0.25;
        g.add(plinth, floor);

        const wallsGroup = new THREE.Group();
        wallsGroup.userData.isWallGroup = true;
        wallsGroup.position.y = 0.24;
        const t = 0.15;
        const backW = new THREE.Mesh(new THREE.BoxGeometry(W, H, t), archMats.wallExt);
        backW.position.set(0, H / 2, -D / 2 + t / 2);
        const frontW = new THREE.Mesh(new THREE.BoxGeometry(W, H, t), archMats.wallExt);
        frontW.position.set(0, H / 2, D / 2 - t / 2);
        const leftW = new THREE.Mesh(new THREE.BoxGeometry(t, H, D - t * 2), archMats.wallExt);
        leftW.position.set(-W / 2 + t / 2, H / 2, 0);
        const rightW = new THREE.Mesh(new THREE.BoxGeometry(t, H, D - t * 2), archMats.wallExt);
        rightW.position.set(W / 2 - t / 2, H / 2, 0);
        wallsGroup.add(backW, frontW, leftW, rightW);

        addDoor(wallsGroup, 0, 0.68, D / 2, 0, 0.95, 1.38);
        addWindow(wallsGroup, -1.25, 0.9, D / 2, 0, 0.95, 0.85);
        addWindow(wallsGroup, 1.25, 0.9, D / 2, 0, 0.95, 0.85);
        addWallLantern(wallsGroup, -0.65, 1.25, D / 2 + 0.05);
        addWallLantern(wallsGroup, 0.65, 1.25, D / 2 + 0.05);
        g.add(wallsGroup);

        for (let i = 0; i < 8; i++) {
          const seg = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.78), i % 2 === 0 ? archMats.roof : archMats.porcelain);
          seg.position.set(-1.61 + i * 0.46, 1.55, D / 2 + 0.36);
          seg.rotation.x = 0.28;
          g.add(seg);
        }

        const interior = new THREE.Group();
        interior.name = 'Interior_Furniture';
        interior.position.y = 0.28;
        const counter = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 0.55), archMats.wallWood);
        counter.position.set(-1.0, 0.325, 0.25);
        const register = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.26), archMats.brass);
        register.position.set(-1.2, 0.77, 0.25);
        interior.add(counter, register);

        [-1.2, 0, 1.2].forEach((sx, idx) => {
          const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.90, 1.28, 0.35), archMats.timber);
          shelf.position.set(sx, 0.64, -1.20);
          interior.add(shelf);
          [0.45, 0.85, 1.15].forEach((sy, rIdx) => {
            const box = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.18, 0.24), (idx + rIdx) % 2 === 0 ? archMats.fabricRed : archMats.fabricBlue);
            box.position.set(sx, sy, -1.18);
            interior.add(box);
          });
        });
        const displayTbl = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.52, 0.78), archMats.wallWood);
        displayTbl.position.set(1.0, 0.26, 0.35);
        interior.add(displayTbl);
        g.add(interior);

        const roof = createClosedGableRoof(W + 0.1, D + 0.1, 1.2, archMats.wallExt);
        roof.position.y = 0.24 + H;
        const sign = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.44, 0.12), archMats.timber);
        sign.position.set(0, 0.45, D / 2 + 0.08);
        roof.add(sign);
        g.add(roof);
        enableShadows(g);
        return g;
      },

      villa() {
        const g = new THREE.Group();
        g.name = 'Full_Furnished_Villa_V2';
        const W = 6.2, D = 5.0, H = 1.90;
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 0.26, D + 0.65), archMats.stone);
        plinth.position.set(0, 0.13, 0.18);
        const mainFloor = new THREE.Mesh(new THREE.BoxGeometry(W - 0.12, 0.06, D - 0.12), archMats.floorWood);
        mainFloor.position.y = 0.27;
        const bathMainFloor = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.07, 1.65), archMats.floorTile);
        bathMainFloor.position.set(-2.15, 0.275, -1.55);
        const bathGuestFloor = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.07, 1.45), archMats.floorTile);
        bathGuestFloor.position.set(2.25, 0.275, 1.65);
        const kitchenFloor = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.07, 1.95), archMats.floorTile);
        kitchenFloor.position.set(1.85, 0.275, -1.45);
        g.add(plinth, mainFloor, bathMainFloor, bathGuestFloor, kitchenFloor);

        const wallsGroup = new THREE.Group();
        wallsGroup.userData.isWallGroup = true;
        wallsGroup.position.y = 0.26;
        const t = 0.15;
        const backW = new THREE.Mesh(new THREE.BoxGeometry(W, H, t), archMats.wallExt);
        backW.position.set(0, H / 2, -D / 2 + t / 2);
        const frontW = new THREE.Mesh(new THREE.BoxGeometry(W, H, t), archMats.wallExt);
        frontW.position.set(0, H / 2, D / 2 - t / 2);
        const leftW = new THREE.Mesh(new THREE.BoxGeometry(t, H, D - t * 2), archMats.wallExt);
        leftW.position.set(-W / 2 + t / 2, H / 2, 0);
        const rightW = new THREE.Mesh(new THREE.BoxGeometry(t, H, D - t * 2), archMats.wallExt);
        rightW.position.set(W / 2 - t / 2, H / 2, 0);
        wallsGroup.add(backW, frontW, leftW, rightW);

        addDoor(wallsGroup, 0, 0.68, D / 2, 0, 1.0, 1.42);
        addWindow(wallsGroup, -1.55, 0.92, D / 2, 0, 0.95, 0.85);
        addWindow(wallsGroup, 1.35, 0.92, D / 2, 0, 0.85, 0.85);
        addWindow(wallsGroup, -W / 2, 0.92, 0.75, -Math.PI / 2, 0.95, 0.85);
        addWindow(wallsGroup, W / 2, 0.92, -0.75, Math.PI / 2, 0.95, 0.85);
        addWallLantern(wallsGroup, -0.72, 1.30, D / 2 + 0.05);
        addWallLantern(wallsGroup, 0.72, 1.30, D / 2 + 0.05);

        const pH = 1.65, pT = 0.11;
        const bathMainWallZ = createWallWithDoorway(1.85, pH, pT, 0.35, 0.62, 1.25);
        bathMainWallZ.position.set(-2.10, 0, -0.68);
        const bathMainWallX = new THREE.Mesh(new THREE.BoxGeometry(pT, pH, 1.75), archMats.wallExt);
        bathMainWallX.position.set(-1.18, pH / 2, -1.55);

        const masterBedWallX = createWallWithDoorway(2.35, pH, pT, -0.45, 0.68, 1.28);
        masterBedWallX.rotation.y = Math.PI / 2;
        masterBedWallX.position.set(-1.10, 0, 1.25);
        const masterBedWallZ = new THREE.Mesh(new THREE.BoxGeometry(1.90, pH, pT), archMats.wallExt);
        masterBedWallZ.position.set(-2.05, pH / 2, 0.10);

        const kitchenWallX = createWallWithDoorway(1.95, pH, pT, 0.15, 0.95, 1.35);
        kitchenWallX.rotation.y = Math.PI / 2;
        kitchenWallX.position.set(0.68, 0, -1.45);

        const guestSuiteWallZ = createWallWithDoorway(2.35, pH, pT, -0.45, 0.68, 1.28);
        guestSuiteWallZ.position.set(1.85, 0, 0.25);
        const guestBathWallX = createWallWithDoorway(1.55, pH, pT, 0.15, 0.58, 1.22);
        guestBathWallX.rotation.y = Math.PI / 2;
        guestBathWallX.position.set(1.48, 0, 1.65);

        wallsGroup.add(bathMainWallZ, bathMainWallX, masterBedWallX, masterBedWallZ, kitchenWallX, guestSuiteWallZ, guestBathWallX);
        g.add(wallsGroup);

        const interior = new THREE.Group();
        interior.name = 'Interior_Furniture';
        interior.position.y = 0.30;

        const mainBath = createBathroomSet(true);
        mainBath.position.set(-2.15, 0, -1.55);
        const masterBed = createBed(true, archMats.fabricRed);
        masterBed.position.set(-2.05, 0, 1.55);
        masterBed.rotation.y = Math.PI / 2;
        const wardrobe = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.38, 1.05), archMats.timber);
        wardrobe.position.set(-2.72, 0.69, 0.65);

        const rug = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.02, 1.55), archMats.fabricRed);
        rug.position.set(-0.15, 0.01, 0.25);
        const sofa = createSofa(1.55, archMats.fabricBlue);
        sofa.position.set(-0.18, 0, -0.55);
        const coffeeTbl = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.24, 0.48), archMats.timber);
        coffeeTbl.position.set(-0.18, 0.12, 0.15);
        const salonShelf = createBookshelf();
        salonShelf.position.set(-0.18, 0, -2.22);

        const kitchen = createKitchenCounter(1.95);
        kitchen.position.set(1.85, 0, -2.08);
        const fridge = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.38, 0.55), archMats.porcelain);
        fridge.position.set(2.68, 0.69, -1.45);
        const dining = createDiningSet();
        dining.position.set(1.75, 0, -0.75);

        const guestBed = createBed(false, archMats.fabricBlue);
        guestBed.position.set(2.25, 0, 0.85);
        guestBed.rotation.y = -Math.PI / 2;
        const guestBath = createBathroomSet(false);
        guestBath.scale.set(0.85, 1, 0.85);
        guestBath.position.set(2.25, 0, 1.75);

        interior.add(mainBath, masterBed, wardrobe, rug, sofa, coffeeTbl, salonShelf, kitchen, fridge, dining, guestBed, guestBath);
        g.add(interior);

        const roof = createHippedRoof(W, D, 1.40);
        roof.position.y = 0.26 + H;
        g.add(roof);
        enableShadows(g);
        return g;
      },

      palace() {
        const g = new THREE.Group();
        g.name = 'Grand_Royal_Palace_V2';
        const W = 7.6, D = 5.8, H = 2.35;
        const step1 = new THREE.Mesh(new THREE.BoxGeometry(W + 0.8, 0.22, D + 1.2), archMats.marble);
        step1.position.set(0, 0.11, 0.35);
        const step2 = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 0.22, D + 0.6), archMats.marble);
        step2.position.set(0, 0.33, 0.2);
        const floor = new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, 0.06, D - 0.1), archMats.floorTile);
        floor.position.y = 0.45;
        g.add(step1, step2, floor);

        const wallsGroup = new THREE.Group();
        wallsGroup.userData.isWallGroup = true;
        wallsGroup.position.y = 0.44;
        const t = 0.18;
        const backW = new THREE.Mesh(new THREE.BoxGeometry(W, H, t), archMats.marble);
        backW.position.set(0, H / 2, -D / 2 + t / 2);
        const frontW = new THREE.Mesh(new THREE.BoxGeometry(W, H, t), archMats.marble);
        frontW.position.set(0, H / 2, D / 2 - t / 2);
        const leftW = new THREE.Mesh(new THREE.BoxGeometry(t, H, D - t * 2), archMats.marble);
        leftW.position.set(-W / 2 + t / 2, H / 2, 0);
        const rightW = new THREE.Mesh(new THREE.BoxGeometry(t, H, D - t * 2), archMats.marble);
        rightW.position.set(W / 2 - t / 2, H / 2, 0);

        const leftWingWall = createWallWithDoorway(5.2, 2.0, 0.14, 0.4, 1.05, 1.55, archMats.marble);
        leftWingWall.rotation.y = Math.PI / 2;
        leftWingWall.position.set(-1.35, 0, 0);
        const rightWingWall = createWallWithDoorway(5.2, 2.0, 0.14, 0.4, 1.05, 1.55, archMats.marble);
        rightWingWall.rotation.y = Math.PI / 2;
        rightWingWall.position.set(1.35, 0, 0);
        wallsGroup.add(backW, frontW, leftW, rightW, leftWingWall, rightWingWall);

        addDoor(wallsGroup, 0, 0.85, D / 2, 0, 1.3, 1.7);
        [-2.3, 2.3].forEach(x => addWindow(wallsGroup, x, 1.15, D / 2, 0, 1.0, 1.15));
        addWallLantern(wallsGroup, -0.95, 1.55, D / 2 + 0.06);
        addWallLantern(wallsGroup, 0.95, 1.55, D / 2 + 0.06);
        g.add(wallsGroup);

        [-2.9, -1.65, -0.8, 0.8, 1.65, 2.9].forEach(x => {
          const col = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, H, 12), archMats.porcelain);
          col.position.set(x, 0.44 + H / 2, D / 2 + 0.35);
          g.add(col);
        });

        const interior = new THREE.Group();
        interior.name = 'Interior_Furniture';
        interior.position.y = 0.48;
        const carpet = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.02, 4.6), archMats.fabricRed);
        carpet.position.set(0, 0.01, 0.3);
        const dais = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.22, 1.2), archMats.marble);
        dais.position.set(0, 0.11, -2.1);
        const throneSeat = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.45, 0.65), archMats.brass);
        throneSeat.position.set(0, 0.44, -2.15);
        const throneBack = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.35, 0.16), archMats.brass);
        throneBack.position.set(0, 0.90, -2.40);
        const throneCushion = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 0.55), archMats.fabricRed);
        throneCushion.position.set(0, 0.68, -2.12);
        const banquetTbl = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.58, 2.8), archMats.wallWood);
        banquetTbl.position.set(2.45, 0.29, -0.4);
        interior.add(carpet, dais, throneSeat, throneBack, throneCushion, banquetTbl);

        [-1.3, -0.4, 0.5].forEach(z => {
          const ch1 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.48, 0.35), archMats.brass);
          ch1.position.set(1.7, 0.24, z);
          const ch2 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.48, 0.35), archMats.brass);
          ch2.position.set(3.2, 0.24, z);
          interior.add(ch1, ch2);
        });

        const royalBed = createBed(true, archMats.fabricRed);
        royalBed.scale.set(1.2, 1.1, 1.2);
        royalBed.position.set(-2.55, 0, -1.45);
        const royalBath = createBathroomSet(true);
        royalBath.position.set(-2.55, 0, 1.55);
        const fountainRim = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.32, 16), archMats.marble);
        fountainRim.position.set(2.45, 0.16, 1.75);
        const fountainWater = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.34, 16), archMats.water);
        fountainWater.position.set(2.45, 0.16, 1.75);
        interior.add(royalBed, royalBath, fountainRim, fountainWater);
        g.add(interior);

        const roof = createHippedRoof(W, D, 1.45);
        roof.position.y = 0.44 + H;
        const dome = new THREE.Mesh(new THREE.SphereGeometry(1.15, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), archMats.roof);
        dome.position.y = 1.25;
        const spire = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.85, 8), archMats.brass);
        spire.position.y = 2.65;
        roof.add(dome, spire);
        g.add(roof);
        enableShadows(g);
        return g;
      }
    };

    // =========================================================
    // 4. قسم الأسلحة والأدوات (11 سلاح وأداة)
    // =========================================================
    const weaponBuilders = {
      sword() {
        const g = new THREE.Group();
        g.name = 'HighDetail_Rune_Sword';
        const W = 0.25, W2 = 0.18, T = 0.075, T2 = 0.045, L1 = 1.75, L2 = 2.28;
        const BR0=[W,0,0], BL0=[-W,0,0], FR0=[0,0,T], BK0=[0,0,-T];
        const BR1=[W2,L1,0], BL1=[-W2,L1,0], FR1=[0,L1,T2], BK1=[0,L1,-T2];
        const TIP=[0,L2,0];
        const pos = [
          ...BR0,...BR1,...FR1, ...BR0,...FR1,...FR0, ...BR1,...TIP,...FR1,
          ...BL0,...FR0,...FR1, ...BL0,...FR1,...BL1, ...FR1,...TIP,...BL1,
          ...BL0,...BL1,...BK1, ...BL0,...BK1,...BK0, ...BL1,...TIP,...BK1,
          ...BR0,...BK0,...BK1, ...BR0,...BK1,...BR1, ...BK1,...TIP,...BR1,
          ...BR0,...FR0,...BL0, ...BR0,...BL0,...BK0
        ];
        const bladeGeo = new THREE.BufferGeometry();
        bladeGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        bladeGeo.computeVertexNormals();
        g.add(new THREE.Mesh(bladeGeo, weaponMats.blade));
        const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.48, 0.13), weaponMats.accentMetal);
        fuller.position.y = 0.82;
        g.add(fuller);
        [0.45, 0.82, 1.18].forEach(ry => {
          const rune = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), weaponMats.gem);
          rune.scale.set(0.8, 1.5, 1.6);
          rune.position.y = ry;
          g.add(rune);
        });
        g.add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.20, 0.26), weaponMats.accentMetal));
        [-1, 1].forEach(s => {
          const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(s * 0.14, 0, 0), new THREE.Vector3(s * 0.45, -0.05, 0), new THREE.Vector3(s * 0.72, 0.08, 0)
          ]);
          g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.065, 10, false), weaponMats.accentMetal));
          const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.095, 0), weaponMats.accentMetal);
          cap.position.set(s * 0.74, 0.10, 0);
          g.add(cap);
        });
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), weaponMats.gem);
        gem.scale.set(0.85, 1.15, 1.4);
        const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.75, 14), weaponMats.leather);
        grip.position.y = -0.45;
        const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 1), weaponMats.accentMetal);
        pommel.position.y = -0.90;
        g.add(gem, grip, pommel);
        enableShadows(g);
        return g;
      },
      bow() {
        const g = new THREE.Group();
        g.name = 'HighDetail_Recurve_Bow';
        const bowCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-0.55, 1.25, 0), new THREE.Vector3(-0.22, 0.92, 0), new THREE.Vector3(0.12, 0.35, 0),
          new THREE.Vector3(0.18, 0.0, 0), new THREE.Vector3(0.12, -0.35, 0), new THREE.Vector3(-0.22, -0.92, 0),
          new THREE.Vector3(-0.55, -1.25, 0)
        ]);
        g.add(new THREE.Mesh(new THREE.TubeGeometry(bowCurve, 28, 0.048, 10, false), weaponMats.wood));
        const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.42, 12), weaponMats.leather);
        grip.position.set(0.17, 0, 0);
        const string = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 2.50, 6), weaponMats.string);
        string.position.set(-0.55, 0, 0);
        const arrowShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.35, 8), weaponMats.wood);
        arrowShaft.rotation.z = Math.PI / 2;
        arrowShaft.position.set(0.08, 0.05, 0);
        const arrowHead = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 4), weaponMats.blade);
        arrowHead.rotation.z = -Math.PI / 2;
        arrowHead.position.set(0.80, 0.05, 0);
        g.add(grip, string, arrowShaft, arrowHead);
        enableShadows(g);
        return g;
      },
      staff() {
        const g = new THREE.Group();
        g.name = 'HighDetail_Arcane_Staff';
        const staffCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, -1.15, 0), new THREE.Vector3(0.05, -0.35, 0.04),
          new THREE.Vector3(-0.04, 0.45, -0.03), new THREE.Vector3(0, 1.05, 0)
        ]);
        g.add(new THREE.Mesh(new THREE.TubeGeometry(staffCurve, 22, 0.058, 10, false), weaponMats.wood));
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.08, 0.22, 12), weaponMats.accentMetal);
        crown.position.y = 1.12;
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), weaponMats.gem);
        crystal.scale.set(0.85, 1.45, 0.85);
        crystal.position.y = 1.52;
        const halo = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.022, 8, 24), weaponMats.accentMetal);
        halo.position.y = 1.52;
        halo.rotation.set(Math.PI / 3, 0.3, 0);
        g.add(crown, crystal, halo);
        enableShadows(g);
        return g;
      },
      hammer() {
        const g = new THREE.Group();
        g.name = 'HighDetail_Warhammer';
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.065, 2.25, 12), weaponMats.wood));
        const headCore = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.46, 0.46), weaponMats.blade);
        headCore.position.y = 0.82;
        g.add(headCore);
        [-0.48, 0.48].forEach(x => {
          const face = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.54, 0.54), weaponMats.accentMetal);
          face.position.set(x, 0.82, 0);
          const rune = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), weaponMats.gem);
          rune.position.set(x * 1.12, 0.82, 0);
          g.add(face, rune);
        });
        enableShadows(g);
        return g;
      },
      daggers() {
        const g = new THREE.Group();
        g.name = 'HighDetail_Twin_Daggers';
        [-0.38, 0.38].forEach((x, idx) => {
          const dg = new THREE.Group();
          const blade = new THREE.Mesh(new THREE.ConeGeometry(0.11, 1.05, 4), weaponMats.blade);
          blade.scale.set(1.2, 1, 0.35);
          blade.position.y = 0.52;
          const guard = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.14), weaponMats.accentMetal);
          const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.042, 0.42, 10), weaponMats.leather);
          grip.position.y = -0.24;
          dg.add(blade, guard, grip);
          dg.position.set(x, 0.1, 0);
          dg.rotation.z = idx === 0 ? 0.22 : -0.22;
          g.add(dg);
        });
        enableShadows(g);
        return g;
      },
      fishingRod() {
        const g = new THREE.Group();
        g.name = 'HighDetail_Fishing_Rod';
        const rodCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-0.35, -1.05, 0), new THREE.Vector3(-0.15, -0.15, 0),
          new THREE.Vector3(0.18, 0.65, 0), new THREE.Vector3(0.65, 1.25, 0)
        ]);
        g.add(new THREE.Mesh(new THREE.TubeGeometry(rodCurve, 24, 0.032, 8, false), weaponMats.wood));
        const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.10, 14), weaponMats.accentMetal);
        reel.rotation.x = Math.PI / 2;
        reel.position.set(-0.16, -0.42, 0.08);
        const line = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.45, 6), weaponMats.string);
        line.position.set(0.65, 0.52, 0);
        const bobber = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), archMats.fabricRed);
        bobber.position.set(0.65, -0.20, 0);
        g.add(reel, line, bobber);
        enableShadows(g);
        return g;
      },
      axe() {
        const g = new THREE.Group();
        g.name = 'HighDetail_Battle_Axe';
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-0.08, -1.1, 0), new THREE.Vector3(-0.02, -0.1, 0), new THREE.Vector3(-0.08, 1.05, 0)
        ]);
        g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 0.075, 12, false), weaponMats.wood));
        const s = new THREE.Shape();
        s.moveTo(-0.36, 0.65); s.lineTo(-0.36, 0.95); s.lineTo(0.06, 0.92);
        s.quadraticCurveTo(0.48, 1.05, 0.88, 1.22); s.quadraticCurveTo(1.06, 0.80, 0.88, 0.38);
        s.quadraticCurveTo(0.48, 0.58, 0.06, 0.68); s.closePath();
        const headGeo = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.045, bevelSize: 0.04, bevelSegments: 3 });
        headGeo.translate(0, 0, -0.025);
        g.add(new THREE.Mesh(headGeo, weaponMats.blade));
        enableShadows(g);
        return g;
      },
      pickaxe() {
        const g = new THREE.Group();
        g.name = 'HighDetail_Pickaxe';
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 2.15, 12), weaponMats.wood));
        const s = new THREE.Shape();
        s.moveTo(-1.18, 0.52); s.quadraticCurveTo(-0.52, 0.92, 0, 0.95); s.quadraticCurveTo(0.52, 0.92, 1.18, 0.52);
        s.quadraticCurveTo(0.50, 0.72, 0, 0.72); s.quadraticCurveTo(-0.50, 0.72, -1.18, 0.52);
        const headGeo = new THREE.ExtrudeGeometry(s, { depth: 0.11, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.035, bevelSegments: 3 });
        headGeo.translate(0, 0, -0.055);
        g.add(new THREE.Mesh(headGeo, weaponMats.blade));
        enableShadows(g);
        return g;
      },
      shield() {
        const g = new THREE.Group();
        g.name = 'HighDetail_Knight_Shield';
        const makeShape = (sc) => {
          const s = new THREE.Shape();
          s.moveTo(0, 1.05 * sc); s.quadraticCurveTo(0.52 * sc, 1.05 * sc, 0.88 * sc, 0.86 * sc);
          s.lineTo(0.84 * sc, 0.12 * sc); s.quadraticCurveTo(0.74 * sc, -0.52 * sc, 0, -1.02 * sc);
          s.quadraticCurveTo(-0.74 * sc, -0.52 * sc, -0.84 * sc, 0.12 * sc); s.lineTo(-0.88 * sc, 0.86 * sc);
          s.quadraticCurveTo(-0.52 * sc, 1.05 * sc, 0, 1.05 * sc);
          return s;
        };
        const rimGeo = new THREE.ExtrudeGeometry(makeShape(1.0), { depth: 0.08, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 3 });
        rimGeo.translate(0, 0, -0.04);
        const bodyGeo = new THREE.ExtrudeGeometry(makeShape(0.85), { depth: 0.07, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
        bodyGeo.translate(0, 0, 0.015);
        const boss = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), weaponMats.accentMetal);
        boss.rotation.x = Math.PI / 2;
        boss.position.set(0, 0.12, 0.10);
        g.add(new THREE.Mesh(rimGeo, weaponMats.blade), new THREE.Mesh(bodyGeo, weaponMats.wood), boss);
        enableShadows(g);
        return g;
      },
      wateringCan() {
        const g = new THREE.Group();
        g.name = 'HighDetail_WateringCan';
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.52, 0.95, 20), weaponMats.blade);
        body.position.y = 0.05;
        const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.13, 0.88, 14), weaponMats.blade);
        spout.position.set(0.62, 0.22, 0);
        spout.rotation.z = -Math.PI / 3.4;
        const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.09, 0.14, 16), weaponMats.accentMetal);
        rose.position.set(0.98, 0.44, 0);
        rose.rotation.z = -Math.PI / 3.4;
        g.add(body, spout, rose);
        enableShadows(g);
        return g;
      },
      shovel() {
        const g = new THREE.Group();
        g.name = 'HighDetail_Shovel';
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.065, 1.75, 12), weaponMats.wood);
        shaft.position.y = 0.12;
        const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.075, 0.30, 12), weaponMats.accentMetal);
        socket.position.y = -0.56;
        const s = new THREE.Shape();
        s.moveTo(-0.34, -0.52); s.lineTo(0.34, -0.52); s.lineTo(0.30, -0.95);
        s.quadraticCurveTo(0.15, -1.16, 0, -1.25); s.quadraticCurveTo(-0.15, -1.16, -0.30, -0.95); s.closePath();
        const bladeGeo = new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
        bladeGeo.translate(0, 0, -0.017);
        g.add(shaft, socket, new THREE.Mesh(bladeGeo, weaponMats.blade));
        enableShadows(g);
        return g;
      }
    };

    // =========================================================
    // 5. قسم الإكسسوارات والزينة 3D
    // =========================================================
    const accessoryBuilders = {
      crown() {
        const g = new THREE.Group();
        g.name = 'HighDetail_Royal_Crown';
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.76, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), accMats.velvet);
        cap.position.y = 0.05;
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.78, 0.36, 24, 1, true), accMats.primaryMetal);
        band.material.side = THREE.DoubleSide;
        band.position.y = 0.12;
        g.add(cap, band);
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2;
          const x = Math.cos(ang) * 0.82, z = Math.sin(ang) * 0.82;
          const spike = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.38, 4), accMats.primaryMetal);
          spike.position.set(x, 0.48, z);
          spike.lookAt(0, 0.48, 0);
          const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.068, 0), i % 2 === 0 ? accMats.gemMain : accMats.gemAlt);
          gem.position.set(Math.cos(ang) * 0.85, 0.12, Math.sin(ang) * 0.85);
          g.add(spike, gem);
        }
        enableShadows(g);
        return g;
      },
      helmet() {
        const g = new THREE.Group();
        g.name = 'HighDetail_Knight_Helmet';
        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.75, 22, 16, 0, Math.PI * 2, 0, Math.PI / 2), accMats.secondaryMetal);
        dome.position.y = 0.25;
        const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.82, 0.68, 22), accMats.secondaryMetal);
        lower.position.y = -0.08;
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.55, 0.26), accMats.secondaryMetal);
        visor.position.set(0, -0.05, 0.68);
        g.add(dome, lower, visor);
        enableShadows(g);
        return g;
      },
      backpack() {
        const g = new THREE.Group();
        g.name = 'HighDetail_Adventurer_Backpack';
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 0.58), accMats.leather);
        const flap = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.34, 0.68), accMats.leather);
        flap.position.set(0, 0.44, 0.02);
        const bedroll = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.18, 16), accMats.velvet);
        bedroll.rotation.z = Math.PI / 2;
        bedroll.position.set(0, 0.74, -0.05);
        g.add(body, flap, bedroll);
        enableShadows(g);
        return g;
      },
      fountain() {
        const g = new THREE.Group();
        g.name = 'HighDetail_Village_Fountain';
        const baseStep = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, 0.16, 8), archMats.stone);
        baseStep.position.y = 0.08;
        const basinOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.92, 0.38, 8), archMats.marble);
        basinOuter.position.y = 0.32;
        const waterLower = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.84, 0.36, 8), archMats.water);
        waterLower.position.y = 0.35;
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.28, 1.45, 14), archMats.marble);
        pillar.position.y = 0.85;
        g.add(baseStep, basinOuter, waterLower, pillar);
        enableShadows(g);
        return g;
      },
      amulet() {
        const g = new THREE.Group();
        g.name = 'HighDetail_Magic_Amulet';
        const outerRing = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.075, 12, 28), accMats.primaryMetal);
        outerRing.position.y = -0.15;
        const coreGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), accMats.gemAlt);
        coreGem.position.y = -0.15;
        g.add(outerRing, coreGem);
        enableShadows(g);
        return g;
      },
      chalice() {
        const g = new THREE.Group();
        g.name = 'HighDetail_Royal_Chalice';
        const profile = [
          new THREE.Vector2(0.0, -0.75), new THREE.Vector2(0.48, -0.75), new THREE.Vector2(0.16, -0.52),
          new THREE.Vector2(0.12, -0.02), new THREE.Vector2(0.56, 0.35), new THREE.Vector2(0.62, 0.85),
          new THREE.Vector2(0.54, 0.85), new THREE.Vector2(0.0, 0.25)
        ];
        g.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 24), accMats.primaryMetal));
        enableShadows(g);
        return g;
      }
    };
  return {
    createProceduralTexture, texWood, texShingles, texStone, texTiles, texMetal,
    archMats, weaponMats, accMats, enableShadows,
    buildingBuilders, weaponBuilders, accessoryBuilders
  };
}
