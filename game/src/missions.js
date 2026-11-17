// NEON BAY — story missions, rival crew, taxi fares and the time trial.
// Written fresh for the make.fun gta6-01 entry.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makeCar } from './vehicles.js';
import { setHeat } from './police.js';

// A glowing beacon pillar + ground ring marking an objective.
function makeBeacon(color) {
  const g = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 1.1, 30, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.18,
      side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  pillar.position.y = 15;
  g.add(pillar);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(3.0, 3.8, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  g.add(ring);
  return g;
}

function makeEnemyMesh() {
  const g = new THREE.Group();
  const red = new THREE.MeshLambertMaterial({ color: 0x8a1a1a });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a1a22 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.72, 0.34), red);
  torso.position.y = 1.06;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skin);
  head.position.y = 1.64;
  g.add(head);
  const legGeo = new THREE.BoxGeometry(0.2, 0.72, 0.2);
  for (const lx of [-0.14, 0.14]) {
    const leg = new THREE.Mesh(legGeo, dark);
    leg.position.set(lx, 0.36, 0);
    g.add(leg);
  }
  // Health bar: dark back + green front, billboarded in update.
  const barBg = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 0.16),
    new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.85 }),
  );
  barBg.position.y = 2.15;
  barBg.name = 'barBg';
  g.add(barBg);
  const barFg = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x3cd86a, transparent: true, opacity: 0.95 }),
  );
  barFg.position.y = 2.15;
  barFg.position.z = 0.01;
  barFg.name = 'barFg';
  g.add(barFg);
  return g;
}

export function createMissions(scene, world, rng) {
  const beacon = makeBeacon(0xffd23c);
  beacon.visible = false;
  scene.add(beacon);
  return {
    scene, world, rng, beacon,
    index: 0, // 0-based mission; 4 = story complete
    phase: 'idle',
    sedan: null,
    van: null,
    enemies: [],
    taxi: null,
    trial: null,
    packageTaken: false,
    kills: 0,
  };
}

function setBeacon(m, x, z, visible, color) {
  m.beacon.position.set(x, 0, z);
  m.beacon.visible = visible;
  if (color !== undefined) {
    m.beacon.children[0].material.color.setHex(color);
    m.beacon.children[1].material.color.setHex(color);
  }
}

export function missionTarget(m) {
  if (m.index >= 4) return null;
  if (m.phase === 'steal') return { x: CFG.places.sedan.x, z: CFG.places.sedan.z, label: 'Steal the sedan' };
  if (m.phase === 'deliver') return { x: CFG.places.garage.x, z: CFG.places.garage.z, label: 'Deliver to the garage' };
  if (m.phase === 'lose') return null;
  if (m.phase === 'reach') return { x: CFG.places.safehouse.x, z: CFG.places.safehouse.z, label: 'Reach the safehouse' };
  if (m.phase === 'fight') return { x: CFG.places.docks.x, z: CFG.places.docks.z, label: 'Clear the docks' };
  if (m.phase === 'grab') return { x: CFG.places.bankVan.x, z: CFG.places.bankVan.z, label: 'Grab the package' };
  if (m.phase === 'run') return { x: CFG.places.dropoff.x, z: CFG.places.dropoff.z, label: 'Deliver the package' };
  return null;
}

export function startMission(m, i, game) {
  const def = CFG.missions[i];
  m.index = i;
  m.kills = 0;
  if (i === 0) {
    m.phase = 'steal';
    if (!m.sedan) {
      m.sedan = makeCar(game.scene, CFG.places.sedan.x, CFG.places.sedan.z, Math.PI / 2, 0xe8b93c, {});
      m.sedan.isMission = true;
    }
    setBeacon(m, CFG.places.sedan.x, CFG.places.sedan.z, true, 0xffd23c);
  } else if (i === 1) {
    m.phase = 'lose';
    setHeat(game.wanted, 40, game.now);
    setBeacon(m, 0, 0, false);
  } else if (i === 2) {
    m.phase = 'fight';
    m.enemies = [];
    for (let k = 0; k < CFG.enemy.count; k++) {
      const x = CFG.places.docks.x + game.rng.range(-14, 14);
      const z = CFG.places.docks.z + game.rng.range(-10, 10);
      const mesh = makeEnemyMesh();
      mesh.position.set(x, 0, z);
      game.scene.add(mesh);
      const enemy = {
        mesh, x, z, health: CFG.enemy.health, maxHealth: CFG.enemy.health,
        shootTimer: game.rng.range(0.5, 1.5), dead: false, phase: 0,
      };
      mesh.traverse((o) => { o.userData.owner = enemy; });
      m.enemies.push(enemy);
    }
    setBeacon(m, CFG.places.docks.x, CFG.places.docks.z, true, 0xff3c3c);
  } else if (i === 3) {
    m.phase = 'grab';
    m.packageTaken = false;
    if (!m.van) {
      const van = makeCar(game.scene, CFG.places.bankVan.x, CFG.places.bankVan.z, 0, 0xd7d7de, {});
      van.mesh.scale.set(1.25, 1.15, 1);
      m.van = van;
    }
    setBeacon(m, CFG.places.bankVan.x, CFG.places.bankVan.z, true, 0xffd23c);
  }
  return def;
}

function payOut(game, amount, reason) {
  game.cash += amount;
  game.hud.setCash(game.cash);
  game.hud.toast(`${reason}  +$${amount}`);
  game.audio.jingle();
}

function completeMission(m, game) {
  const def = CFG.missions[m.index];
  payOut(game, def.pay, `Mission complete: ${def.name}`);
  game.hud.setObjective('Mission complete!');
  setBeacon(m, 0, 0, false);
  m.index += 1;
  if (m.index >= 4) {
    m.phase = 'done';
    game.state = 'story-complete';
    game.hud.showEnd('story', { cash: game.cash });
    return;
  }
  startMission(m, m.index, game);
  const next = CFG.missions[m.index];
  game.hud.setObjective(`Mission ${next.id}: ${next.name} — ${next.objective}`);
  game.hud.toast(`${next.name}: ${next.brief}`);
}

// Called every frame while playing. `game` carries player, wanted, hud, audio, etc.
export function updateMissions(m, dt, game) {
  const events = [];
  const px = game.player.inCar ? game.player.inCar.x : game.player.x;
  const pz = game.player.inCar ? game.player.inCar.z : game.player.z;

  if (m.index === 0 && m.phase === 'steal') {
    if (game.player.inCar === m.sedan) {
      m.phase = 'deliver';
      setBeacon(m, CFG.places.garage.x, CFG.places.garage.z, true, 0xffd23c);
      game.hud.setObjective('Mission 1: Hot Wheels — Deliver the sedan to the garage');
    }
  } else if (m.index === 0 && m.phase === 'deliver') {
    if (game.player.inCar === m.sedan
      && Math.hypot(px - CFG.places.garage.x, pz - CFG.places.garage.z) < 7) {
      completeMission(m, game);
    }
  } else if (m.index === 1 && m.phase === 'lose') {
    if (game.wanted.stars === 0) {
      m.phase = 'reach';
      setBeacon(m, CFG.places.safehouse.x, CFG.places.safehouse.z, true, 0x3cd86a);
      game.hud.setObjective('Mission 2: Getaway — Heat lost. Reach the safehouse');
      game.hud.toast('Clean. Now slip to the safehouse.');
    }
  } else if (m.index === 1 && m.phase === 'reach') {
    if (Math.hypot(px - CFG.places.safehouse.x, pz - CFG.places.safehouse.z) < 7) {
      completeMission(m, game);
    }
  } else if (m.index === 2 && m.phase === 'fight') {
    updateEnemies(m, dt, game);
    const alive = m.enemies.filter((e) => !e.dead).length;
    game.hud.setObjective(`Mission 3: Payback — Take out the rival crew (${CFG.enemy.count - alive}/4)`);
    if (alive === 0) completeMission(m, game);
  } else if (m.index === 3 && m.phase === 'grab') {
    if (!game.player.inCar
      && Math.hypot(px - CFG.places.bankVan.x, pz - CFG.places.bankVan.z) < 3) {
      m.packageTaken = true;
      m.phase = 'run';
      setHeat(game.wanted, 60, game.now);
      setBeacon(m, CFG.places.dropoff.x, CFG.places.dropoff.z, true, 0xffd23c);
      game.hud.setObjective('Mission 4: The Big Score — Deliver the package across town');
      game.hud.toast('Package grabbed! 3-star heat — run it across town.');
      game.audio.jingle();
    }
  } else if (m.index === 3 && m.phase === 'run') {
    if (Math.hypot(px - CFG.places.dropoff.x, pz - CFG.places.dropoff.z) < 7) {
      completeMission(m, game);
    }
  }

  updateTaxi(m, dt, game);
  updateTrial(m, dt, game);
  return events;
}

// Rival crew: shuffle toward the player, shoot with a tracer, die by bullets/fists.
function updateEnemies(m, dt, game) {
  const px = game.player.inCar ? game.player.inCar.x : game.player.x;
  const pz = game.player.inCar ? game.player.inCar.z : game.player.z;
  for (const e of m.enemies) {
    if (e.dead) continue;
    const dx = px - e.x;
    const dz = pz - e.z;
    const dist = Math.hypot(dx, dz) || 1;
    // Close in to shooting range, then hold and fire.
    if (dist > CFG.enemy.shootRange * 0.7) {
      e.x += (dx / dist) * 3.2 * dt;
      e.z += (dz / dist) * 3.2 * dt;
      e.phase += dt * 8;
    }
    e.mesh.position.set(e.x, 0, e.z);
    e.mesh.rotation.y = Math.atan2(dx, dz);
    const swing = Math.sin(e.phase) * 0.4;
    for (const child of e.mesh.children) {
      if (child.name === 'leg') child.rotation.x = child.position.x < 0 ? swing : -swing;
    }
    // Health bar faces the camera and shrinks with health.
    const barFg = e.mesh.getObjectByName('barFg');
    const barBg = e.mesh.getObjectByName('barBg');
    if (barFg && barBg) {
      barFg.scale.x = Math.max(0.01, e.health / e.maxHealth);
      barFg.position.x = -(1.3 - 1.3 * (e.health / e.maxHealth)) / 2;
      barFg.lookAt(game.camera.position);
      barBg.lookAt(game.camera.position);
    }
    // Fire at Jax.
    e.shootTimer -= dt;
    if (e.shootTimer <= 0 && dist < CFG.enemy.shootRange) {
      e.shootTimer = CFG.enemy.shootInterval * game.rng.range(0.8, 1.4);
      if (game.rng.chance(0.55)) {
        game.damagePlayer(CFG.enemy.damage, 'shot');
        game.audio.gunshot();
        // Tracer line from the enemy to Jax, fading fast.
        const geo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(e.x, 1.4, e.z),
          new THREE.Vector3(px, 1.2, pz),
        ]);
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
          color: 0xffd23c, transparent: true, opacity: 0.9,
        }));
        game.scene.add(line);
        game.tracers.push({ line, life: 0.12 });
      }
    }
  }
  // Remove dead enemies from the scene.
  for (const e of m.enemies) {
    if (e.dead && e.mesh.visible) {
      e.mesh.visible = false;
      e.mesh.position.y = -50;
    }
  }
}

// --- Side work: taxi fares -------------------------------------------------
export function maybeStartTaxi(m, game) {
  if (m.taxi || !game.player.inCar) return;
  // A fare appears at a random sidewalk point near the player.
  const car = game.player.inCar;
  const spot = game.world.randomStreetPoint();
  const mesh = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.32),
    new THREE.MeshLambertMaterial({ color: 0xe8c93c }));
  torso.position.y = 1.05;
  mesh.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xf0c8a0 }));
  head.position.y = 1.62;
  mesh.add(head);
  mesh.position.set(spot.x, 0, spot.z);
  game.scene.add(mesh);
  const dest = game.world.randomStreetPoint();
  m.taxi = { mesh, x: spot.x, z: spot.z, dest, state: 'waiting' };
  game.hud.toast('Taxi fare nearby — drive up and press E.');
}

export function taxiInteract(m, game) {
  if (!m.taxi || !game.player.inCar) return false;
  const car = game.player.inCar;
  if (m.taxi.state === 'waiting'
    && Math.hypot(car.x - m.taxi.x, car.z - m.taxi.z) < CFG.taxi.pickupRadius) {
    m.taxi.state = 'riding';
    m.taxi.mesh.visible = false;
    setBeacon(m, m.taxi.dest.x, m.taxi.dest.z, true, 0x3cd86a);
    game.hud.toast('Fare picked up — take them to the green marker.');
    return true;
  }
  return false;
}

function updateTaxi(m, dt, game) {
  if (!m.taxi) return;
  if (m.taxi.state === 'riding' && game.player.inCar) {
    const car = game.player.inCar;
    if (Math.hypot(car.x - m.taxi.dest.x, car.z - m.taxi.dest.z) < CFG.taxi.dropoffRadius) {
      payOut(game, CFG.taxi.pay, 'Taxi fare');
      game.scene.remove(m.taxi.mesh);
      setBeacon(m, 0, 0, false);
      m.taxi = null;
    }
  }
}

// --- Side work: checkpoint time trial --------------------------------------
export function startTrial(m, game) {
  if (m.trial) return;
  const rings = [];
  const ringGeo = new THREE.TorusGeometry(4, 0.35, 8, 24);
  for (let k = 0; k < CFG.trial.checkpoints; k++) {
    const spot = game.world.randomStreetPoint();
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x3cd8d8 }));
    ring.position.set(spot.x, 2.2, spot.z);
    ring.rotation.y = Math.PI / 2;
    game.scene.add(ring);
    rings.push({ mesh: ring, x: spot.x, z: spot.z, done: false });
  }
  m.trial = { rings, at: 0, timeLeft: CFG.trial.timeLimit };
  game.hud.toast(`Time trial: ${CFG.trial.checkpoints} rings in ${CFG.trial.timeLimit}s — GO!`);
}

function updateTrial(m, dt, game) {
  if (!m.trial) return;
  const t = m.trial;
  t.timeLeft -= dt;
  const px = game.player.inCar ? game.player.inCar.x : game.player.x;
  const pz = game.player.inCar ? game.player.inCar.z : game.player.z;
  const ring = t.rings[t.at];
  if (ring && Math.hypot(px - ring.x, pz - ring.z) < 5) {
    ring.done = true;
    ring.mesh.material.color.setHex(0x3cd86a);
    t.at += 1;
    game.audio.blip();
    if (t.at >= t.rings.length) {
      payOut(game, CFG.trial.pay, 'Time trial');
      for (const r of t.rings) game.scene.remove(r.mesh);
      m.trial = null;
      return;
    }
    game.hud.toast(`Ring ${t.at + 1}/${t.rings.length} — keep going!`);
  }
  if (t.timeLeft <= 0) {
    game.hud.toast('Time trial failed — out of time.');
    for (const r of t.rings) game.scene.remove(r.mesh);
    m.trial = null;
  }
}
