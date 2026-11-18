// NEON BAY round 2 — cars: box-built models, arcade driving, traffic AI.
// Three body classes now: the everyday sedan, a fast low sports car (the
// casino prize) and a slow boxy van. Every car is one group of boxes with
// four spinning wheels, headlights and a soft blob shadow.
import * as THREE from 'three';
import { CFG } from './config.js';
import { weightedPick } from './random.js';

const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
const tireMat = new THREE.MeshLambertMaterial({ color: 0x14141a });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
const headMat = new THREE.MeshBasicMaterial({ color: 0xffe9b0 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xc22a2a });
const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32 });

// One car body from boxes. `kind` is 'sedan' | 'sports' | 'van' | 'police'.
export function makeCarMesh(color, opts = {}) {
  const g = new THREE.Group();
  const kind = opts.kind || 'sedan';
  const paint = new THREE.MeshLambertMaterial({ color });
  const low = kind === 'sports';
  const tall = kind === 'van';
  const bodyLen = tall ? 5.2 : 4.4;
  const bodyH = tall ? 1.5 : 0.85;
  const bodyY = low ? 0.55 : 0.75;
  const body = new THREE.Mesh(new THREE.BoxGeometry(bodyLen, bodyH, 2.0), paint);
  body.position.y = bodyY;
  g.add(body);
  const cabinH = tall ? 0.9 : 0.7;
  const cabinLen = tall ? 2.6 : 2.2;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(cabinLen, cabinH, 1.8), glassMat);
  cabin.position.set(tall ? 0.6 : -0.2, bodyY + bodyH / 2 + cabinH / 2 - 0.05, 0);
  g.add(cabin);
  if (low) {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 1.9), tireMat);
    spoiler.position.set(-bodyLen / 2 + 0.2, bodyY + 0.75, 0);
    g.add(spoiler);
  }
  const wheels = [];
  const wheelY = 0.42;
  for (const [wx, wz] of [[1.5, 0.95], [1.5, -0.95], [-1.5, 0.95], [-1.5, -0.95]]) {
    const wheel = new THREE.Mesh(wheelGeo, tireMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, wheelY, wz);
    g.add(wheel);
    wheels.push(wheel);
  }
  // Headlights and tail lights at the nose (+x) and tail (-x).
  for (const wz of [0.6, -0.6]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.25, 0.4), headMat);
    head.position.set(bodyLen / 2 + 0.02, bodyY, wz);
    g.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.25, 0.4), tailMat);
    tail.position.set(-bodyLen / 2 - 0.02, bodyY, wz);
    g.add(tail);
  }
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(bodyLen + 0.6, 2.8), blobMat);
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.04;
  g.add(blob);
  let beaconL = null;
  let beaconR = null;
  if (opts.police) {
    beaconL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    beaconL.position.set(-0.2, bodyY + bodyH / 2 + cabinH + 0.15, 0.45);
    g.add(beaconL);
    beaconR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    beaconR.position.set(-0.2, bodyY + bodyH / 2 + cabinH + 0.15, -0.45);
    g.add(beaconR);
  }
  g.userData.wheels = wheels;
  g.userData.beaconL = beaconL;
  g.userData.beaconR = beaconR;
  return g;
}

export function makeCar(scene, x, z, heading, color, opts = {}) {
  const kind = opts.kind || (opts.police ? 'police' : 'sedan');
  const mesh = makeCarMesh(color, { kind, police: !!opts.police });
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  const car = {
    mesh, x, z, heading, speed: 0, steer: 0,
    active: true, axis: 'x', road: 0, dir: 1,
    hitCooldown: 0, kind,
    topSpeed: kind === 'sports' ? CFG.car.sportsMax : (kind === 'van' ? CFG.car.vanMax : CFG.car.maxSpeed),
    accel: kind === 'sports' ? CFG.car.sportsAccel : (kind === 'van' ? CFG.car.vanAccel : CFG.car.accel),
    grip: kind === 'sports' ? CFG.car.sportsGrip : CFG.car.grip,
    damaged: 0, // 0..1, grows with hard hits; high damage smokes
    beaconL: mesh.userData.beaconL,
    beaconR: mesh.userData.beaconR,
  };
  return car;
}

function spinWheels(car, dt) {
  const spin = (car.speed * dt) / 0.42;
  for (const w of car.mesh.userData.wheels) w.rotation.z += spin;
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
}

// Arcade driving: accelerate, brake, reverse, steer that bites harder at
// speed, handbrake that slides. Returns the impact speed of a hard hit
// (0 when nothing hit) so the caller can shake the camera and spark.
export function driveCar(car, input, dt, collide) {
  const forward = Math.sin(car.heading);
  const side = Math.cos(car.heading);
  let impact = 0;
  if (input.up) car.speed += car.accel * dt;
  if (input.down) {
    if (car.speed > 1) car.speed -= CFG.car.brake * dt;
    else car.speed -= car.accel * 0.5 * dt;
  }
  if (!input.up && !input.down) car.speed -= Math.sign(car.speed) * 8 * dt;
  if (Math.abs(car.speed) < 0.2 && !input.up && !input.down) car.speed = 0;
  const top = car.topSpeed;
  if (car.speed > top) car.speed = top;
  if (car.speed < -CFG.car.reverseMax) car.speed = -CFG.car.reverseMax;
  const grip = input.handbrake ? CFG.car.handbrakeGrip : car.grip;
  const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  car.steer += (steerTarget * CFG.car.steerMax - car.steer) * Math.min(1, grip * dt);
  if (Math.abs(car.speed) > 0.3) {
    car.heading += car.steer * (car.speed / top) * 2.4 * dt * (car.speed >= 0 ? 1 : -1);
  }
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  if (collide && collide(nx, nz, 1.6)) {
    impact = Math.abs(car.speed);
    car.speed *= -0.25;
    car.damaged = Math.min(1, car.damaged + impact * 0.02);
  } else {
    car.x = nx;
    car.z = nz;
  }
  car.hitCooldown = Math.max(0, car.hitCooldown - dt);
  spinWheels(car, dt);
  return impact;
}

// Simple pursuit steering used by police cars: aim at a target point.
export function steerToward(car, tx, tz, dt, collide, topSpeed) {
  const dx = tx - car.x;
  const dz = tz - car.z;
  const want = Math.atan2(dx, dz);
  let d = want - car.heading;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  car.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, d));
  const top = topSpeed || car.topSpeed;
  car.speed += (top - car.speed) * Math.min(1, 1.4 * dt);
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  if (!collide || !collide(nx, nz, 1.6)) {
    car.x = nx;
    car.z = nz;
  } else {
    car.speed *= 0.5;
  }
  spinWheels(car, dt);
}

export function spawnTraffic(scene, world, rng, count) {
  const cars = [];
  const palette = CFG.colors.carPalette;
  for (let i = 0; i < count; i++) {
    const spot = world.randomStreetPoint();
    const vertical = spot.x === CFG.roads.find((r) => Math.abs(r - spot.x) < 1);
    const kind = i === 2 || i === 9 ? 'sports' : (i % 6 === 4 ? 'van' : 'sedan');
    // Round 3: dusk streets carry more everyday paint — silver and dark
    // outweigh the flashy yellows, purples and teals in the palette order.
    const color = weightedPick(rng, palette, [2, 2, 1, 1, 3, 3, 1, 1]);
    const car = makeCar(scene, spot.x, spot.z, vertical ? 0 : Math.PI / 2, color, { kind });
    car.axis = vertical ? 'z' : 'x';
    car.road = vertical ? spot.x : spot.z;
    car.dir = rng.next() < 0.5 ? 1 : -1;
    car.speed = CFG.car.trafficSpeed * (0.7 + rng.next() * 0.6);
    cars.push(car);
  }
  return cars;
}

export function updateTraffic(cars, dt, world) {
  for (const car of cars) {
    if (!car.active) continue;
    // Slow down when another car is right ahead on the same lane.
    let blocked = false;
    for (const other of cars) {
      if (other === car || !other.active) continue;
      const dx = other.x - car.x;
      const dz = other.z - car.z;
      const ahead = car.axis === 'x' ? dx * car.dir : dz * car.dir;
      const side = car.axis === 'x' ? Math.abs(dz) : Math.abs(dx);
      if (ahead > 0 && ahead < 9 && side < 3) { blocked = true; break; }
    }
    const want = blocked ? 0 : CFG.car.trafficSpeed * (car.kind === 'van' ? 0.8 : 1);
    car.speed += (want - car.speed) * Math.min(1, 1.2 * dt);
    const step = car.speed * car.dir * dt;
    if (car.axis === 'x') car.x += step;
    else car.z += step;
    // Wrap around the map edges so traffic never runs out.
    if (car.x > 215) car.x = -215;
    if (car.x < -215) car.x = 215;
    if (car.z > 215) car.z = -215;
    if (car.z < -215) car.z = 215;
    car.heading = car.axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
    spinWheels(car, dt);
  }
}

export function nearestCar(cars, x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    if (!car || !car.active) continue;
    const dx = car.x - x;
    const dz = car.z - z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

// A badly damaged car smokes: the main loop uses this to spawn fire puffs.
export function carSmoking(car) {
  return car.damaged > 0.55;
}

// Round 3 note: traffic still spawns sedans, vans and the occasional
// sports car and follows its lanes; the only behaviour change this round
// is the colour draw, which now weights everyday paint over flashy paint.

// Round 3 note, continued: traffic slows for the car ahead on its lane,
// which is what keeps the streets feeling busy instead of bumper-to-bumper.
