// NEON BAY round 2 — city generation: roads, blocks, varied buildings,
// glowing neon signs, street props, parked cars, palms, beach and docks.
// My own layout: one canvas ground texture, box buildings with canvas window
// textures, and a small set of emissive neon signs that make the city read
// as NEON BAY at dusk.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makeRng } from './random.js';

// Ground: one big canvas texture — asphalt, sidewalks, lane dashes,
// crosswalks, sand at the south edge and concrete at the east docks.
function paintGround() {
  const S = 2048;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const g = cv.getContext('2d');
  const px = (x) => ((x + 270) / 560) * S;
  const pz = (z) => ((z + 225) / 560) * S;
  const m = S / 560;
  g.fillStyle = '#2e2e3a';
  g.fillRect(0, 0, S, S);
  // Sidewalk blocks.
  g.fillStyle = '#6e6e7c';
  for (let bx = -3; bx <= 3; bx++) {
    for (let bz = -3; bz <= 3; bz++) {
      const cx = bx * CFG.pitch;
      const cz = bz * CFG.pitch;
      g.fillRect(px(cx - CFG.blockHalf), pz(cz - CFG.blockHalf), CFG.blockHalf * 2 * m, CFG.blockHalf * 2 * m);
    }
  }
  // Roads: darker asphalt strips with centre dashes.
  g.fillStyle = '#42424f';
  g.strokeStyle = '#d8c95a';
  g.lineWidth = 2;
  g.setLineDash([14, 18]);
  for (const r of CFG.roads) {
    g.fillRect(px(r - CFG.roadHalf), 0, CFG.roadHalf * 2 * m, S);
    g.fillRect(0, pz(r - CFG.roadHalf), S, CFG.roadHalf * 2 * m);
    g.beginPath(); g.moveTo(px(r), 0); g.lineTo(px(r), S); g.stroke();
    g.beginPath(); g.moveTo(0, pz(r)); g.lineTo(S, pz(r)); g.stroke();
  }
  g.setLineDash([]);
  // Crosswalks at the central junctions.
  g.fillStyle = '#cfcfd8';
  for (const rx of [-29, 29, 87]) {
    for (const rz of [-29, 29, 87]) {
      for (let i = -3; i <= 3; i++) {
        g.fillRect(px(rx + i * 2 - 0.7), pz(rz - 5), 1.4 * m, 10 * m);
      }
    }
  }
  // Sand and water edge at the south, dock concrete at the east.
  g.fillStyle = '#d9b380';
  g.fillRect(0, pz(CFG.beachZ), S, S - pz(CFG.beachZ));
  g.fillStyle = '#3a3a44';
  g.fillRect(px(CFG.dockX), 0, S - px(CFG.dockX), S);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Lit windows for one building: a canvas texture, warm and cool lights mixed.
function paintWindows(seedRng, tint) {
  const W = 128;
  const H = 256;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = tint;
  g.fillRect(0, 0, W, H);
  const lit = ['#ffd23c', '#2ee6ff', '#ff9a5a', '#fff2c8', '#7cff9a'];
  for (let y = 10; y < H - 12; y += 18) {
    for (let x = 8; x < W - 10; x += 16) {
      if (seedRng.next() < 0.42) {
        g.fillStyle = lit[Math.floor(seedRng.next() * lit.length)];
        g.globalAlpha = 0.75 + seedRng.next() * 0.25;
        g.fillRect(x, y, 10, 12);
      } else {
        g.fillStyle = '#1a1a26';
        g.globalAlpha = 1;
        g.fillRect(x, y, 10, 12);
      }
    }
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function hexCss(hex) {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

export function buildCity(scene, seed) {
  const rng = makeRng(seed);
  const group = new THREE.Group();
  scene.add(group);
  const colliders = [];

  // Ground plane.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 560),
    new THREE.MeshLambertMaterial({ map: paintGround() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(10, 0, 55);
  group.add(ground);

  // Water at the south edge, animated by the main loop.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 130),
    new THREE.MeshLambertMaterial({ color: CFG.colors.water, transparent: true, opacity: 0.92 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(10, 0.12, CFG.waterZ + 65);
  group.add(water);

  const palette = CFG.colors.buildingPalette;
  const neon = CFG.colors.neonPalette;
  const neonLights = [];
  let signIndex = 0;

  // One building per block, with varied height, footprint and rooftop shape.
  for (let bx = -3; bx <= 3; bx++) {
    for (let bz = -3; bz <= 3; bz++) {
      if (bx === 0 && bz === 3) continue; // keep the beach road open
      const cx = bx * CFG.pitch;
      const cz = bz * CFG.pitch;
      const tall = rng.next() < 0.3;
      const w = 22 + rng.next() * 14;
      const d = 22 + rng.next() * 14;
      const h = tall ? 42 + rng.next() * 34 : 12 + rng.next() * 22;
      const tint = hexCss(palette[Math.floor(rng.next() * palette.length)]);
      const winTex = paintWindows(rng, tint);
      const mat = new THREE.MeshLambertMaterial({ map: winTex });
      const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      tower.position.set(cx, h / 2, cz);
      group.add(tower);
      colliders.push({ x: cx, z: cz, hx: w / 2, hz: d / 2 });
      // Rooftop box or antenna on some towers.
      if (rng.next() < 0.45) {
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.35, 3 + rng.next() * 4, d * 0.35),
          new THREE.MeshLambertMaterial({ color: 0x2a2a34 }),
        );
        roof.position.set(cx + (rng.next() - 0.5) * w * 0.3, h + 2, cz + (rng.next() - 0.5) * d * 0.3);
        group.add(roof);
      }
      // Glowing neon sign on the street-facing side of most buildings.
      if (rng.next() < 0.62) {
        const color = neon[signIndex % neon.length];
        signIndex += 1;
        const signW = 6 + rng.next() * 8;
        const sign = new THREE.Mesh(
          new THREE.BoxGeometry(signW, 1.6, 0.5),
          new THREE.MeshBasicMaterial({ color }),
        );
        const face = rng.next() < 0.5 ? 1 : -1;
        sign.position.set(cx, Math.min(h * 0.55, 14 + rng.next() * 10), cz + face * (d / 2 + 0.4));
        group.add(sign);
        // A few real point lights so the neon spills onto the street.
        // Kept to six: every extra light costs real frame time.
        if (neonLights.length < 6 && rng.next() < 0.5) {
          const light = new THREE.PointLight(color, 26, 34);
          light.position.set(cx, 6, cz + face * (d / 2 + 3));
          group.add(light);
          neonLights.push(light);
        }
      }
    }
  }

  // Street props: billboards, benches and hydrants along the boulevards.
  const billboardFaces = ['NEON BAY', 'MARINA', 'CASINO', 'DOCKS 24H', 'PIER 9', 'HOTEL LUMEN'];
  for (let i = 0; i < 6; i++) {
    const bx = CFG.roads[1 + i];
    const bz = CFG.roads[i % 2 === 0 ? 6 : 1];
    const pole = new THREE.Mesh(
      new THREE.BoxGeometry(1, 14, 1),
      new THREE.MeshLambertMaterial({ color: 0x3a3a44 }),
    );
    pole.position.set(bx, 7, bz);
    group.add(pole);
    const face = new THREE.Mesh(
      new THREE.BoxGeometry(12, 5, 0.6),
      new THREE.MeshBasicMaterial({ color: neon[i % neon.length] }),
    );
    face.position.set(bx, 15, bz);
    group.add(face);
    colliders.push({ x: bx, z: bz, hx: 1, hz: 1 });
  }
  const benchMat = new THREE.MeshLambertMaterial({ color: 0x6e4a2e });
  const hydrantMat = new THREE.MeshLambertMaterial({ color: 0xc23b2e });
  for (let i = 0; i < 14; i++) {
    const onXRoad = rng.next() < 0.5;
    const road = CFG.roads[Math.floor(rng.next() * CFG.roads.length)];
    const along = (rng.next() * 2 - 1) * 180;
    const bx = onXRoad ? road + 9.5 : along;
    const bz = onXRoad ? along : road + 9.5;
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.8), benchMat);
    bench.position.set(bx, 0.5, bz);
    bench.rotation.y = onXRoad ? 0 : Math.PI / 2;
    group.add(bench);
    if (rng.next() < 0.6) {
      const hyd = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 1, 8), hydrantMat);
      hyd.position.set(bx + (rng.next() - 0.5) * 6, 0.5, bz + (rng.next() - 0.5) * 6);
      group.add(hyd);
    }
  }

  // Parked cars along the kerbs (static dressing; the drivable ones come
  // from the vehicle module).
  const parkedColors = CFG.colors.carPalette;
  const parkedGeo = new THREE.BoxGeometry(4.2, 0.9, 1.9);
  const parkedTop = new THREE.BoxGeometry(2.1, 0.65, 1.7);
  const parkedGlass = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
  for (let i = 0; i < 12; i++) {
    const road = CFG.roads[Math.floor(rng.next() * CFG.roads.length)];
    const along = (rng.next() * 2 - 1) * 190;
    const side = rng.next() < 0.5 ? 1 : -1;
    const vertical = rng.next() < 0.5;
    const px = vertical ? road + side * 5.4 : along;
    const pz = vertical ? along : road + side * 5.4;
    const mat = new THREE.MeshLambertMaterial({ color: parkedColors[i % parkedColors.length] });
    const body = new THREE.Mesh(parkedGeo, mat);
    body.position.set(px, 0.72, pz);
    body.rotation.y = vertical ? 0 : Math.PI / 2;
    group.add(body);
    const top = new THREE.Mesh(parkedTop, parkedGlass);
    top.position.set(px, 1.45, pz);
    top.rotation.y = body.rotation.y;
    group.add(top);
    colliders.push({ x: px, z: pz, hx: 2.4, hz: 2.4 });
  }

  // Palms along the beach road.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6e4a2e });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e8a4a });
  for (let i = 0; i < 18; i++) {
    const px = -200 + i * 23 + (rng.next() - 0.5) * 8;
    const pz = CFG.beachZ - 6 + (rng.next() - 0.5) * 4;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 7, 6), trunkMat);
    trunk.position.set(px, 3.5, pz);
    trunk.rotation.z = (rng.next() - 0.5) * 0.2;
    group.add(trunk);
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(3, 2.6, 7), leafMat);
    leaves.position.set(px, 7.8, pz);
    group.add(leaves);
  }

  // The yacht: Mara's boat, white hull and a warm cabin glow.
  const yacht = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(10, 2.4, 4.5),
    new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }),
  );
  hull.position.y = 0.8;
  yacht.add(hull);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(5, 2, 3.4),
    new THREE.MeshBasicMaterial({ color: 0xffd23c }),
  );
  cabin.position.set(-0.5, 2.8, 0);
  yacht.add(cabin);
  yacht.position.set(CFG.places.yacht.x, 0.4, CFG.places.yacht.z);
  yacht.rotation.y = 0.5;
  group.add(yacht);

  // Dock crates near the east edge for the harbor missions.
  const crateMat = new THREE.MeshLambertMaterial({ color: 0x8a6a3a });
  for (let i = 0; i < 8; i++) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), crateMat);
    crate.position.set(216 + (rng.next() - 0.5) * 8, 1.5, -30 + i * 12 + (rng.next() - 0.5) * 4);
    crate.rotation.y = rng.next() * 0.6;
    group.add(crate);
    colliders.push({ x: crate.position.x, z: crate.position.z, hx: 2, hz: 2 });
  }

  // Streetlights: poles with a warm lamp head (no real light each — the
  // dusk hemi + sun carry the scene, the neon lights add the colour).
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2a34 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9b0 });
  for (const r of CFG.roads) {
    for (const a of [-160, -60, 40, 140]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 7, 6), poleMat);
      pole.position.set(r + 8, 3.5, a);
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), lampMat);
      lamp.position.set(r + 8, 7.1, a);
      group.add(lamp);
    }
  }

  function isOnRoad(x, z) {
    for (const r of CFG.roads) {
      if (Math.abs(x - r) < CFG.roadHalf + 1.5) return true;
      if (Math.abs(z - r) < CFG.roadHalf + 1.5) return true;
    }
    return false;
  }

  function collide(x, z, radius) {
    if (x < -260 || x > 260 || z < -220 || z > 300) return true;
    for (const c of colliders) {
      if (Math.abs(x - c.x) < c.hx + radius && Math.abs(z - c.z) < c.hz + radius) return true;
    }
    return false;
  }

  function randomStreetPoint() {
    const axis = rng.next() < 0.5 ? 'x' : 'z';
    const road = CFG.roads[Math.floor(rng.next() * CFG.roads.length)];
    const along = (rng.next() * 2 - 1) * 190;
    return axis === 'x' ? { x: road, z: along } : { x: along, z: road };
  }

  // Neon signs breathe: their point lights pulse gently with time so the
  // streets feel alive instead of statically lit.
  function pulseNeon(t) {
    for (let i = 0; i < neonLights.length; i++) {
      neonLights[i].intensity = 22 + Math.sin(t * 1.7 + i * 1.9) * 7;
    }
  }

  return { group, colliders, water, collide, isOnRoad, randomStreetPoint, neonLights, pulseNeon };
}

// Round 3 note: the city generator is untouched — road grid, blocks,
// window-lit towers, streetlights, palms and the beach with its water
// plane at the edge, exactly as round 2 built them.

// Round 3 note, continued: colliders come from the same generator as the
// visible buildings, so what you see is what you bump into.
