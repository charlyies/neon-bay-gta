// NEON BAY — synthesized WebAudio: engine hum, siren, gunshot, blips, jingle.
// Written fresh for the make.fun gta6-01 entry. No audio assets.
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
  let muted = false;
  let noiseBuf = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : CFG.audio.master;
      master.connect(ctx.destination);
      // Shared noise buffer for gunshots and punches.
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      // Engine: two detuned saws through a lowpass, gain follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = CFG.audio.engineBase;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = CFG.audio.engineBase * 0.5;
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
      // Siren: square wave alternating two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = CFG.audio.sirenHigh;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch (e) {
      return false;
    }
  }

  function setEngine(speed01, driving) {
    if (!ctx) return;
    const t = ctx.currentTime;
    engineGain.gain.setTargetAtTime(driving ? 0.05 + speed01 * 0.09 : 0, t, 0.1);
    engineOsc.frequency.setTargetAtTime(CFG.audio.engineBase + speed01 * 90, t, 0.08);
    engineOsc2.frequency.setTargetAtTime((CFG.audio.engineBase + speed01 * 90) * 0.5, t, 0.08);
  }

  function updateSiren(dt, active) {
    if (!ctx) return;
    if (!active) {
      sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      return;
    }
    sirenGain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.1);
    sirenTimer -= dt;
    if (sirenTimer <= 0) {
      sirenTimer = 0.42;
      sirenHigh = !sirenHigh;
      sirenOsc.frequency.value = sirenHigh ? CFG.audio.sirenHigh : CFG.audio.sirenLow;
    }
  }

  function burst(freq, dur, vol, type) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type || 'lowpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + dur);
  }

  function tone(freq, dur, vol, type, slideTo) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur);
  }

  return {
    ensure,
    setEngine,
    updateSiren,
    gunshot() { burst(1800, 0.16, 0.5, 'bandpass'); tone(140, 0.1, 0.3, 'sine', 50); },
    punch() { burst(500, 0.12, 0.4); tone(160, 0.12, 0.35, 'sine', 55); },
    blip() { tone(880, 0.09, 0.2); },
    click() { tone(1200, 0.04, 0.15, 'square'); },
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
