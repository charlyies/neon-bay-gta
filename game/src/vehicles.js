// NEON BAY — cars: box-built models, arcade driving physics, traffic AI.
// Written fresh for the make.fun gta6-01 entry.
import * as THREE from 'three';
import { CFG } from './config.js';

const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
const tireMat = new THREE.MeshLambertMaterial({ color: 0x14141a });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
const lightMat = new THREE.MeshBasicMaterial({ color: 0xffe9b0 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xc22a2a });
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 });

// A car from boxes: body, cabin, four wheels, lights, soft blob shadow.
export function makeCarMesh(color, opts = {}) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.85, 2.0), paint);
  body.position.y = 0.75;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 1.8), glassMat);
  cabin.position.set(-0.25, 1.45, 0);
  g.add(cabin);
  const wheelPos = [[1.5, 0.95], [1.5, -0.95], [-1.5, 0.95], [-1.5, -0.95]];
  for (const [wx, wz] of wheelPos) {
    const w = new THREE.Mesh(wheelGeo, tireMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    g.add(w);
  }
  for (const hz of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, 0.4), lightMat);
    h.position.set(2.22, 0.8, hz);
    g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, 0.4), tailMat);
    t.position.set(-2.22, 0.8, hz);
    g.add(t);
  }
  if (opts.police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 1.1),
      new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    bar.position.set(-0.25, 1.9, 0);
    bar.name = 'lightbar';
    g.add(bar);
    // Police livery: white doors on a black body.
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 2.04),
      new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }));
    door.position.set(0.1, 0.8, 0);
    g.add(door);
  }
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(2.4, 16), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  shadow.scale.set(1, 0.55, 1);
  g.add(shadow);
  return g;
}

export function makeCar(scene, x, z, heading, color, opts = {}) {
  const mesh = makeCarMesh(color, opts);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  const car = {
    mesh, heading, speed: 0, steer: 0,
    x, z, color,
    isPolice: !!opts.police,
    isTraffic: !!opts.traffic,
    axis: opts.axis || 'x',
    dir: opts.dir || 1,
    road: opts.road || 0,
    lane: opts.lane || 0,
    cruise: opts.cruise || CFG.car.trafficSpeed,
    active: true,
  };
  return car;
}

function forward(car) {
  return { x: Math.sin(car.heading), z: Math.cos(car.heading) };
}

// Arcade driving for the car the player controls.
export function driveCar(car, input, dt, collide) {
  const c = CFG.car;
  if (input.up) car.speed += c.accel * dt;
  if (input.down) car.speed -= (car.speed > 0.5 ? c.brake : c.accel * 0.6) * dt;
  if (!input.up && !input.down) car.speed -= Math.sign(car.speed) * 6 * dt;
  if (input.handbrake) car.speed -= Math.sign(car.speed) * 14 * dt;
  car.speed = Math.max(-c.reverseMax, Math.min(c.maxSpeed, car.speed));
  if (Math.abs(car.speed) < 0.15 && !input.up && !input.down) car.speed = 0;

  const grip = input.handbrake ? c.handbrakeGrip : c.grip;
  const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  car.steer += (steerTarget * c.steerMax - car.steer) * Math.min(1, grip * dt);
  const spd = Math.abs(car.speed);
  car.heading += car.steer * (spd / c.maxSpeed) * 2.1 * dt * Math.sign(car.speed || 1);

  const f = forward(car);
  const nx = car.x + f.x * car.speed * dt;
  const nz = car.z + f.z * car.speed * dt;
  const fixed = collide(nx, nz, 2.1);
  // A hard stop on a wall costs speed.
  if (Math.abs(fixed.x - nx) > 0.01 || Math.abs(fixed.z - nz) > 0.01) car.speed *= 0.55;
  car.x = fixed.x;
  car.z = fixed.z;
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
}

// Steer a chaser (police) toward a point, arcade-style.
export function steerToward(car, tx, tz, dt, collide, topSpeed) {
  const dx = tx - car.x;
  const dz = tz - car.z;
  const dist = Math.hypot(dx, dz) || 1;
  const want = Math.atan2(dx, dz);
  let d = want - car.heading;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  car.steer += (Math.max(-1, Math.min(1, d * 1.6)) * CFG.car.steerMax - car.steer) * Math.min(1, 6 * dt);
  car.speed = Math.min(topSpeed, car.speed + CFG.car.accel * 1.15 * dt);
  car.heading += car.steer * (Math.abs(car.speed) / CFG.car.maxSpeed) * 2.1 * dt;
  const f = forward(car);
  const fixed = collide(car.x + f.x * car.speed * dt, car.z + f.z * car.speed * dt, 2.1);
  car.x = fixed.x;
  car.z = fixed.z;
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  return dist;
}

export function spawnTraffic(scene, world, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const road = rng.pick(CFG.roads);
    const dir = rng.chance(0.5) ? 1 : -1;
    const lane = dir > 0 ? CFG.laneOffset : -CFG.laneOffset;
    const along = rng.range(-190, 190);
    const x = axis === 'x' ? road + lane : along;
    const z = axis === 'x' ? along : road + lane;
    const heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const car = makeCar(scene, x, z, heading, rng.pick(CFG.colors.carPalette),
      { traffic: true, axis, dir, road, lane, cruise: CFG.car.trafficSpeed * rng.range(0.8, 1.2) });
    cars.push(car);
  }
  return cars;
}

// Traffic: follow the lane, turn at intersections sometimes, slow for the car ahead.
export function updateTraffic(cars, dt, world) {
  for (const car of cars) {
    if (!car.active) continue;
    // Slow down if another car is close ahead on the same road.
    let target = car.cruise;
    for (const other of cars) {
      if (other === car || !other.active) continue;
      if (other.axis !== car.axis || other.road !== car.road) continue;
      const ahead = car.axis === 'x'
        ? (other.z - car.z) * car.dir
        : (other.x - car.x) * car.dir;
      const side = car.axis === 'x' ? Math.abs(other.x - car.x) : Math.abs(other.z - car.z);
      if (ahead > 0 && ahead < 9 && side < 3) { target = 0; break; }
    }
    car.speed += (target - car.speed) * Math.min(1, 2 * dt);
    const step = car.speed * car.dir * dt;
    if (car.axis === 'x') car.z += step;
    else car.x += step;

    // At an intersection, sometimes turn onto the crossing road.
    const along = car.axis === 'x' ? car.z : car.x;
    for (const r of CFG.roads) {
      if (Math.abs(along - r) < 0.6 && Math.random() < 0.25) {
        const cross = r;
        if (car.axis === 'x') {
          car.axis = 'z';
          car.road = cross;
          car.z = cross + (car.dir > 0 ? CFG.laneOffset : -CFG.laneOffset);
        } else {
          car.axis = 'x';
          car.road = cross;
          car.x = cross + (car.dir > 0 ? CFG.laneOffset : -CFG.laneOffset);
        }
        car.heading = car.axis === 'x'
          ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
          : (car.dir > 0 ? 0 : Math.PI);
        break;
      }
    }
    // Turn around at the city edge instead of driving off the map.
    const pos = car.axis === 'x' ? car.z : car.x;
    if (pos > 195 || pos < -195) {
      car.dir *= -1;
      car.lane = -car.lane;
      car.heading += Math.PI;
    }
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
  }
}

export function nearestCar(cars, x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    if (!car.active) continue;
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}
