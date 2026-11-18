// NEON BAY round 2 — wanted level, police cars, police on foot and the
// police helicopter. Heat 0..100 maps to 0..5 stars; more stars mean more
// cars, faster foot cops, and at 4 stars a helicopter with a spotlight
// joins the hunt. Lay low out of sight and the heat cools off.
import * as THREE from 'three';
import { CFG, flatDist } from './config.js';
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
}

export function setHeat(wanted, heat, now) {
  wanted.heat = Math.max(0, Math.min(100, heat));
  wanted.lastCrimeAt = now;
  wanted.stars = starsFor(wanted.heat);
}

export function updateWanted(wanted, dt, now, policeNear) {
  if (policeNear) return;
  if (now - wanted.lastCrimeAt < CFG.wanted.decayDelay) return;
  if (wanted.heat <= 0) return;
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
  head.position.y = 1.63;
  g.add(head);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.25, 0.1, 10), navy);
  hat.position.y = 1.8;
  g.add(hat);
  const legGeo = new THREE.BoxGeometry(0.2, 0.7, 0.2);
  const legL = new THREE.Mesh(legGeo, navy);
  legL.position.set(-0.14, 0.35, 0);
  g.add(legL);
  const legR = new THREE.Mesh(legGeo, navy);
  legR.position.set(0.14, 0.35, 0);
  g.add(legR);
  g.userData.legL = legL;
  g.userData.legR = legR;
  return g;
}

function makeHeliMesh() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1a2a5a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.6, 2.2), bodyMat);
  g.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.7, 0.7), bodyMat);
  tail.position.set(-4, 0.3, 0);
  g.add(tail);
  const skidMat = new THREE.MeshLambertMaterial({ color: 0x222226 });
  for (const sz of [0.9, -0.9]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.14, 0.14), skidMat);
    skid.position.set(0, -1.1, sz);
    g.add(skid);
  }
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5), skidMat);
  rotor.position.y = 1.1;
  g.add(rotor);
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff2222 }),
  );
  beacon.position.set(0, -0.9, 0);
  g.add(beacon);
  const spot = new THREE.SpotLight(0xfff2c8, 900, 90, 0.32, 0.5);
  spot.position.set(0, -0.8, 0);
  g.add(spot);
  const spotTarget = new THREE.Object3D();
  sceneAddTarget(g, spotTarget);
  spot.target = spotTarget;
  g.userData.rotor = rotor;
  g.userData.spot = spot;
  g.userData.spotTarget = spotTarget;
  g.userData.beacon = beacon;
  return g;
}

// The spotlight target must live in the scene graph under the heli group
// so its world position follows the helicopter.
function sceneAddTarget(group, target) {
  group.add(target);
}

export function createPolice(scene) {
  const heliGroup = makeHeliMesh();
  heliGroup.visible = false;
  scene.add(heliGroup);
  return {
    scene,
    cars: [],
    foot: [],
    footTimer: 0,
    carTimer: 0,
    flashTimer: 0,
    flashOn: false,
    noFoot: false,
    spawnDistance: CFG.police.spawnDistance,
    heli: { group: heliGroup, active: false, rotorSpin: 0 },
  };
}

function spawnPoliceCar(police, px, pz, rng) {
  const ang = rng.next() * Math.PI * 2;
  const x = px + Math.sin(ang) * police.spawnDistance;
  const z = pz + Math.cos(ang) * police.spawnDistance;
  const car = makeCar(police.scene, x, z, 0, 0x14141a, { police: true });
  car.hitCooldown = 0;
  police.cars.push(car);
  return car;
}

function spawnCop(police, px, pz, rng) {
  const ang = rng.next() * Math.PI * 2;
  const x = px + Math.sin(ang) * 40;
  const z = pz + Math.cos(ang) * 40;
  const mesh = makeCopMesh();
  mesh.position.set(x, 0, z);
  police.scene.add(mesh);
  const cop = {
    mesh, x, z, heading: 0, kind: 'cop',
    health: 100, dead: false, arrest: 0, phase: rng.next() * 6,
  };
  police.foot.push(cop);
  return cop;
}

// HUD helper: is the helicopter up right now?
export function heliActive(police) {
  return !!police.heli.active;
}

export function updatePolice(police, dt, now, player, playerCar, wanted, world, rng, onRam) {
  const px = playerCar ? playerCar.x : player.x;
  const pz = playerCar ? playerCar.z : player.z;
  const stars = wanted.stars;
  let near = false;

  // Flashing light bars, alternating red/blue.
  police.flashTimer -= dt;
  if (police.flashTimer <= 0) {
    police.flashTimer = 0.45;
    police.flashOn = !police.flashOn;
  }
  for (const car of police.cars) {
    if (car.beaconL) car.beaconL.material.color.setHex(police.flashOn ? 0xff2222 : 0x551111);
    if (car.beaconR) car.beaconR.material.color.setHex(police.flashOn ? 0x111155 : 0x2244ff);
  }

  // Helicopter: joins at 4+ stars, circles above the player with its
  // spotlight locked on, leaves when the heat drops.
  const heli = police.heli;
  if (stars >= CFG.police.heliMinStars) {
    if (!heli.active) {
      heli.active = true;
      heli.group.visible = true;
      heli.group.position.set(px + 20, CFG.police.heliHeight, pz - 20);
    }
    const hg = heli.group.position;
    const dx = px - hg.x;
    const dz = pz - hg.z;
    const d = Math.hypot(dx, dz);
    if (d > 6) {
      const sp = Math.min(CFG.police.heliSpeed, d * 1.5);
      hg.x += (dx / d) * sp * dt;
      hg.z += (dz / d) * sp * dt;
    }
    hg.y = CFG.police.heliHeight + Math.sin(now * 0.9) * 1.5;
    heli.group.rotation.y = Math.atan2(dx, dz) + Math.PI / 2;
    heli.group.userData.rotor.rotation.y += dt * 22;
    heli.group.userData.spotTarget.position.set(px - hg.x, -hg.y + 0.5, pz - hg.z);
    heli.group.userData.beacon.material.color.setHex(police.flashOn ? 0xff2222 : 0x881111);
    // Note: the heli does NOT count as "police near" for heat decay —
    // otherwise the heat could never cool while it circles, and the
    // 4-star escape in The Last Job would be unwinnable. Ground units
    // still block the cooldown when they are close.
  } else if (heli.active) {
    heli.active = false;
    heli.group.visible = false;
  }

  // Police cars: spawn up to the star-scaled cap, chase and ram.
  const wantCars = stars <= 0 ? 0 : Math.min(CFG.police.maxCars, 1 + Math.floor(stars / 2));
  police.carTimer -= dt;
  if (police.cars.length < wantCars && police.carTimer <= 0) {
    police.carTimer = 2.5;
    spawnPoliceCar(police, px, pz, rng);
  }
  for (let i = police.cars.length - 1; i >= 0; i--) {
    const car = police.cars[i];
    const d = flatDist(car.x, car.z, px, pz);
    if (stars <= 0 || d > CFG.police.despawnDistance) {
      police.scene.remove(car.mesh);
      police.cars.splice(i, 1);
      continue;
    }
    if (d < CFG.police.carNearRadius) near = true;
    const top = CFG.police.carSpeed * (0.85 + stars * 0.05);
    steerToward(car, px, pz, dt, world.collide, top);
    car.hitCooldown = Math.max(0, car.hitCooldown - dt);
    if (d < 3.4 && car.hitCooldown <= 0) {
      car.hitCooldown = 1.2;
      car.speed *= 0.4;
      if (onRam) onRam(CFG.police.ramDamage);
    }
  }

  // Foot cops: only hunt when Jax is on foot — on foot they can arrest him,
  // in a car they could never catch him, and spawning them at 40 m while he
  // drives would make the heat undecaying. Cops already out give up the
  // chase once the car pulls away from them.
  if (!police.noFoot && !playerCar) {
    const wantFoot = stars <= 0 ? 0 : Math.min(CFG.police.maxFoot, stars + 1);
    police.footTimer -= dt;
    if (police.foot.length < wantFoot && police.footTimer <= 0) {
      police.footTimer = 3;
      spawnCop(police, px, pz, rng);
    }
  }
  for (let i = police.foot.length - 1; i >= 0; i--) {
    const cop = police.foot[i];
    if (cop.dead) {
      police.scene.remove(cop.mesh);
      police.foot.splice(i, 1);
      continue;
    }
    const d = flatDist(cop.x, cop.z, px, pz);
    if (stars <= 0 || d > CFG.police.despawnDistance || (playerCar && d > 60)) {
      police.scene.remove(cop.mesh);
      police.foot.splice(i, 1);
      continue;
    }
    if (d < CFG.police.footNearRadius) near = true;
    const dx = px - cop.x;
    const dz = pz - cop.z;
    cop.heading = Math.atan2(dx, dz);
    const sp = CFG.police.footSpeed * (playerCar ? 0.8 : 1);
    cop.x += Math.sin(cop.heading) * sp * dt;
    cop.z += Math.cos(cop.heading) * sp * dt;
    cop.phase += dt * 9;
    const swing = Math.sin(cop.phase) * 0.5;
    cop.mesh.userData.legL.rotation.x = swing;
    cop.mesh.userData.legR.rotation.x = -swing;
    cop.mesh.position.set(cop.x, 0, cop.z);
    cop.mesh.rotation.y = cop.heading;
    // Arrest: standing next to Jax on foot for a moment ends the run.
    if (!playerCar && d < CFG.police.arrestRadius) {
      cop.arrest += dt;
      if (cop.arrest >= CFG.police.arrestTime) return 'busted';
    } else {
      cop.arrest = 0;
    }
  }

  return near ? 'near' : null;
}

// Round 3 note: the wanted system and its responders are as shipped —
// patrol cars that chase and ram, officers on foot, and the police heli
// that joins once the heat climbs high enough.

// Round 3 note, continued: heat decays when Jax lays low out of sight,
// which is what makes the Getaway mission winnable without a shootout.
