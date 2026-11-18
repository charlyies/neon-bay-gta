// NEON BAY round 2 — six story missions, the rival crew, taxi fares and
// the checkpoint time trial. Missions chain: finishing one starts the next,
// and finishing all six ends the story. Each mission drives a beacon, an
// objective line and a payout; the later jobs add timed legs and a 4-star
// escape so the finale feels bigger than the opener.
import * as THREE from 'three';
import { CFG, flatDist } from './config.js';
import { makeCar } from './vehicles.js';
import { setHeat } from './police.js';

// A glowing beacon pillar + ground ring marking an objective.
function makeBeacon(color) {
  const g = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.9, 30, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.13,
      side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  pillar.position.y = 15;
  g.add(pillar);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.2, 28),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  g.add(ring);
  g.visible = false;
  return g;
}

function makeEnemyMesh() {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: 0x8a1a2a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x1a1a22 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.72, 0.34), shirt);
  torso.position.y = 1.06;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skin);
  head.position.y = 1.63;
  g.add(head);
  const legGeo = new THREE.BoxGeometry(0.2, 0.7, 0.2);
  for (const lx of [-0.14, 0.14]) {
    const leg = new THREE.Mesh(legGeo, pants);
    leg.position.set(lx, 0.35, 0);
    g.add(leg);
  }
  // Health bar floating above the head, scaled by remaining health.
  const barBg = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.14, 0.05),
    new THREE.MeshBasicMaterial({ color: 0x222222 }),
  );
  barBg.position.y = 2.15;
  g.add(barBg);
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(1.05, 0.1, 0.06),
    new THREE.MeshBasicMaterial({ color: 0xff4444 }),
  );
  bar.position.y = 2.15;
  g.add(bar);
  g.userData.bar = bar;
  return g;
}

export function createMissions(scene, world, rng) {
  const beacon = makeBeacon(0xffd23c);
  scene.add(beacon);
  const taxiMarker = makeBeacon(0x3cd86a);
  scene.add(taxiMarker);
  return {
    scene, world, rng,
    index: 0, active: false, stage: 0, stageTimer: 0,
    beacon, taxiMarker,
    sedan: null, van: null, sports: null,
    enemies: [],
    taxi: { active: false, hasPassenger: false, x: 0, z: 0, destX: 0, destZ: 0 },
    trial: { active: false, checkpoint: 0, timeLeft: 0, points: [] },
    objectiveText: '',
  };
}

function setBeacon(m, x, z, visible, color) {
  m.beacon.visible = visible;
  if (visible) {
    m.beacon.position.set(x, 0, z);
    if (color !== undefined) {
      m.beacon.children[0].material.color.setHex(color);
      m.beacon.children[1].material.color.setHex(color);
    }
  }
}

function setObjective(m, game, text) {
  m.objectiveText = text;
  game.hud.setObjective(text);
}

function payOut(game, amount, reason) {
  game.cash += amount;
  game.hud.setCash(game.cash);
  game.hud.toast(`${reason} +$${amount}`);
  game.audio.jingle();
  game.effects.ringBurst(game.player.x, 1.5, game.player.z, 0xffd23c);
}

export function missionTarget(m) {
  if (!m.active || !m.beacon.visible) return null;
  return { x: m.beacon.position.x, z: m.beacon.position.z };
}

function clearEnemies(m) {
  for (const e of m.enemies) m.scene.remove(e.mesh);
  m.enemies = [];
}

function spawnEnemies(m, game) {
  clearEnemies(m);
  for (let i = 0; i < CFG.enemy.count; i++) {
    const mesh = makeEnemyMesh();
    const x = CFG.places.docks.x - 14 + i * 9;
    const z = CFG.places.docks.z - 8 + (i % 2) * 14;
    mesh.position.set(x, 0, z);
    m.scene.add(mesh);
    const enemy = {
      mesh, x, z, heading: 0, kind: 'enemy',
      health: CFG.enemy.health, dead: false,
      shootTimer: 1 + i * 0.4, phase: i * 1.7,
    };
    mesh.userData.owner = enemy;
    m.enemies.push(enemy);
  }
}

export function startMission(m, i, game) {
  const def = CFG.missions[i];
  m.index = i;
  m.active = true;
  m.stage = 0;
  m.stageTimer = 0;
  clearEnemies(m);
  const gold = 0xffd23c;
  if (i === 0) {
    if (!m.sedan) {
      m.sedan = makeCar(m.scene, CFG.places.sedan.x, CFG.places.sedan.z, 0.4, 0xe8b93c, {});
      m.sedan.mesh.userData.missionCar = true;
    }
    setBeacon(m, CFG.places.sedan.x, CFG.places.sedan.z, true, gold);
    setObjective(m, game, `Mission 1: Hot Wheels — Steal the marked sedan`);
  } else if (i === 1) {
    setHeat(game.wanted, 25, game.now); // 2 stars to lose
    game.hud.setStars(game.wanted.stars);
    setBeacon(m, CFG.places.safehouse.x, CFG.places.safehouse.z, false);
    setObjective(m, game, `Mission 2: Getaway — Lose the heat, then reach the safehouse`);
  } else if (i === 2) {
    spawnEnemies(m, game);
    setBeacon(m, CFG.places.docks.x, CFG.places.docks.z, true, 0xff4444);
    setObjective(m, game, `Mission 3: Payback — Take out the rival crew at the docks (0/4)`);
  } else if (i === 3) {
    if (!m.van) m.van = makeCar(m.scene, CFG.places.bankVan.x, CFG.places.bankVan.z, 0, 0xd7d7de, { kind: 'van' });
    setBeacon(m, CFG.places.bankVan.x, CFG.places.bankVan.z, true, gold);
    setObjective(m, game, `Mission 4: The Big Score — Grab the package from the bank van`);
  } else if (i === 4) {
    setBeacon(m, CFG.places.harbor.x, CFG.places.harbor.z, true, 0xff2e88);
    setObjective(m, game, `Mission 5: Harbor Lights — Pick up the cargo at the harbor`);
  } else if (i === 5) {
    if (!m.sports) {
      m.sports = makeCar(m.scene, CFG.places.casino.x, CFG.places.casino.z, -0.6, 0xff2e88, { kind: 'sports' });
      m.sports.mesh.userData.missionCar = true;
    }
    setBeacon(m, CFG.places.casino.x, CFG.places.casino.z, true, 0xff2e88);
    setObjective(m, game, `Mission 6: The Last Job — Steal the sports car from the casino`);
  }
  game.hud.toast(`${def.name}: ${def.brief}`);
}

function completeMission(m, game) {
  const def = CFG.missions[m.index];
  payOut(game, def.pay, `Mission complete: ${def.name}`);
  setBeacon(m, 0, 0, false);
  m.active = false;
  if (m.index + 1 < CFG.missions.length) {
    startMission(m, m.index + 1, game);
  } else {
    game.state = 'story-complete';
    game.hud.showEnd('story-complete', { cash: game.cash, missions: CFG.missions.length });
  }
}

function playerPos(game) {
  const p = game.player;
  return p.inCar ? { x: p.inCar.x, z: p.inCar.z } : { x: p.x, z: p.z };
}

function updateEnemies(m, dt, game) {
  const pos = playerPos(game);
  let down = 0;
  for (const e of m.enemies) {
    if (e.dead) { down += 1; continue; }
    const d = flatDist(e.x, e.z, pos.x, pos.z);
    // Creep toward Jax when he is close, and shoot on a timer.
    if (d < 46 && d > 6) {
      e.heading = Math.atan2(pos.x - e.x, pos.z - e.z);
      e.x += Math.sin(e.heading) * 2.6 * dt;
      e.z += Math.cos(e.heading) * 2.6 * dt;
    }
    e.shootTimer -= dt;
    if (d < CFG.enemy.shootRange && e.shootTimer <= 0) {
      e.shootTimer = CFG.enemy.shootInterval * (0.9 + Math.random() * 0.4);
      game.damagePlayer(CFG.enemy.damage);
      game.effects.muzzle(e.x, 1.4, e.z);
    }
    e.mesh.position.set(e.x, 0, e.z);
    e.mesh.rotation.y = e.heading;
    e.mesh.userData.bar.scale.x = Math.max(0.01, e.health / CFG.enemy.health);
    e.mesh.userData.bar.position.x = -(1 - e.health / CFG.enemy.health) * 0.52;
  }
  if (m.index === 2 && m.active && down >= CFG.enemy.count) {
    completeMission(m, game);
  } else if (m.index === 2 && m.active) {
    if (m.lastDown !== down) {
      m.lastDown = down;
      setObjective(m, game, `Mission 3: Payback — Take out the rival crew at the docks (${down}/4)`);
    }
  }
}

export function updateMissions(m, dt, game) {
  // Beacon pulse.
  if (m.beacon.visible) {
    m.beacon.children[0].material.opacity = 0.14 + Math.sin(game.now * 3) * 0.06;
    m.beacon.rotation.y += dt * 0.8;
  }
  if (m.taxi.active) {
    m.taxiMarker.visible = true;
    m.taxiMarker.position.set(m.taxi.x, 0, m.taxi.z);
    m.taxiMarker.rotation.y += dt;
  } else {
    m.taxiMarker.visible = false;
  }
  if (m.active) updateEnemies(m, dt, game);
  if (!m.active) {
    updateTaxi(m, dt, game);
    updateTrial(m, dt, game);
    return;
  }
  const pos = playerPos(game);
  const def = CFG.missions[m.index];

  if (m.index === 0) {
    if (m.stage === 0) {
      if (game.player.inCar === m.sedan) {
        m.stage = 1;
        setBeacon(m, CFG.places.garage.x, CFG.places.garage.z, true, 0x3cd86a);
        setObjective(m, game, `Mission 1: Hot Wheels — Deliver the sedan to the garage`);
      }
    } else if (flatDist(pos.x, pos.z, CFG.places.garage.x, CFG.places.garage.z) < 9 && game.player.inCar === m.sedan) {
      completeMission(m, game);
    }
  } else if (m.index === 1) {
    if (m.stage === 0) {
      if (game.wanted.stars === 0) {
        m.stage = 1;
        setBeacon(m, CFG.places.safehouse.x, CFG.places.safehouse.z, true, 0x3cd86a);
        setObjective(m, game, `Mission 2: Getaway — Reach the safehouse`);
      }
    } else if (flatDist(pos.x, pos.z, CFG.places.safehouse.x, CFG.places.safehouse.z) < 8) {
      completeMission(m, game);
    }
  } else if (m.index === 2) {
    // Completion is handled in updateEnemies once all four are down.
  } else if (m.index === 3) {
    if (m.stage === 0) {
      if (flatDist(pos.x, pos.z, CFG.places.bankVan.x, CFG.places.bankVan.z) < 5) {
        m.stage = 1;
        setHeat(game.wanted, 45, game.now); // 3-star heat for the run
        game.hud.setStars(game.wanted.stars);
        setBeacon(m, CFG.places.dropoff.x, CFG.places.dropoff.z, true, 0x3cd86a);
        setObjective(m, game, `Mission 4: The Big Score — Deliver the package across town`);
        game.hud.toast('Package grabbed! 3-star heat — run!');
      }
    } else if (flatDist(pos.x, pos.z, CFG.places.dropoff.x, CFG.places.dropoff.z) < 8) {
      completeMission(m, game);
    }
  } else if (m.index === 4) {
    if (m.stage === 0) {
      if (flatDist(pos.x, pos.z, CFG.places.harbor.x, CFG.places.harbor.z) < 5) {
        m.stage = 1;
        m.stageTimer = CFG.harborLegSeconds;
        setHeat(game.wanted, 40, game.now); // 3 stars for the timed leg
        game.hud.setStars(game.wanted.stars);
        setBeacon(m, CFG.places.yacht.x, CFG.places.yacht.z, true, 0x3cd86a);
        setObjective(m, game, `Mission 5: Harbor Lights — Deliver to Mara's yacht (${Math.ceil(m.stageTimer)}s)`);
        game.hud.toast('Cargo secured! Timed run to the yacht!');
      }
    } else {
      m.stageTimer -= dt;
      setObjective(m, game, `Mission 5: Harbor Lights — Deliver to Mara's yacht (${Math.max(0, Math.ceil(m.stageTimer))}s)`);
      if (flatDist(pos.x, pos.z, CFG.places.yacht.x, CFG.places.yacht.z) < 10) {
        if (game.wanted.stars <= 3) {
          game.cash += CFG.harborLowHeatBonus;
          game.hud.setCash(game.cash);
          game.hud.toast(`Clean run bonus +$${CFG.harborLowHeatBonus}`);
        }
        completeMission(m, game);
      } else if (m.stageTimer <= 0) {
        m.stage = 0;
        setBeacon(m, CFG.places.harbor.x, CFG.places.harbor.z, true, 0xff2e88);
        setObjective(m, game, `Mission 5: Harbor Lights — Pick up the cargo at the harbor`);
        game.hud.toast('Too slow! Grab the cargo again.');
      }
    }
  } else if (m.index === 5) {
    if (m.stage === 0) {
      if (game.player.inCar === m.sports) {
        m.stage = 1;
        setHeat(game.wanted, 60, game.now); // 4-star heat: the heli joins
        game.hud.setStars(game.wanted.stars);
        setBeacon(m, 0, 0, false);
        setObjective(m, game, `Mission 6: The Last Job — Lose the 4-star heat!`);
        game.hud.toast('4-star heat! The helicopter is up — lose them!');
      }
    } else if (m.stage === 1) {
      if (game.wanted.stars <= 2) {
        m.stage = 2;
        setBeacon(m, CFG.places.yacht.x, CFG.places.yacht.z, true, 0x3cd86a);
        setObjective(m, game, `Mission 6: The Last Job — Deliver the sports car to Mara's yacht`);
        game.hud.toast('Heat shaken! Deliver the car to the yacht.');
      }
    } else if (flatDist(pos.x, pos.z, CFG.places.yacht.x, CFG.places.yacht.z) < 10 && game.player.inCar === m.sports) {
      completeMission(m, game);
    }
  }

  updateTaxi(m, dt, game);
  updateTrial(m, dt, game);
}

// --- Taxi fares ------------------------------------------------------------
export function maybeStartTaxi(m, game) {
  if (m.taxi.active || !game.player.inCar) return;
  if (Math.random() > 0.5) return;
  const spot = m.world.randomStreetPoint();
  m.taxi.active = true;
  m.taxi.hasPassenger = false;
  m.taxi.x = spot.x;
  m.taxi.z = spot.z;
  game.hud.toast('Taxi fare nearby — drive to the green marker (E to pick up)');
}

export function taxiInteract(m, game) {
  if (!m.taxi.active || !game.player.inCar) return false;
  const car = game.player.inCar;
  if (!m.taxi.hasPassenger) {
    if (flatDist(car.x, car.z, m.taxi.x, m.taxi.z) < CFG.taxi.pickupRadius) {
      const dest = m.world.randomStreetPoint();
      m.taxi.hasPassenger = true;
      m.taxi.destX = dest.x;
      m.taxi.destZ = dest.z;
      m.taxi.x = dest.x;
      m.taxi.z = dest.z;
      game.hud.toast('Passenger in! Drive to the green marker.');
      return true;
    }
  } else if (flatDist(car.x, car.z, m.taxi.destX, m.taxi.destZ) < CFG.taxi.dropoffRadius) {
    m.taxi.active = false;
    m.taxi.hasPassenger = false;
    game.cash += CFG.taxi.pay;
    game.hud.setCash(game.cash);
    game.hud.toast(`Fare complete +$${CFG.taxi.pay}`);
    game.audio.blip();
    return true;
  }
  return false;
}

function updateTaxi(m, dt, game) {
  // The taxi marker is drawn in updateMissions; nothing timed here.
}

// --- Checkpoint time trial -------------------------------------------------
// The trial borrows the mission beacon while it runs; the beacon spot it
// replaces is saved here and restored when the trial ends.
export function startTrial(m, game) {
  if (m.trial.active) return;
  m.trial.active = true;
  m.trial.checkpoint = 0;
  m.trial.timeLeft = CFG.trial.timeLimit;
  m.trial.points = [];
  m.savedBeacon = { x: m.beacon.position.x, z: m.beacon.position.z, visible: m.beacon.visible };
  for (let i = 0; i < CFG.trial.checkpoints; i++) {
    m.trial.points.push(m.world.randomStreetPoint());
  }
  const p = m.trial.points[0];
  setBeacon(m, p.x, p.z, true, 0x2ee6ff);
  game.hud.toast(`Time trial! ${CFG.trial.checkpoints} checkpoints in ${CFG.trial.timeLimit}s — drive!`);
}

function updateTrial(m, dt, game) {
  const t = m.trial;
  if (!t.active) return;
  t.timeLeft -= dt;
  const pos = playerPos(game);
  const p = t.points[t.checkpoint];
  if (p && flatDist(pos.x, pos.z, p.x, p.z) < 8) {
    t.checkpoint += 1;
    game.audio.blip();
    if (t.checkpoint >= t.points.length) {
      t.active = false;
      game.cash += CFG.trial.pay;
      game.hud.setCash(game.cash);
      game.hud.toast(`Trial complete! +$${CFG.trial.pay}`);
      game.audio.jingle();
      restoreBeacon(m, game);
      return;
    }
    const next = t.points[t.checkpoint];
    setBeacon(m, next.x, next.z, true, 0x2ee6ff);
    game.hud.toast(`Checkpoint ${t.checkpoint + 1}/${t.points.length} — ${Math.ceil(t.timeLeft)}s left`);
  }
  if (t.timeLeft <= 0) {
    t.active = false;
    game.hud.toast('Trial failed — out of time. Press T to try again.');
    restoreBeacon(m, game);
  }
}

function restoreBeacon(m, game) {
  if (m.savedBeacon) {
    setBeacon(m, m.savedBeacon.x, m.savedBeacon.z, m.savedBeacon.visible);
    m.savedBeacon = null;
  }
  if (m.active) {
    const def = CFG.missions[m.index];
    setObjective(m, game, m.objectiveText || `Mission ${def.id}: ${def.name} — ${def.objective}`);
  }
}
