// NEON BAY — Jax on foot: movement, punch, pistol, entering and leaving cars.
// Written fresh for the make.fun gta6-01 entry.
import * as THREE from 'three';
import { CFG } from './config.js';

export function makePlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x1a8a7a }); // teal jacket
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
  const legGeo = new THREE.BoxGeometry(0.22, 0.75, 0.22);
  for (const lx of [-0.15, 0.15]) {
    const leg = new THREE.Mesh(legGeo, jeans);
    leg.position.set(lx, 0.38, 0);
    leg.name = 'leg';
    g.add(leg);
  }
  const armGeo = new THREE.BoxGeometry(0.15, 0.65, 0.15);
  for (const ax of [-0.38, 0.38]) {
    const arm = new THREE.Mesh(armGeo, jacket);
    arm.position.set(ax, 1.08, 0);
    arm.name = 'arm';
    g.add(arm);
  }
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  g.add(shadow);
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
    reloadTimer: 0,
    punchTimer: 0,
    punchCooldown: 0,
    inCar: null,
    phase: 0,
    moving: false,
  };
}

// Camera-relative WASD. `camYaw` is the camera rig's yaw; the camera sits
// behind the player at target - (sin yaw, cos yaw) * dist, so W walks
// along (sin yaw, cos yaw) — away from the camera, up-screen.
export function updatePlayer(player, input, dt, world, camYaw) {
  if (player.inCar) return;
  const p = CFG.player;
  const speed = input.run ? p.runSpeed : p.walkSpeed;
  let mx = 0;
  let mz = 0;
  if (input.up) { mx += Math.sin(camYaw); mz += Math.cos(camYaw); }
  if (input.down) { mx -= Math.sin(camYaw); mz -= Math.cos(camYaw); }
  if (input.left) { mx += Math.cos(camYaw); mz -= Math.sin(camYaw); }
  if (input.right) { mx -= Math.cos(camYaw); mz += Math.sin(camYaw); }
  const len = Math.hypot(mx, mz);
  player.moving = len > 0.01;
  if (player.moving) {
    mx /= len;
    mz /= len;
    const want = Math.atan2(mx, mz);
    let d = want - player.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    player.heading += d * Math.min(1, 12 * dt);
    const fixed = world.collide(player.x + mx * speed * dt, player.z + mz * speed * dt, p.radius);
    player.x = fixed.x;
    player.z = fixed.z;
    player.phase += dt * speed * 1.6;
  }
  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.rotation.y = player.heading;
  const swing = player.moving ? Math.sin(player.phase) * 0.55 : 0;
  for (const child of player.mesh.children) {
    if (child.name === 'leg') child.rotation.x = child.position.x < 0 ? swing : -swing;
    if (child.name === 'arm') child.rotation.x = child.position.x < 0 ? -swing * 0.6 : swing * 0.6;
  }
  if (player.punchCooldown > 0) player.punchCooldown -= dt;
  if (player.reloadTimer > 0) {
    player.reloadTimer -= dt;
    if (player.reloadTimer <= 0) player.ammo = CFG.player.magSize;
  }
}

// Punch: everything damageable in a short arc in front of Jax.
export function tryPunch(player, targets) {
  const p = CFG.player;
  if (player.punchCooldown > 0 || player.inCar) return null;
  player.punchCooldown = 0.45;
  player.punchTimer = 0.18;
  const fx = Math.sin(player.heading);
  const fz = Math.cos(player.heading);
  let best = null;
  let bestD = p.punchRange;
  for (const t of targets) {
    if (!t || t.dead) continue;
    const dx = t.x - player.x;
    const dz = t.z - player.z;
    const d = Math.hypot(dx, dz);
    if (d > p.punchRange || d < 0.01) continue;
    const dot = (dx * fx + dz * fz) / d;
    if (dot < Math.cos(p.punchArc)) continue;
    if (d < bestD) { bestD = d; best = t; }
  }
  if (best) {
    best.health -= p.punchDamage;
    if (best.health <= 0) best.dead = true;
    return best;
  }
  return null;
}

// Pistol: raycast from the camera through the screen centre.
const raycaster = new THREE.Raycaster();
export function tryShoot(player, camera, hitMeshes) {
  const p = CFG.player;
  if (player.inCar || player.weapon !== 'pistol') return null;
  if (player.reloadTimer > 0 || player.ammo <= 0) return 'empty';
  player.ammo -= 1;
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  raycaster.far = p.pistolRange;
  const hits = raycaster.intersectObjects(hitMeshes, true);
  if (!hits.length) return 'miss';
  // Walk up to the object that owns the hit position.
  let obj = hits[0].object;
  while (obj && obj.userData.owner === undefined) obj = obj.parent;
  return obj ? { target: obj.userData.owner, point: hits[0].point } : 'miss';
}

export function enterCar(player, car) {
  player.inCar = car;
  car.isTraffic = false;
  car.active = true;
  player.mesh.visible = false;
}

export function exitCar(player, world) {
  const car = player.inCar;
  if (!car) return;
  // Step out on the driver's side.
  const sx = car.x - Math.cos(car.heading) * 2.2;
  const sz = car.z + Math.sin(car.heading) * 2.2;
  const fixed = world.collide(sx, sz, CFG.player.radius);
  player.x = fixed.x;
  player.z = fixed.z;
  player.heading = car.heading;
  player.inCar = null;
  player.mesh.visible = true;
  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.rotation.y = player.heading;
}
