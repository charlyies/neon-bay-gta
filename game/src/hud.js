// NEON BAY — HUD: DOM bars, stars, objective banner, messages, minimap.
// Written fresh for the make.fun gta6-01 entry.
import { CFG } from './config.js';

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const el = {
    hud: $('hud'),
    healthFill: $('health-fill'),
    healthNum: $('health-num'),
    cash: $('cash'),
    stars: $('stars'),
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
    end: $('end'),
    endTitle: $('end-title'),
    endStats: $('end-stats'),
    help: $('help'),
  };
  const mapCtx = el.minimap.getContext('2d');
  let toastTimer = 0;

  function setHealth(h) {
    const v = Math.max(0, Math.min(100, Math.round(h)));
    el.healthFill.style.width = v + '%';
    el.healthFill.style.background = v > 50 ? '#3cd86a' : v > 25 ? '#e8b93c' : '#e83c3c';
    el.healthNum.textContent = v;
  }

  function setCash(c) {
    el.cash.textContent = '$' + Math.round(c).toLocaleString('en-US');
  }

  function setStars(n) {
    let s = '';
    for (let i = 0; i < 5; i++) s += i < n ? '★' : '☆';
    el.stars.textContent = s;
    el.stars.style.color = n > 0 ? '#ffd23c' : '#5a5a66';
  }

  function setObjective(text) {
    el.objective.textContent = text;
  }

  function toast(msg, ms) {
    el.toast.textContent = msg;
    el.toast.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.toast.style.opacity = '0'; }, ms || 4200);
  }

  function setSpeed(kmh, driving) {
    el.speed.style.display = driving ? 'block' : 'none';
    if (driving) el.speed.textContent = Math.round(kmh) + ' km/h';
  }

  function flashDamage() {
    el.vignette.style.opacity = '0.85';
    setTimeout(() => { el.vignette.style.opacity = '0'; }, 180);
  }

  function showTitle(hasSave) {
    el.title.style.display = 'flex';
    el.titleContinue.style.display = hasSave ? 'inline-block' : 'none';
  }
  function hideTitle() { el.title.style.display = 'none'; }
  function showPause() { el.pause.style.display = 'flex'; }
  function hidePause() { el.pause.style.display = 'none'; }
  function showEnd(kind, stats) {
    const titles = {
      wasted: 'WASTED',
      busted: 'BUSTED',
      story: 'STORY COMPLETE',
    };
    el.endTitle.textContent = titles[kind] || 'GAME OVER';
    el.endTitle.style.color = kind === 'story' ? '#3cd86a' : '#e83c3c';
    el.endStats.textContent = `Cash: $${Math.round(stats.cash || 0).toLocaleString('en-US')}  •  Missions done: ${stats.missions || 0}/4`;
    el.end.style.display = 'flex';
  }
  function hideEnd() { el.end.style.display = 'none'; }
  function toggleHelp() {
    el.help.style.display = el.help.style.display === 'block' ? 'none' : 'block';
  }

  // Top-down map: streets, blocks, beach, player arrow, cars, police, blips.
  function drawMinimap(game) {
    const W = 190;
    const H = 190;
    const x0 = -215;
    const x1 = 255;
    const z0 = -215;
    const z1 = 345;
    const sx = W / (x1 - x0);
    const sz = H / (z1 - z0);
    const X = (x) => (x - x0) * sx;
    const Z = (z) => (z - z0) * sz;
    const g = mapCtx;
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#14141f';
    g.fillRect(0, 0, W, H);
    // Water strip (south).
    g.fillStyle = '#1d4e6b';
    g.fillRect(0, Z(238), W, H - Z(238));
    // Blocks.
    g.fillStyle = '#3a3a48';
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        const cx = (i - 3) * CFG.pitch;
        const cz = (j - 3) * CFG.pitch;
        g.fillRect(X(cx - 22), Z(cz - 22), 44 * sx, 44 * sz);
      }
    }
    // Roads.
    g.strokeStyle = '#55555f';
    g.lineWidth = 2;
    for (const r of CFG.roads) {
      g.beginPath(); g.moveTo(X(r), 0); g.lineTo(X(r), H); g.stroke();
      g.beginPath(); g.moveTo(0, Z(r)); g.lineTo(W, Z(r)); g.stroke();
    }
    const dot = (x, z, color, r) => {
      g.fillStyle = color;
      g.beginPath(); g.arc(X(x), Z(z), r || 2.5, 0, Math.PI * 2); g.fill();
    };
    // Mission blip (pulsing yellow).
    const target = game.missionTarget ? game.missionTarget() : null;
    if (target) {
      const pulse = 3 + Math.sin(performance.now() / 200) * 1.5;
      dot(target.x, target.z, '#ffd23c', pulse);
    }
    // Taxi client.
    if (game.missions && game.missions.taxi && game.missions.taxi.state === 'waiting') {
      dot(game.missions.taxi.x, game.missions.taxi.z, '#3cd86a', 3);
    }
    // Enemies.
    if (game.missions) {
      for (const e of game.missions.enemies) {
        if (!e.dead) dot(e.x, e.z, '#ff3c3c', 3);
      }
    }
    // Traffic cars (white) and police (flashing red/blue).
    for (const car of game.traffic || []) {
      if (car.active) dot(car.x, car.z, '#e8e8e8', 2);
    }
    for (const car of game.police ? game.police.cars : []) {
      dot(car.x, car.z, game.police.flashOn ? '#ff2222' : '#2244ff', 3);
    }
    // Player arrow.
    const px = game.player.inCar ? game.player.inCar.x : game.player.x;
    const pz = game.player.inCar ? game.player.inCar.z : game.player.z;
    const heading = game.player.inCar ? game.player.inCar.heading : game.player.heading;
    g.save();
    g.translate(X(px), Z(pz));
    g.rotate(Math.atan2(Math.sin(heading), Math.cos(heading)) + Math.PI / 2);
    g.fillStyle = '#3cd86a';
    g.beginPath();
    g.moveTo(0, -6); g.lineTo(4.5, 5); g.lineTo(-4.5, 5); g.closePath();
    g.fill();
    g.restore();
  }

  return {
    el, setHealth, setCash, setStars, setObjective, toast, setSpeed,
    flashDamage, showTitle, hideTitle, showPause, hidePause,
    showEnd, hideEnd, toggleHelp, drawMinimap,
  };
}
