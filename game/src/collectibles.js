// NEON BAY round 2 — side content: hidden neon tokens and stunt ramps.
// Ten glowing tokens are tucked around the city; each pays cash, all ten pay
// a bonus. Three ramps reward fast jumps. Both plug into the main loop through
// one update() call and report through the HUD.
import * as THREE from 'three';
import { CFG, flatDist } from './config.js';

function makeTokenMesh(color) {
  const group = new THREE.Group();
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.9),
    new THREE.MeshBasicMaterial({ color }),
  );
  gem.position.y = 1.4;
  group.add(gem);
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(1.25, 0.07, 8, 28),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 }),
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 1.4;
  group.add(halo);
  group.userData.gem = gem;
  group.userData.halo = halo;
  return group;
}

function makeRampMesh(heading) {
  const group = new THREE.Group();
  const slope = new THREE.Mesh(
    new THREE.BoxGeometry(5, 0.5, 9),
    new THREE.MeshLambertMaterial({ color: 0xff7e3d }),
  );
  slope.position.y = 1.1;
  slope.rotation.x = -0.38;
  group.add(slope);
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(5.1, 0.12, 1.2),
    new THREE.MeshBasicMaterial({ color: 0xffd23c }),
  );
  stripe.position.set(0, 2.05, -3.6);
  stripe.rotation.x = -0.38;
  group.add(stripe);
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(5, 0.4, 9),
    new THREE.MeshLambertMaterial({ color: 0x2e2e3a }),
  );
  base.position.y = 0.2;
  group.add(base);
  group.rotation.y = heading;
  return group;
}

export function createCollectibles(scene) {
  const tokens = CFG.tokens.spots.map((spot, i) => {
    const color = CFG.colors.neonPalette[i % CFG.colors.neonPalette.length];
    const mesh = makeTokenMesh(color);
    mesh.position.set(spot.x, 0, spot.z);
    scene.add(mesh);
    return { x: spot.x, z: spot.z, mesh, taken: false, color };
  });
  const ramps = CFG.ramps.spots.map((spot) => {
    const mesh = makeRampMesh(spot.heading);
    mesh.position.set(spot.x, 0, spot.z);
    scene.add(mesh);
    return { x: spot.x, z: spot.z, heading: spot.heading, mesh, used: false, cooldown: 0 };
  });
  return {
    tokens,
    ramps,
    collected: 0,
    stunts: 0,
    // How many tokens are still out there (for the HUD counter).
    get remaining() { return tokens.length - this.collected; },
    // Restore tokens after a fresh start (a completed set stays collected
    // across the session; only a new game resets them).
    reset() {
      this.collected = 0;
      this.stunts = 0;
      for (const t of tokens) {
        t.taken = false;
        t.mesh.visible = true;
      }
      for (const r of ramps) { r.used = false; r.cooldown = 0; }
    },
    // Mark tokens already banked by a loaded save so they do not reappear.
    restoreTaken(count) {
      let left = Math.max(0, Math.min(tokens.length, count || 0));
      for (const t of tokens) {
        if (left <= 0) break;
        t.taken = true;
        t.mesh.visible = false;
        this.collected += 1;
        left -= 1;
      }
    },
    // Nearest uncollected token, so the minimap can hint at it.
    nearestToken(x, z) {
      let best = null;
      let bestD = Infinity;
      for (const t of tokens) {
        if (t.taken) continue;
        const d = flatDist(x, z, t.x, t.z);
        if (d < bestD) { bestD = d; best = t; }
      }
      return best;
    },
    update(dt, game) {
      const px = game.player.inCar ? game.player.inCar.x : game.player.x;
      const pz = game.player.inCar ? game.player.inCar.z : game.player.z;
      const now = game.now;
      // Spin and bob the tokens so they catch the eye from a distance.
      for (const t of tokens) {
        if (t.taken) continue;
        t.mesh.userData.gem.rotation.y += dt * 2.4;
        t.mesh.userData.gem.position.y = 1.4 + Math.sin(now * 2 + t.x) * 0.25;
        t.mesh.userData.halo.rotation.z += dt * 1.2;
        if (flatDist(px, pz, t.x, t.z) < 2.6) {
          t.taken = true;
          t.mesh.visible = false;
          this.collected += 1;
          game.cash += CFG.tokens.payEach;
          game.hud.setCash(game.cash);
          game.hud.setTokens(this.collected, tokens.length);
          game.hud.toast(`Neon token ${this.collected}/${tokens.length}! +$${CFG.tokens.payEach}`);
          game.audio.blip();
          game.effects.sparkle(t.x, 1.5, t.z, t.color);
          if (this.collected >= tokens.length) {
            game.cash += CFG.tokens.payAllBonus;
            game.hud.setCash(game.cash);
            game.hud.toast(`ALL ${tokens.length} TOKENS! Bonus +$${CFG.tokens.payAllBonus}`);
            game.audio.jingle();
          }
        }
      }
      // Stunt ramps: hit one fast in a car and the jump pays out.
      const car = game.player.inCar;
      for (const r of ramps) {
        r.cooldown = Math.max(0, r.cooldown - dt);
        if (r.used || r.cooldown > 0 || !car) continue;
        if (flatDist(car.x, car.z, r.x, r.z) < 4.5 && Math.abs(car.speed) >= CFG.ramps.minSpeed) {
          r.used = true;
          this.stunts += 1;
          game.cash += CFG.ramps.pay;
          game.hud.setCash(game.cash);
          game.hud.toast(`STUNT JUMP! +$${CFG.ramps.pay}`);
          game.audio.jingle();
          game.effects.sparkle(car.x, 2, car.z, 0xffd23c);
          game.effects.shake(0.35);
          car.speed = Math.min(car.speed * 1.15, CFG.car.sportsMax);
        }
      }
    },
  };
}
