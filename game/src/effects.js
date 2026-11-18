// NEON BAY round 2 — particle effects and screen shake.
// One pooled THREE.Points cloud handles every burst in the game: skid smoke,
// muzzle sparks, crash debris and fire. No textures, no assets — points are
// tinted per particle and fade by shrinking their stored life.
import * as THREE from 'three';
import { CFG } from './config.js';

const POOL = 700;

export function createEffects(scene) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(POOL * 3);
  const col = new Float32Array(POOL * 3);
  // Park every particle far below the map until it is used.
  for (let i = 0; i < POOL; i++) pos[i * 3 + 1] = -999;
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.85, vertexColors: true, transparent: true, opacity: 0.95,
    depthWrite: false, sizeAttenuation: true,
  });
  const cloud = new THREE.Points(geo, mat);
  cloud.frustumCulled = false;
  scene.add(cloud);

  const parts = [];
  for (let i = 0; i < POOL; i++) {
    parts.push({ alive: false, x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, r: 1, g: 1, b: 1, grav: 0, drag: 1 });
  }
  let cursor = 0;
  let shakeAmt = 0;

  function spawnOne(x, y, z, vx, vy, vz, life, r, g, b, grav, drag) {
    const p = parts[cursor];
    cursor = (cursor + 1) % POOL;
    p.alive = true;
    p.x = x; p.y = y; p.z = z;
    p.vx = vx; p.vy = vy; p.vz = vz;
    p.life = life; p.max = life;
    p.r = r; p.g = g; p.b = b;
    p.grav = grav; p.drag = drag;
  }

  function tint(hex) {
    return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
  }

  function burst(x, y, z, opts) {
    const n = opts.count || 10;
    const [r, g, b] = tint(opts.color ?? 0xffffff);
    const spread = opts.spread ?? 4;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.4 + Math.random() * 0.6) * spread;
      spawnOne(
        x, y + Math.random() * 0.4, z,
        Math.cos(a) * sp, (opts.up ?? 2) * (0.4 + Math.random() * 0.8), Math.sin(a) * sp,
        (opts.life ?? 0.7) * (0.6 + Math.random() * 0.8),
        r, g, b, opts.gravity ?? 6, opts.drag ?? 0.92,
      );
    }
  }

  return {
    // Puffs of grey smoke from the tyres while handbraking or skidding.
    skid(x, z, speed) {
      burst(x, 0.3, z, { count: 3, color: 0x9a9aa8, spread: 1.6, up: 1.2, life: 0.9, gravity: -0.5, drag: 0.9 });
    },
    // Bright sparks at the muzzle when the pistol fires.
    muzzle(x, y, z) {
      burst(x, y, z, { count: 8, color: 0xffd23c, spread: 5, up: 1.5, life: 0.25, gravity: 2, drag: 0.95 });
      burst(x, y, z, { count: 4, color: 0xffffff, spread: 3, up: 1, life: 0.15, gravity: 0, drag: 0.95 });
    },
    // Debris + smoke when two cars (or a car and a wall) collide hard.
    crash(x, z, hard) {
      burst(x, 0.8, z, { count: hard ? 22 : 10, color: 0xff7e3d, spread: 6, up: 4, life: 0.6, gravity: 14, drag: 0.94 });
      burst(x, 1.2, z, { count: hard ? 14 : 6, color: 0x55555f, spread: 3, up: 3, life: 1.2, gravity: -1, drag: 0.88 });
    },
    // Fire and black smoke from a badly damaged car.
    fire(x, z) {
      burst(x, 0.9, z, { count: 5, color: 0xff5a1e, spread: 1.4, up: 3.5, life: 0.55, gravity: -3, drag: 0.9 });
      burst(x, 1.6, z, { count: 2, color: 0x222226, spread: 1, up: 2.5, life: 1.1, gravity: -1.5, drag: 0.9 });
    },
    // Celebration burst for pickups, payouts and stunt jumps.
    sparkle(x, y, z, color) {
      burst(x, y, z, { count: 18, color: color ?? 0x2ee6ff, spread: 4, up: 4, life: 0.9, gravity: 5, drag: 0.93 });
    },
    // A rising neon ring of light for a big moment (mission complete).
    ringBurst(x, y, z, color) {
      const [r, g, b] = tint(color ?? 0xffd23c);
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2;
        spawnOne(x + Math.cos(a) * 0.6, y, z + Math.sin(a) * 0.6,
          Math.cos(a) * 7, 2.5, Math.sin(a) * 7, 0.8, r, g, b, 2, 0.96);
      }
    },
    shake(amount) {
      shakeAmt = Math.min(1.2, shakeAmt + amount);
    },
    get shakeAmount() { return shakeAmt; },
    update(dt) {
      shakeAmt = Math.max(0, shakeAmt - dt * 2.2);
      for (let i = 0; i < POOL; i++) {
        const p = parts[i];
        if (!p.alive) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.alive = false;
          pos[i * 3 + 1] = -999;
          continue;
        }
        p.vy -= p.grav * dt;
        p.vx *= p.drag; p.vz *= p.drag;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < 0.05 && p.grav > 0) { p.y = 0.05; p.vy = 0; }
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
        const fade = p.life / p.max;
        col[i * 3] = p.r * fade; col[i * 3 + 1] = p.g * fade; col[i * 3 + 2] = p.b * fade;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}
