// NEON BAY — wanted level, police cars and police on foot.
// Written fresh for the make.fun gta6-01 entry.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makeCar, steerToward } from './vehicles.js';

export function starsFor(heat) {
  let stars = 0;
  for (const t of CFG.wanted.starAt) if (heat >= t) stars += 1;
  return Math.min(5, stars);
}

export function createWanted() {
  return { heat: 0, stars: 0, lastCrimeAt: -999 };
}

export function addHeat(wanted, amount, now) {
  wanted.heat = Math.min(100, wanted.heat + amount);
  wanted.lastCrimeAt = now;
  wanted.stars = starsFor(wanted.heat);
  return wanted.stars;
}

export function setHeat(wanted, heat, now) {
  wanted.heat = Math.max(0, Math.min(100, heat));
  wanted.lastCrimeAt = now;
  wanted.stars = starsFor(wanted.heat);
}

// Heat decays only after a quiet spell with no police close by.
export function updateWanted(wanted, dt, now, policeNear) {
  if (wanted.heat <= 0) return;
  if (now - wanted.lastCrimeAt < CFG.wanted.decayDelay) return;
  if (policeNear) return;
  wanted.heat = Math.max(0, wanted.heat - CFG.wanted.decayPerSec * dt);
  wanted.stars = starsFor(wanted.heat);
}

function makeCopMesh() {
  const g = new THREE.Group();
  const navy = new THREE.MeshLambertMaterial({ color: 0x1a2a5a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.72, 0.34), navy);
  torso.position.y = 1.06;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skin);
  head.position.y = 1.64;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.24, 0.1, 12), navy);
  cap.position.y = 1.82;
  g.add(cap);
  const legGeo = new THREE.BoxGeometry(0.2, 0.72, 0.2);
  for (const lx of [-0.14, 0.14]) {
    const leg = new THREE.Mesh(legGeo, navy);
    leg.position.set(lx, 0.36, 0);
    leg.name = 'leg';
    g.add(leg);
  }
  return g;
}

export function createPolice(scene) {
  return { scene, cars: [], foot: [], carTimer: 0, footTimer: 0, flashTimer: 0, flashOn: false };
}

function spawnPoliceCar(police, px, pz, rng) {
  const angle = rng.range(0, Math.PI * 2);
  const x = px + Math.sin(angle) * CFG.police.spawnDistance;
  const z = pz + Math.cos(angle) * CFG.police.spawnDistance;
  const car = makeCar(police.scene, x, z, Math.atan2(px - x, pz - z), 0x14141a, { police: true });
  car.hitCooldown = 0;
  police.cars.push(car);
  return car;
}

function spawnCop(police, px, pz, rng) {
  const angle = rng.range(0, Math.PI * 2);
  const x = px + Math.sin(angle) * 26;
  const z = pz + Math.cos(angle) * 26;
  const mesh = makeCopMesh();
  mesh.position.set(x, 0, z);
  police.scene.add(mesh);
  const cop = { mesh, x, z, heading: 0, health: 40, arrest: 0, punchTimer: 0, phase: 0, dead: false };
  mesh.traverse((o) => { o.userData.owner = cop; });
  police.foot.push(cop);
  return cop;
}

// `onBusted` fires when a cop holds Jax long enough. `onRam` fires with
// damage when a police car slams the player. Returns 'busted' or null.
export function updatePolice(police, dt, now, player, playerCar, wanted, world, rng, onRam) {
  const stars = wanted.stars;
  const px = playerCar ? playerCar.x : player.x;
  const pz = playerCar ? playerCar.z : player.z;
  let policeNear = false;

  // Desired strength scales with stars.
  const wantCars = stars === 0 ? 0 : Math.min(CFG.police.maxCars, stars);
  const wantFoot = police.noFoot ? 0 : (stars === 0 ? 0 : Math.min(CFG.police.maxFoot, stars + 1));

  police.carTimer -= dt;
  if (police.cars.length < wantCars && police.carTimer <= 0) {
    spawnPoliceCar(police, px, pz, rng);
    police.carTimer = 2.5;
  }
  police.footTimer -= dt;
  if (police.foot.length < wantFoot && police.footTimer <= 0) {
    spawnCop(police, px, pz, rng);
    police.footTimer = 2;
  }

  // Flash the light bars red/blue.
  police.flashTimer -= dt;
  if (police.flashTimer <= 0) {
    police.flashTimer = 0.35;
    police.flashOn = !police.flashOn;
    for (const car of police.cars) {
      const bar = car.mesh.getObjectByName('lightbar');
      if (bar) bar.material.color.setHex(police.flashOn ? 0xff2222 : 0x2244ff);
    }
  }

  // Police cars: chase and ram.
  for (const car of police.cars) {
    const dist = steerToward(car, px, pz, dt, world.collide, CFG.police.carSpeed);
    if (dist < 200) policeNear = true;
    car.hitCooldown -= dt;
    if (dist < 3.4 && car.hitCooldown <= 0 && Math.abs(car.speed) > 5) {
      car.hitCooldown = 1;
      if (onRam) onRam(CFG.police.ramDamage);
    }
    if (stars === 0 && dist > CFG.police.despawnDistance) {
      car.active = false;
      car.mesh.visible = false;
    }
  }
  police.cars = police.cars.filter((c) => c.active);

  // Police on foot: chase, punch, and arrest if they hold Jax.
  for (const cop of police.foot) {
    if (cop.dead) continue;
    const dx = px - cop.x;
    const dz = pz - cop.z;
    const dist = Math.hypot(dx, dz) || 1;
    if (dist < 60) policeNear = true;
    cop.heading = Math.atan2(dx, dz);
    if (dist > 1.4) {
      cop.x += (dx / dist) * CFG.police.footSpeed * dt;
      cop.z += (dz / dist) * CFG.police.footSpeed * dt;
      cop.phase += dt * 9;
    }
    cop.mesh.position.set(cop.x, 0, cop.z);
    cop.mesh.rotation.y = cop.heading;
    const swing = Math.sin(cop.phase) * 0.5;
    for (const child of cop.mesh.children) {
      if (child.name === 'leg') child.rotation.x = child.position.x < 0 ? swing : -swing;
    }
    // Arrest: hold Jax inside the radius.
    if (!playerCar && dist < CFG.police.arrestRadius) {
      cop.arrest += dt;
      if (cop.arrest >= CFG.police.arrestTime) return 'busted';
    } else {
      cop.arrest = Math.max(0, cop.arrest - dt * 2);
    }
    // A cop's punch hurts when Jax is on foot.
    cop.punchTimer -= dt;
    if (!playerCar && dist < 1.5 && cop.punchTimer <= 0) {
      cop.punchTimer = 0.9;
      if (onRam) onRam(6);
    }
    if (stars === 0 && dist > 120) {
      cop.dead = true;
      cop.mesh.visible = false;
    }
  }
  police.foot = police.foot.filter((c) => !c.dead || c.mesh.visible);
  return policeNear ? 'near' : null;
}
