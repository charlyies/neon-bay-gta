// NEON BAY round 2 — deterministic screenshot staging for ?shot=<name>&seed=<n>.
// Each shot stages a readable frame: camera placed, actors spawned, HUD set.
// Called once after init; the game loop keeps running so traffic, sirens,
// the water and the helicopter stay alive in the captured frame.
import { CFG } from './config.js';
import { enterCar } from './player.js';
import { setHeat } from './police.js';
import { startMission, missionTarget } from './missions.js';

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
    // toward the beach and the sun, neon signs in the foreground blocks.
    g.hud.showTitle(false);
    g.camera.position.set(-40, 55, 190);
    g.camera.lookAt(0, 8, -40);
    g.rig.pos.set(-40, 55, 190);
    g.rig.look.set(0, 8, -40);
    g.rig.yaw = Math.PI;
    g.player.x = CFG.places.start.x;
    g.player.z = CFG.places.start.z;
    g.player.mesh.position.set(g.player.x, 0, g.player.z);
    g.hud.setTokens(0, 10);
    g.hud.setObjective('Press Enter to start — Mara is waiting. Six jobs. One city.');
    return;
  }

  if (name === 'play') {
    // On foot beside the marked sedan, HUD + minimap live, mission 1 up,
    // token counter showing progress.
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
    g.hud.setTokens(3, 10);
    g.hud.setAmmo('fists', g.player.ammo, g.player.magSize);
    g.hud.setObjective('Mission 1: Hot Wheels — Steal the marked sedan');
    g.rig.snapBehind(g.player.heading);
    return;
  }

  if (name === 'chase') {
    // Driving fast with police cars ahead and the helicopter overhead:
    // 4 stars, mission 6's escape in progress, objective on the HUD.
    // Caught early (frame 45) so the getaway car is still deep in the
    // city, with the roadblock in front of it and the heli's spotlight
    // pool on the road; a low, wide camera keeps the sky in frame.
    g.shotReadyAt = 45;
    startMission(g.missions, 5, g);
    setHeat(g.wanted, 65, g.now); // 4 stars: heli joins the hunt
    const car = g.missions.sports || g.traffic[0];
    g.player.x = 29;
    g.player.z = -87;
    enterCar(g.player, car);
    car.x = 29;
    car.z = -87;
    car.heading = 0;
    car.speed = 18;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    g.rig.dist = 16;
    g.rig.pitch = 0.18;
    g.cash = 6300;
    g.hud.setCash(g.cash);
    g.hud.setHealth(g.player.health);
    g.hud.setStars(4);
    g.hud.setTokens(7, 10);
    g.hud.setHeli(true);
    g.hud.setObjective('Mission 6: The Last Job — Lose the 4-star heat!');
    g.hud.toast('4-star heat! The helicopter is up — lose them!');
    // Two police cars flanking the getaway car, lights flashing, closing in.
    // (Chasers staged ahead end up behind the camera; flankers stay in frame.)
    for (let k = 0; k < 2; k++) {
      const side = k === 0 ? -9 : 9;
      const px = car.x + Math.cos(car.heading) * side - Math.sin(car.heading) * 6;
      const pz = car.z - Math.sin(car.heading) * side - Math.cos(car.heading) * 6;
      const pc = g.policeSpawnCar(px, pz);
      pc.speed = 20;
      pc.heading = car.heading;
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
    g.hud.setTokens(5, 10);
    g.hud.setAmmo('pistol', g.player.ammo, g.player.magSize);
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
