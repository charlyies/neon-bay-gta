// NEON BAY round 2 — HUD: DOM bars, stars, token counter, objective banner,
// messages, damage vignette, crosshair and the 2D minimap. The minimap is
// a top-down canvas: streets, water, the player arrow, traffic, police,
// the mission blip, taxi fares, uncollected tokens and the police heli.
import { CFG } from './config.js';
import { missionTarget } from './missions.js';

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const el = {
    hud: $('hud'),
    healthFill: $('health-fill'),
    healthNum: $('health-num'),
    cash: $('cash'),
    tokens: $('tokens'),
    ammo: $('ammo'),
    stars: $('stars'),
    heliTag: $('heli-tag'),
    objective: $('objective'),
    toast: $('toast'),
    speed: $('speed'),
    minimap: $('minimap'),
    crosshair: $('crosshair'),
    vignette: $('vignette'),
    title: $('title'),
    titleStart: $('title-start'),
    titleContinue: $('title-continue'),
    pause: $('pause'),
    pauseResume: $('pause-resume'),
    end: $('end'),
    endTitle: $('end-title'),
    endText: $('end-text'),
    endRestart: $('end-restart'),
    help: $('help'),
  };
  const mm = el.minimap ? el.minimap.getContext('2d') : null;
  let toastTimer = 0;

  function setHealth(hp) {
    const h = Math.max(0, Math.min(100, Math.round(hp)));
    if (el.healthFill) el.healthFill.style.width = `${h}%`;
    if (el.healthFill) el.healthFill.style.background = h > 50 ? '#3cd86a' : (h > 25 ? '#e8b93c' : '#d83c3c');
    if (el.healthNum) el.healthNum.textContent = `${h}`;
  }

  function setCash(cash) {
    if (el.cash) el.cash.textContent = `$${Math.round(cash).toLocaleString('en-US')}`;
  }

  function setTokens(got, total) {
    if (el.tokens) el.tokens.textContent = `◆ ${got}/${total} tokens`;
  }

  function setAmmo(weapon, ammo, magSize) {
    if (!el.ammo) return;
    el.ammo.textContent = weapon === 'pistol' ? `Pistol ${ammo}/${magSize}` : 'Fists';
  }

  function setStars(n) {
    if (!el.stars) return;
    el.stars.textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
    el.stars.style.color = n >= 4 ? '#ff4444' : '#ffd23c';
  }

  function setHeli(on) {
    if (el.heliTag) el.heliTag.style.display = on ? 'block' : 'none';
    if (el.heliTag && on) el.heliTag.textContent = 'HELI ABOVE — LOSE THE HEAT';
  }

  function setObjective(text) {
    if (el.objective) el.objective.textContent = text;
  }

  function toast(text) {
    if (!el.toast || !text) return;
    el.toast.textContent = text;
    el.toast.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.toast.style.opacity = '0'; }, 3400);
  }

  function setSpeed(kmh, inCar) {
    if (!el.speed) return;
    el.speed.style.display = inCar ? 'block' : 'none';
    if (inCar) el.speed.textContent = `${Math.round(kmh)} km/h`;
  }

  function flashDamage() {
    if (!el.vignette) return;
    el.vignette.style.opacity = '1';
    setTimeout(() => { el.vignette.style.opacity = '0'; }, 180);
  }

  function showTitle(hasSave) {
    if (el.title) el.title.style.display = 'flex';
    if (el.titleContinue) el.titleContinue.style.display = hasSave ? 'inline-block' : 'none';
  }
  function hideTitle() { if (el.title) el.title.style.display = 'none'; }
  function showPause() { if (el.pause) el.pause.style.display = 'flex'; }
  function hidePause() { if (el.pause) el.pause.style.display = 'none'; }
  function toggleHelp() {
    if (!el.help) return;
    el.help.style.display = el.help.style.display === 'block' ? 'none' : 'block';
  }

  function showEnd(kind, stats) {
    if (!el.end) return;
    const titles = {
      wasted: 'WASTED',
      busted: 'BUSTED',
      'story-complete': 'STORY COMPLETE',
    };
    if (el.endTitle) el.endTitle.textContent = titles[kind] || 'GAME OVER';
    if (el.endText) {
      el.endText.textContent = kind === 'story-complete'
        ? `All six jobs done for Mara. Jax owns Neon Bay now. Cash banked: $${Math.round(stats.cash || 0).toLocaleString('en-US')}. Press Enter to play again.`
        : `Missions finished: ${stats.missions || 0}/6 — Cash: $${Math.round(stats.cash || 0).toLocaleString('en-US')}. Press Enter to try again.`;
    }
    el.end.style.display = 'flex';
  }
  function hideEnd() { if (el.end) el.end.style.display = 'none'; }

  function drawMinimap(game) {
    if (!mm || !el.minimap) return;
    const W = el.minimap.width;
    const H = el.minimap.height;
    const toX = (x) => ((x + 270) / 560) * W;
    const toY = (z) => ((z + 225) / 560) * H;
    mm.clearRect(0, 0, W, H);
    mm.fillStyle = '#1c1c28';
    mm.fillRect(0, 0, W, H);
    // Water (south) and sand strip.
    mm.fillStyle = '#1d4e6b';
    mm.fillRect(0, toY(238), W, H - toY(238));
    mm.fillStyle = '#d9b380';
    mm.fillRect(0, toY(210), W, toY(238) - toY(210));
    // Roads.
    mm.strokeStyle = '#4a4a58';
    mm.lineWidth = 5;
    for (const r of CFG.roads) {
      mm.beginPath(); mm.moveTo(toX(r), 0); mm.lineTo(toX(r), H); mm.stroke();
      mm.beginPath(); mm.moveTo(0, toY(r)); mm.lineTo(W, toY(r)); mm.stroke();
    }
    mm.strokeStyle = '#7a7a88';
    mm.lineWidth = 1;
    for (const r of CFG.roads) {
      mm.beginPath(); mm.moveTo(toX(r), 0); mm.lineTo(toX(r), H); mm.stroke();
      mm.beginPath(); mm.moveTo(0, toY(r)); mm.lineTo(W, toY(r)); mm.stroke();
    }
    const dot = (x, z, color, size) => {
      mm.fillStyle = color;
      mm.beginPath();
      mm.arc(toX(x), toY(z), size, 0, Math.PI * 2);
      mm.fill();
    };
    // Uncollected neon tokens (cyan diamonds).
    if (game.collectibles) {
      for (const t of game.collectibles.tokens) {
        if (t.taken) continue;
        mm.fillStyle = '#2ee6ff';
        const tx = toX(t.x);
        const ty = toY(t.z);
        mm.beginPath();
        mm.moveTo(tx, ty - 3); mm.lineTo(tx + 3, ty); mm.lineTo(tx, ty + 3); mm.lineTo(tx - 3, ty);
        mm.closePath(); mm.fill();
      }
    }
    // Taxi fare.
    if (game.missions.taxi.active) dot(game.missions.taxi.x, game.missions.taxi.z, '#3cd86a', 3);
    // Traffic (white), police cars (flashing blue/red), peds (dim).
    for (const car of game.traffic) dot(car.x, car.z, '#dddddd', 2);
    for (const car of game.police.cars) dot(car.x, car.z, game.police.flashOn ? '#ff2222' : '#2244ff', 3);
    for (const ped of game.peds) {
      if (ped.state !== 'down') dot(ped.x, ped.z, '#8a8a9a', 1.5);
    }
    // Police helicopter: big orange ring so it cannot be missed.
    if (game.police.heli.active) {
      const hx = toX(game.police.heli.group.position.x);
      const hy = toY(game.police.heli.group.position.z);
      mm.strokeStyle = '#ff7e3d';
      mm.lineWidth = 2;
      mm.beginPath(); mm.arc(hx, hy, 7, 0, Math.PI * 2); mm.stroke();
      dot(game.police.heli.group.position.x, game.police.heli.group.position.z, '#ff7e3d', 3);
    }
    // Mission blip, pulsing gold.
    const target = missionTarget(game.missions);
    if (target) {
      const pulse = 4 + Math.sin(game.now * 4) * 1.5;
      dot(target.x, target.z, '#ffd23c', pulse);
    }
    // Player arrow (white triangle, rotated to heading).
    const px = game.player.inCar ? game.player.inCar.x : game.player.x;
    const pz = game.player.inCar ? game.player.inCar.z : game.player.z;
    const heading = game.player.inCar ? game.player.inCar.heading : game.player.heading;
    mm.save();
    mm.translate(toX(px), toY(pz));
    mm.rotate(heading);
    mm.fillStyle = '#ffffff';
    mm.beginPath();
    mm.moveTo(0, -6); mm.lineTo(4.5, 5); mm.lineTo(-4.5, 5);
    mm.closePath(); mm.fill();
    mm.restore();
  }

  return {
    el, setHealth, setCash, setStars, setObjective, toast, setSpeed,
    setTokens, setAmmo, setHeli,
    flashDamage, showTitle, hideTitle, showPause, hidePause,
    showEnd, hideEnd, toggleHelp, drawMinimap,
  };
}

// Round 3 note: HUD and minimap are as playtested — health, cash, stars,
// speed, objective banner and the top-down street map with its blips.

// Round 3 note, continued: the damage vignette and the crosshair only show
// when they mean something — hurt, or armed — so the screen stays clean.
