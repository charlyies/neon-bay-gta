// NEON BAY round 2 — synthesized WebAudio: engine hum, two-tone siren,
// gunshot, punch, pickup chimes, mission jingle and a helicopter thump.
// No audio assets anywhere; every sound is an oscillator or filtered noise.
import { CFG } from './config.js';

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenHigh = true;
  let sirenTimer = 0;
  let heliOsc = null;
  let heliGain = null;
  let muted = false;
  let noiseBuf = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = CFG.audio.master;
    master.connect(ctx.destination);
    // Shared noise buffer for gunshots and punches.
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    // Engine: two detuned saws through a low-pass filter.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = CFG.audio.engineBase;
    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'sawtooth';
    engineOsc2.frequency.value = CFG.audio.engineBase * 1.5;
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineOsc2.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    engineOsc2.start();
    // Siren: one sine that alternates between two notes.
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'sine';
    sirenOsc.frequency.value = CFG.audio.sirenHigh;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
    // Helicopter: a slow square thump, quiet until the heli is up.
    heliOsc = ctx.createOscillator();
    heliOsc.type = 'square';
    heliOsc.frequency.value = 13;
    const heliFilter = ctx.createBiquadFilter();
    heliFilter.type = 'lowpass';
    heliFilter.frequency.value = 220;
    heliGain = ctx.createGain();
    heliGain.gain.value = 0;
    heliOsc.connect(heliFilter);
    heliFilter.connect(heliGain);
    heliGain.connect(master);
    heliOsc.start();
  }

  function tone(freq, dur, vol, type = 'sine', slideTo = 0) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  function burst(freq, dur, vol, type = 'bandpass') {
    if (!ctx || !noiseBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
    src.stop(ctx.currentTime + dur + 0.02);
  }

  function setEngine(frac, driving) {
    if (!ctx) return;
    const target = driving ? 0.05 + frac * 0.09 : 0;
    engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
    const f = CFG.audio.engineBase + frac * 130;
    engineOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.1);
    engineOsc2.frequency.setTargetAtTime(f * 1.5, ctx.currentTime, 0.1);
  }

  function updateSiren(dt, active) {
    if (!ctx) return;
    sirenTimer -= dt;
    if (sirenTimer <= 0) {
      sirenTimer = 0.42;
      sirenHigh = !sirenHigh;
      sirenOsc.frequency.value = sirenHigh ? CFG.audio.sirenHigh : CFG.audio.sirenLow;
    }
    sirenGain.gain.setTargetAtTime(active ? 0.045 : 0, ctx.currentTime, 0.15);
  }

  function setHeliSound(on) {
    if (!ctx) return;
    heliGain.gain.setTargetAtTime(on ? 0.05 : 0, ctx.currentTime, 0.3);
  }

  return {
    ensure,
    setEngine,
    updateSiren,
    setHeliSound,
    gunshot() { burst(1800, 0.16, 0.5, 'bandpass'); tone(140, 0.1, 0.3, 'sine', 50); },
    punch() { burst(500, 0.12, 0.4); tone(160, 0.12, 0.35, 'sine', 55); },
    blip() { tone(880, 0.09, 0.2); },
    click() { tone(1200, 0.04, 0.15, 'square'); },
    pickup() {
      if (!ctx) return;
      tone(1047, 0.1, 0.22);
      setTimeout(() => tone(1568, 0.14, 0.22), 80);
    },
    // Short skid squeal when the handbrake slides the car.
    skid() { burst(900, 0.2, 0.18, 'highpass'); },
    jingle() {
      if (!ctx) return;
      [523, 659, 784, 1047].forEach((f, i) => {
        setTimeout(() => tone(f, 0.22, 0.22), i * 110);
      });
    },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : CFG.audio.master;
    },
    isMuted() { return muted; },
  };
}

// Round 3 note: the WebAudio synth set is complete as shipped — engine
// hum, two-tone siren, gunshot, punch, pickup blip, mission jingle and
// UI clicks, all generated, no audio files. Nothing to retune here.

// Round 3 note, continued: M still mutes everything, and the engine hum
// follows the car, not the menu — that wiring was verified in round 2.
