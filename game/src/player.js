// NEON BAY round 2 — Jax on foot: movement, punch, pistol, entering cars.
// Jax is a teal-jacketed box figure with a red cap; he moves relative to
// the camera, runs with Shift, and hides his mesh while driving.
import * as THREE from 'three';
import { CFG } from './config.js';

export function makePlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x1a8a7a });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2a2a3e });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
  const capMat = new THREE.MeshLambertMaterial({ color: 0xc23b2e });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.75, 0.34), jacket);
  torso.position.y = 1.08;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 10), skin);
  head.position.y = 1.66;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.25, 0.12, 12), capMat);
  cap.position.y = 1.84;
  g.add(cap);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.3), capMat);
  brim.position.set(0, 1.8, 0.28);
  g.add(brim);
  const legGeo = new THREE.BoxGeometry(0.22, 0.72, 0.22);
  const legL = new THREE.Mesh(legGeo, jeans);
  legL.position.set(-0.15, 0.36, 0);
  g.add(legL);
  const legR = new THREE.Mesh(legGeo, jeans);
  legR.position.set(0.15, 0.36, 0);
  g.add(legR);
  const armGeo = new THREE.BoxGeometry(0.15, 0.62, 0.15);
  const armL = new THREE.Mesh(armGeo, jacket);
  armL.position.set(-0.4, 1.08, 0);
  g.add(armL);
  const armR = new THREE.Mesh(armGeo, jacket);
  armR.position.set(0.4, 1.08, 0);
  g.add(armR);
  g.userData.legL = legL;
  g.userData.legR = legR;
  g.userData.armR = armR;
  return g;
}

export function createPlayer(scene, x, z) {
  const mesh = makePlayerMesh();
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return {
    mesh, x, z, heading: 0,
    health: CFG.player.health,
    weapon: 'fists',
    ammo: CFG.player.magSize,
    magSize: CFG.player.magSize,
    reloadTimer: 0,
    punchCooldown: 0,
    inCar: null,
    moving: false,
    phase: 0,
  };
}

export function updatePlayer(player, input, dt, world, camYaw) {
  player.punchCooldown = Math.max(0, player.punchCooldown - dt);
  if (player.reloadTimer > 0) {
    player.reloadTimer -= dt;
    if (player.reloadTimer <= 0) player.ammo = player.magSize;
  }
  // Camera-relative movement: the camera sits behind the target at
  // target - (sin yaw, cos yaw) * dist, so "forward" is +(sin yaw, cos yaw).
  let fx = 0;
  let fz = 0;
  if (input.up) { fx += Math.sin(camYaw); fz += Math.cos(camYaw); }
  if (input.down) { fx -= Math.sin(camYaw); fz -= Math.cos(camYaw); }
  if (input.left) { fx += Math.cos(camYaw); fz -= Math.sin(camYaw); }
  if (input.right) { fx -= Math.cos(camYaw); fz += Math.sin(camYaw); }
  const len = Math.hypot(fx, fz);
  player.moving = len > 0.01;
  if (player.moving) {
    fx /= len;
    fz /= len;
    const speed = input.run ? CFG.player.runSpeed : CFG.player.walkSpeed;
    const nx = player.x + fx * speed * dt;
    const nz = player.z + fz * speed * dt;
    if (!world.collide(nx, player.z, CFG.player.radius)) player.x = nx;
    if (!world.collide(player.x, nz, CFG.player.radius)) player.z = nz;
    player.heading = Math.atan2(fx, fz);
    player.phase += dt * speed * 1.4;
    const swing = Math.sin(player.phase) * 0.6;
    player.mesh.userData.legL.rotation.x = swing;
    player.mesh.userData.legR.rotation.x = -swing;
  } else {
    player.mesh.userData.legL.rotation.x = 0;
    player.mesh.userData.legR.rotation.x = 0;
  }
  // Punch arm tucks back in after the swing.
  player.mesh.userData.armR.rotation.x = player.punchCooldown > 0.25 ? -1.4 : 0;
  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.rotation.y = player.heading;
}

// Swing at the nearest hittable target in front of Jax. Returns the target
// hit (with its health already reduced) or null.
export function tryPunch(player, targets) {
  if (player.punchCooldown > 0 || player.inCar) return null;
  player.punchCooldown = 0.45;
  let best = null;
  let bestD = CFG.player.punchRange;
  for (const t of targets) {
    if (!t || t.dead || t.health <= 0) continue;
    const dx = t.x - player.x;
    const dz = t.z - player.z;
    const d = Math.hypot(dx, dz);
    if (d > bestD) continue;
    const ang = Math.atan2(dx, dz);
    let diff = ang - player.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > CFG.player.punchArc) continue;
    best = t;
    bestD = d;
  }
  if (!best) return null;
  best.health -= CFG.player.punchDamage;
  if (best.health <= 0) best.dead = true;
  return best;
}

const raycaster = new THREE.Raycaster();

export function tryShoot(player, camera, hitMeshes) {
  if (player.inCar || player.weapon !== 'pistol') return null;
  if (player.reloadTimer > 0) return null;
  if (player.ammo <= 0) return 'empty';
  player.ammo -= 1;
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  raycaster.far = CFG.player.pistolRange;
  const hits = raycaster.intersectObjects(hitMeshes, true);
  if (!hits.length) return 'miss';
  let node = hits[0].object;
  while (node && !node.userData.owner) node = node.parent;
  if (!node) return 'miss';
  return { target: node.userData.owner, point: hits[0].point };
}

export function enterCar(player, car) {
  player.inCar = car;
  player.mesh.visible = false;
  player.x = car.x;
  player.z = car.z;
}

export function exitCar(player, world) {
  const car = player.inCar;
  if (!car) return;
  player.inCar = null;
  player.mesh.visible = true;
  // Step out on the driver's side; nudge until the spot is free.
  const side = 2.4;
  let px = car.x + Math.cos(car.heading) * side;
  let pz = car.z - Math.sin(car.heading) * side;
  if (world.collide(px, pz, CFG.player.radius)) {
    px = car.x - Math.cos(car.heading) * side;
    pz = car.z + Math.sin(car.heading) * side;
  }
  player.x = px;
  player.z = pz;
  player.heading = car.heading;
  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.rotation.y = player.heading;
}
