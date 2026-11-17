// NEON BAY — deterministic screenshot staging for ?shot=<name>&seed=<n>.
// Written fresh for the make.fun gta6-01 entry.
import { CFG } from './config.js';
import { enterCar } from './player.js';
import { setHeat } from './police.js';
import { startMission, missionTarget } from './missions.js';

// Each shot stages a readable frame: camera placed, actors spawned, HUD set.
// Called once after init; the game loop keeps running so traffic, sirens and
// the water stay alive in the captured frame.
export function stageShot(name, seed, game) {
  const g = game;
  g.shotMode = name;
  g.godMode = true; // staged frames must not end in WASTED mid-capture
  g.state = 'playing';
  g.hud.hideTitle();
  g.hud.hidePause();
  g.hud.hideEnd();

  if (name === 'start') {
    // Title over the city at dusk: high camera looking down the boulevard
    // toward the beach and the sun.
    g.hud.showTitle(false);
    g.camera.position.set(-40, 55, 190);
    g.camera.lookAt(0, 8, -40);
    g.rig.pos.set(-40, 55, 190);
    g.rig.look.set(0, 8, -40);
    g.rig.yaw = Math.PI;
    g.player.x = CFG.places.start.x;
    g.player.z = CFG.places.start.z;
    g.player.mesh.position.set(g.player.x, 0, g.player.z);
    return;
  }

  if (name === 'play') {
    // On foot beside the marked sedan, HUD + minimap live, mission 1 up.
    // Jax stands 8 m off, facing the sedan, camera pulled back so the
    // beacon reads as a marker, not a wall of light.
    startMission(g.missions, 0, g);
    g.player.x = CFG.places.sedan.x - 8;
    g.player.z = CFG.places.sedan.z + 6;
    g.player.heading = Math.atan2(
      CFG.places.sedan.x - g.player.x, CFG.places.sedan.z - g.player.z);
    g.player.mesh.position.set(g.player.x, 0, g.player.z);
    g.player.mesh.rotation.y = g.player.heading;
    g.rig.dist = 14;
    g.cash = 1250;
    g.hud.setCash(g.cash);
    g.hud.setHealth(g.player.health);
    g.hud.setStars(0);
    g.hud.setObjective('Mission 1: Hot Wheels — Steal the marked sedan');
    g.rig.snapBehind(g.player.heading);
    return;
  }

  if (name === 'chase') {
    // Driving fast with two police cars on the tail, 3 stars, mission 2 up.
    startMission(g.missions, 1, g);
    setHeat(g.wanted, 45, g.now); // 3 stars (thresholds: 40 = 3, 60 = 4)
    const car = g.missions.sedan || g.traffic[0];
    g.player.x = 29;
    g.player.z = 29;
    enterCar(g.player, car);
    car.x = 29;
    car.z = 29;
    car.heading = 0;
    car.speed = 24;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    g.cash = 2050;
    g.hud.setCash(g.cash);
    g.hud.setHealth(g.player.health);
    g.hud.setStars(3);
    g.hud.setObjective('Mission 2: Getaway — Lose the heat, then reach the safehouse');
    g.hud.toast('Lose the heat!');
    // Two police cars ahead as a roadblock, lights flashing, closing in.
    // (Chasers behind the getaway car sit behind the chase camera, so the
    // visible pursuit is staged ahead.)
    for (let k = 0; k < 2; k++) {
      const ahead = 24 + k * 8;
      const side = (k - 0.5) * 10;
      const px = car.x + Math.sin(car.heading) * ahead + Math.cos(car.heading) * side;
      const pz = car.z + Math.cos(car.heading) * ahead - Math.sin(car.heading) * side;
      const pc = g.policeSpawnCar(px, pz);
      pc.speed = 8;
      pc.heading = car.heading + Math.PI;
    }
    g.autoDrive = true;
    g.rig.snapBehind(car.heading);
    return;
  }

  if (name === 'mission') {
    // Docks firefight: mission 3 live, enemies with health bars, beacon up.
    // Foot cops stay out of this frame (they would crowd Jax); the cars
    // and the crew carry the action.
    g.police.noFoot = true;
    startMission(g.missions, 2, g);
    setHeat(g.wanted, 40, g.now);
    g.player.x = CFG.places.docks.x - 18;
    g.player.z = CFG.places.docks.z + 12;
    g.player.heading = Math.atan2(
      CFG.places.docks.x - g.player.x, CFG.places.docks.z - g.player.z);
    g.player.mesh.position.set(g.player.x, 0, g.player.z);
    g.player.mesh.rotation.y = g.player.heading;
    g.player.weapon = 'pistol';
    g.player.ammo = 12;
    g.cash = 3300;
    g.hud.setCash(g.cash);
    g.hud.setHealth(g.player.health);
    g.hud.setStars(2);
    g.hud.setObjective('Mission 3: Payback — Take out the rival crew (0/4)');
    g.rig.dist = 12;
    g.rig.snapBehind(g.player.heading);
    return;
  }
}

export function shotList() {
  return ['start', 'play', 'chase', 'mission'];
}

export { missionTarget };
