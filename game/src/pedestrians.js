// NEON BAY — pedestrians: simple walkers on the sidewalks who flee danger.
// Written fresh for the make.fun gta6-01 entry.
import * as THREE from 'three';
import { CFG } from './config.js';

const skinTones = [0xe8b88a, 0xc98a5a, 0x8a5a3a, 0xf0c8a0];

function makePedMesh(shirt, skin) {
  const g = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const pantsMat = new THREE.MeshLambertMaterial({ color: 0x2a2a3a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.32), shirtMat);
  torso.position.y = 1.05;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skinMat);
  head.position.y = 1.62;
  g.add(head);
  const legGeo = new THREE.BoxGeometry(0.2, 0.7, 0.2);
  for (const lx of [-0.14, 0.14]) {
    const leg = new THREE.Mesh(legGeo, pantsMat);
    leg.position.set(lx, 0.35, 0);
    leg.name = 'leg';
    g.add(leg);
  }
  const armGeo = new THREE.BoxGeometry(0.14, 0.6, 0.14);
  for (const ax of [-0.36, 0.36]) {
    const arm = new THREE.Mesh(armGeo, shirtMat);
    arm.position.set(ax, 1.05, 0);
    arm.name = 'arm';
    g.add(arm);
  }
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.45, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  g.add(shadow);
  return g;
}

// A waypoint on a block's sidewalk edge, for the walk loop.
function sidewalkPoint(rng) {
  const i = rng.int(0, 6);
  const j = rng.int(0, 6);
  const cx = (i - 3) * CFG.pitch;
  const cz = (j - 3) * CFG.pitch;
  const side = rng.int(0, 3);
  const t = rng.range(-20, 20);
  if (side === 0) return { x: cx + t, z: cz - 24 };
  if (side === 1) return { x: cx + t, z: cz + 24 };
  if (side === 2) return { x: cx - 24, z: cz + t };
  return { x: cx + 24, z: cz + t };
}

export function spawnPeds(scene, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const p = sidewalkPoint(rng);
    const mesh = makePedMesh(rng.pick(CFG.colors.pedShirts), rng.pick(skinTones));
    mesh.position.set(p.x, 0, p.z);
    scene.add(mesh);
    peds.push({
      mesh, x: p.x, z: p.z, heading: rng.range(0, Math.PI * 2),
      speed: CFG.ped.walkSpeed * rng.range(0.8, 1.3),
      state: 'walk', waypoint: sidewalkPoint(rng),
      downTimer: 0, fleeTimer: 0, phase: rng.range(0, Math.PI * 2),
    });
  }
  return peds;
}

// threats: [{x, z, radius}] — gunshots, fast cars. Peds near one run away.
export function updatePeds(peds, dt, rng, threats) {
  for (const ped of peds) {
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      ped.mesh.rotation.x = -Math.PI / 2 * 0.9;
      if (ped.downTimer <= 0) {
        ped.state = 'flee';
        ped.fleeTimer = 2.5;
        ped.mesh.rotation.x = 0;
      }
      continue;
    }
    let tx = ped.waypoint.x;
    let tz = ped.waypoint.z;
    let speed = ped.speed;
    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      if (ped.fleeTimer <= 0) {
        ped.state = 'walk';
        ped.waypoint = sidewalkPoint(rng);
      }
    } else {
      for (const th of threats) {
        const d = Math.hypot(ped.x - th.x, ped.z - th.z);
        if (d < th.radius) {
          ped.state = 'flee';
          ped.fleeTimer = 2.5;
          const away = Math.atan2(ped.x - th.x, ped.z - th.z);
          tx = ped.x + Math.sin(away) * 30;
          tz = ped.z + Math.cos(away) * 30;
          speed = CFG.ped.fleeSpeed;
          break;
        }
      }
    }
    if (ped.state === 'walk') {
      const d = Math.hypot(tx - ped.x, tz - ped.z);
      if (d < 1.5) ped.waypoint = sidewalkPoint(rng);
    }
    const dx = tx - ped.x;
    const dz = tz - ped.z;
    const dist = Math.hypot(dx, dz) || 1;
    ped.heading = Math.atan2(dx, dz);
    ped.x += (dx / dist) * speed * dt;
    ped.z += (dz / dist) * speed * dt;
    ped.x = Math.max(-205, Math.min(205, ped.x));
    ped.z = Math.max(-205, Math.min(232, ped.z));
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
    // Cheap walk cycle: swing the legs and arms.
    ped.phase += dt * speed * 3.2;
    const swing = Math.sin(ped.phase) * 0.5;
    for (const child of ped.mesh.children) {
      if (child.name === 'leg') child.rotation.x = child.position.x < 0 ? swing : -swing;
      if (child.name === 'arm') child.rotation.x = child.position.x < 0 ? -swing * 0.7 : swing * 0.7;
    }
  }
}

// A punch knocks a ped down; they get up and run.
export function knockPed(ped) {
  if (ped.state === 'down') return;
  ped.state = 'down';
  ped.downTimer = 3;
}
