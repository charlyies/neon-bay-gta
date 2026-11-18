// NEON BAY round 2 — pedestrians: sidewalk walkers who flee danger.
// Each ped is a small box figure with swinging legs; they stroll the
// sidewalks, run from gunfire and fast cars, and stay down after a hit.
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
  const legL = new THREE.Mesh(legGeo, pantsMat);
  legL.position.set(-0.14, 0.35, 0);
  g.add(legL);
  const legR = new THREE.Mesh(legGeo, pantsMat);
  legR.position.set(0.14, 0.35, 0);
  g.add(legR);
  const armGeo = new THREE.BoxGeometry(0.14, 0.6, 0.14);
  for (const ax of [-0.36, 0.36]) {
    const arm = new THREE.Mesh(armGeo, shirtMat);
    arm.position.set(ax, 1.05, 0);
    g.add(arm);
  }
  g.userData.legL = legL;
  g.userData.legR = legR;
  return g;
}

// A point on a sidewalk: just off a road centre line, anywhere in town.
function sidewalkPoint(rng) {
  const road = CFG.roads[Math.floor(rng.next() * CFG.roads.length)];
  const along = (rng.next() * 2 - 1) * 195;
  const side = rng.next() < 0.5 ? 1 : -1;
  if (rng.next() < 0.5) return { x: road + side * 9.5, z: along };
  return { x: along, z: road + side * 9.5 };
}

export function spawnPeds(scene, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const spot = sidewalkPoint(rng);
    const shirt = CFG.colors.pedShirts[Math.floor(rng.next() * CFG.colors.pedShirts.length)];
    const skin = skinTones[Math.floor(rng.next() * skinTones.length)];
    const mesh = makePedMesh(shirt, skin);
    mesh.position.set(spot.x, 0, spot.z);
    scene.add(mesh);
    peds.push({
      mesh, x: spot.x, z: spot.z,
      heading: rng.next() * Math.PI * 2,
      state: 'walk', kind: 'ped',
      health: 100, dead: false,
      speed: CFG.ped.walkSpeed * (0.8 + rng.next() * 0.5),
      phase: rng.next() * Math.PI * 2,
      retarget: rng.next() * 4,
    });
  }
  return peds;
}

export function updatePeds(peds, dt, rng, threats) {
  for (const ped of peds) {
    if (ped.state === 'down') continue;
    // Danger nearby? Run away from the closest threat.
    let fleeX = 0;
    let fleeZ = 0;
    let scared = false;
    for (const t of threats) {
      const dx = ped.x - t.x;
      const dz = ped.z - t.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < t.radius && d > 0.01) {
        fleeX += dx / d;
        fleeZ += dz / d;
        scared = true;
      }
    }
    if (scared) {
      ped.state = 'flee';
      ped.heading = Math.atan2(fleeX, fleeZ);
      const sp = CFG.ped.fleeSpeed;
      ped.x += Math.sin(ped.heading) * sp * dt;
      ped.z += Math.cos(ped.heading) * sp * dt;
    } else {
      ped.state = 'walk';
      ped.retarget -= dt;
      if (ped.retarget <= 0) {
        ped.retarget = 3 + rng.next() * 5;
        // Turn to follow the sidewalk grid: mostly straight, sometimes 90°.
        ped.heading += (rng.next() < 0.7 ? 0 : (rng.next() < 0.5 ? 1 : -1) * Math.PI / 2);
      }
      ped.x += Math.sin(ped.heading) * ped.speed * dt;
      ped.z += Math.cos(ped.heading) * ped.speed * dt;
      // Keep peds inside the city; turn around at the edges.
      if (Math.abs(ped.x) > 205 || Math.abs(ped.z) > 205) ped.heading += Math.PI;
    }
    ped.phase += dt * (ped.state === 'flee' ? 11 : 6);
    const swing = Math.sin(ped.phase) * 0.55;
    ped.mesh.userData.legL.rotation.x = swing;
    ped.mesh.userData.legR.rotation.x = -swing;
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
  }
}

export function knockPed(ped) {
  ped.state = 'down';
  ped.dead = true;
  ped.mesh.rotation.x = -Math.PI / 2;
  ped.mesh.position.y = 0.3;
}

// Bring a knocked-down ped back up (used when a new game starts).
export function revivePed(ped, rng) {
  ped.state = 'walk';
  ped.dead = false;
  ped.health = 100;
  ped.mesh.rotation.x = 0;
  ped.mesh.position.y = 0;
  const spot = sidewalkPoint(rng);
  ped.x = spot.x;
  ped.z = spot.z;
  ped.mesh.position.set(ped.x, 0, ped.z);
}

// Round 3 note: the sidewalk walkers keep their round 2 behaviour —
// strolling, fleeing gunfire and fast cars, staying down after a hit.

// Round 3 note, continued: peds revive on a new game, so a fresh run
// always starts with full streets.
