// NEON BAY — city generation: roads, blocks, buildings, lights, palms, beach, docks.
// Written fresh for the make.fun gta6-01 entry.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makeRng } from './random.js';

// One 2048px ground texture for the whole map: asphalt, sidewalk blocks,
// lane dashes, crosswalks, sand and the dock concrete. One draw call.
function makeGroundTexture() {
  const S = 2048;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const g = cv.getContext('2d');
  // Map rect: x in [-270, 290], z in [-225, 335] (560 m square).
  const px = (x) => ((x + 270) / 560) * S;
  const pz = (z) => ((z + 225) / 560) * S;
  const m = S / 560; // pixels per metre

  g.fillStyle = '#23232e'; // asphalt
  g.fillRect(0, 0, S, S);

  // Sidewalk blocks (light slabs with a darker edge).
  const P = CFG.pitch;
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 7; j++) {
      const cx = (i - 3) * P;
      const cz = (j - 3) * P;
      g.fillStyle = '#6b6b78';
      g.fillRect(px(cx - 22), pz(cz - 22), 44 * m, 44 * m);
      g.fillStyle = '#5a5a66';
      g.fillRect(px(cx - 22), pz(cz - 22), 44 * m, 2 * m);
      g.fillRect(px(cx - 22), pz(cz - 22), 2 * m, 44 * m);
    }
  }

  // Lane dashes along every road centre line.
  g.fillStyle = '#c9c9b8';
  for (const r of CFG.roads) {
    for (let d = -200; d < 200; d += 12) {
      g.fillRect(px(r) - 0.4 * m, pz(d), 0.8 * m, 5 * m);
      g.fillRect(px(d), pz(r) - 0.4 * m, 5 * m, 0.8 * m);
    }
  }

  // Crosswalk stripes at every intersection.
  for (const rx of CFG.roads) {
    for (const rz of CFG.roads) {
      for (let k = -3; k <= 3; k++) {
        g.fillRect(px(rx + k * 1.6) - 0.5 * m, pz(rz - 6), 1 * m, 3.2 * m);
        g.fillRect(px(rx - 6), pz(rz + k * 1.6) - 0.5 * m, 3.2 * m, 1 * m);
      }
    }
  }

  // Beach sand (south edge) and dock concrete (east edge).
  g.fillStyle = '#d9b380';
  g.fillRect(px(-270), pz(CFG.beachZ), S, pz(238) - pz(CFG.beachZ));
  g.fillStyle = '#8a8a94';
  g.fillRect(px(CFG.dockX), pz(20), px(250) - px(CFG.dockX), pz(100) - pz(20));

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Facade texture: one lit-window grid per variant.
function makeFacadeTexture(baseHex, litHex, rng) {
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = baseHex;
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(0, 0, 128, 8);
  for (let y = 16; y < 248; y += 22) {
    for (let x = 10; x < 118; x += 18) {
      g.fillStyle = rng.chance(0.45) ? litHex : '#1c2030';
      g.fillRect(x, y, 11, 14);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, seed) {
  const rng = makeRng(seed);
  const group = new THREE.Group();
  const colliders = [];

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 560),
    new THREE.MeshLambertMaterial({ map: makeGroundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(10, 0, 55);
  group.add(ground);

  // Water (south), animated gently by the game loop.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 110),
    new THREE.MeshLambertMaterial({ color: CFG.colors.water, transparent: true, opacity: 0.92 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(10, 0.12, 293);
  group.add(water);

  // Buildings: 1-4 per block, facades from 3 lit-window variants.
  const facades = [
    makeFacadeTexture('#4a3f66', '#ffd28a', rng),
    makeFacadeTexture('#3e5570', '#ffe9b0', rng),
    makeFacadeTexture('#6e4a5d', '#ffb36b', rng),
  ];
  const facadeMats = facades.map((t) => new THREE.MeshLambertMaterial({ map: t }));
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x2e2a33 });
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const P = CFG.pitch;
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 7; j++) {
      const cx = (i - 3) * P;
      const cz = (j - 3) * P;
      // A couple of open plazas / parking lots instead of towers.
      if (rng.chance(0.08)) continue;
      const n = rng.int(1, 3);
      for (let b = 0; b < n; b++) {
        const w = rng.range(12, 20);
        const d = rng.range(12, 20);
        const h = rng.range(9, 18) + (Math.abs(cx) < 60 && Math.abs(cz) < 60 ? rng.range(6, 24) : 0);
        const ox = rng.range(-8, 8);
        const oz = rng.range(-8, 8);
        const x = cx + ox;
        const z = cz + oz;
        const mesh = new THREE.Mesh(unitBox, facadeMats[(i * 7 + j + b) % 3]);
        mesh.scale.set(Math.min(w, 44 - Math.abs(ox) * 2 - 4), h, Math.min(d, 44 - Math.abs(oz) * 2 - 4));
        mesh.position.set(x, h / 2, z);
        group.add(mesh);
        // Rooftop box on taller towers.
        if (h > 22) {
          const roof = new THREE.Mesh(unitBox, roofMat);
          roof.scale.set(mesh.scale.x * 0.4, 2.5, mesh.scale.z * 0.4);
          roof.position.set(x, h + 1.25, z);
          group.add(roof);
        }
        colliders.push({
          x0: x - mesh.scale.x / 2, x1: x + mesh.scale.x / 2,
          z0: z - mesh.scale.z / 2, z1: z + mesh.scale.z / 2,
        });
      }
    }
  }

  // Streetlights at every other intersection: pole + warm glowing head.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x30303a });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd28a });
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 7, 6);
  const headGeo = new THREE.BoxGeometry(1.4, 0.25, 0.5);
  for (let i = 0; i < CFG.roads.length; i += 2) {
    for (let j = 0; j < CFG.roads.length; j += 2) {
      const x = CFG.roads[i] + 6;
      const z = CFG.roads[j] + 6;
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x, 3.5, z);
      group.add(pole);
      const head = new THREE.Mesh(headGeo, lampMat);
      head.position.set(x - 0.6, 7, z);
      group.add(head);
    }
  }

  // Palms along the beach and a few on the boulevard.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2e });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2e7a4a });
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.3, 6, 6);
  const frondGeo = new THREE.ConeGeometry(1.6, 3.2, 5);
  for (let k = 0; k < 14; k++) {
    const x = -190 + k * 28 + rng.range(-4, 4);
    const z = 216 + rng.range(-2, 2);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 3, z);
    trunk.rotation.z = rng.range(-0.12, 0.12);
    group.add(trunk);
    const fronds = new THREE.Mesh(frondGeo, frondMat);
    fronds.position.set(x, 6.8, z);
    fronds.rotation.x = Math.PI;
    fronds.scale.set(1, 0.7, 1);
    group.add(fronds);
  }

  // Docks: containers, crates and a gantry crane.
  const contCols = [0x8a3c2e, 0x2e6f8a, 0x6a8a2e, 0xc2a23c];
  const contGeo = new THREE.BoxGeometry(12, 3, 3);
  for (let k = 0; k < 6; k++) {
    const c = new THREE.Mesh(contGeo, new THREE.MeshLambertMaterial({ color: contCols[k % 4] }));
    const x = 222 + (k % 2) * 14;
    const z = 30 + Math.floor(k / 2) * 16;
    c.position.set(x, 1.5 + (k % 3 === 0 ? 3 : 0), z);
    c.rotation.y = k % 2 ? 0.1 : -0.06;
    group.add(c);
    colliders.push({ x0: x - 6, x1: x + 6, z0: z - 1.6, z1: z + 1.6 });
  }
  const crateGeo = new THREE.BoxGeometry(2.4, 2.4, 2.4);
  const crateMat = new THREE.MeshLambertMaterial({ color: 0x9a7a4a });
  for (let k = 0; k < 8; k++) {
    const x = 214 + rng.range(0, 28);
    const z = 26 + rng.range(0, 60);
    const crate = new THREE.Mesh(crateGeo, crateMat);
    crate.position.set(x, 1.2, z);
    crate.rotation.y = rng.range(0, 1.5);
    group.add(crate);
  }
  // Gantry crane silhouette.
  const craneMat = new THREE.MeshLambertMaterial({ color: 0xb8a23c });
  const legGeo = new THREE.BoxGeometry(1.2, 22, 1.2);
  for (const lx of [216, 236]) {
    const leg = new THREE.Mesh(legGeo, craneMat);
    leg.position.set(lx, 11, 55);
    group.add(leg);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(24, 1.4, 1.4), craneMat);
  beam.position.set(226, 22, 55);
  group.add(beam);

  scene.add(group);

  // Push a circle (x, z, radius) out of every collider, then clamp to the map.
  function collide(x, z, r) {
    for (const c of colliders) {
      const nx = Math.max(c.x0, Math.min(x, c.x1));
      const nz = Math.max(c.z0, Math.min(z, c.z1));
      const dx = x - nx;
      const dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * r;
          z = nz + (dz / d) * r;
        } else {
          // Centre inside the box: push out along the smallest penetration.
          const pl = x - c.x0 + r;
          const pr = c.x1 - x + r;
          const pt = z - c.z0 + r;
          const pb = c.z1 - z + r;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) x = c.x0 - r;
          else if (m === pr) x = c.x1 + r;
          else if (m === pt) z = c.z0 - r;
          else z = c.z1 + r;
        }
      }
    }
    x = Math.max(-208, Math.min(248, x));
    z = Math.max(-208, Math.min(236, z));
    return { x, z };
  }

  function isOnRoad(x, z) {
    for (const r of CFG.roads) {
      if (Math.abs(x - r) < CFG.roadHalf + 1.5) return true;
      if (Math.abs(z - r) < CFG.roadHalf + 1.5) return true;
    }
    return false;
  }

  function randomStreetPoint() {
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const road = rng.pick(CFG.roads);
    const along = rng.range(-190, 190);
    return axis === 'x' ? { x: road, z: along } : { x: along, z: road };
  }

  return { group, colliders, water, collide, isOnRoad, randomStreetPoint };
}
