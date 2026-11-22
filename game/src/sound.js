// sound.js — 100% synthesised WebAudio for VELMARA: engine hum, sirens,
// gunshots, crashes, pickups, mission stings and a golden-hour groove.
// No audio files, no network. Everything is guarded: with no AudioContext
// (headless, muted, not yet unlocked) every call is a harmless no-op.

export function makeSound() {
  const s = {
    ctx: null,
    master: null,
    muted: false,
    musicOn: false,
    step: 0,
    nextStep: 0,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenTimer: 0,
  };

  s.unlock = function unlock() {
    if (s.ctx) {
      if (s.ctx.state === 'suspended') s.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      s.ctx = new AC();
      s.master = s.ctx.createGain();
      s.master.gain.value = s.muted ? 0 : 0.5;
      s.master.connect(s.ctx.destination);
      s.startMusic();
      s.startEngine();
      s.startSiren();
    } catch (err) {
      s.ctx = null;
    }
  };

  s.setMuted = function setMuted(m) {
    s.muted = m;
    if (s.master && s.ctx) s.master.gain.value = m ? 0 : 0.5;
  };

  function tone(freq, dur, type, vol, slideTo) {
    if (!s.ctx || s.muted) return;
    try {
      const t = s.ctx.currentTime;
      const o = s.ctx.createOscillator();
      const g = s.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(s.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch (err) {}
  }

  function noise(dur, vol, filterFreq) {
    if (!s.ctx || s.muted) return;
    try {
      const t = s.ctx.currentTime;
      const len = Math.max(1, Math.floor(s.ctx.sampleRate * dur));
      const buf = s.ctx.createBuffer(1, len, s.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = s.ctx.createBufferSource();
      src.buffer = buf;
      const g = s.ctx.createGain();
      g.gain.value = vol || 0.25;
      let node = src;
      if (filterFreq) {
        const f = s.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = filterFreq;
        src.connect(f);
        node = f;
      }
      node.connect(g);
      g.connect(s.master);
      src.start(t);
    } catch (err) {}
  }

  s.shot = function shot() {
    noise(0.12, 0.5, 2400);
    tone(160, 0.08, 'square', 0.18, 60);
  };

  s.enemyShot = function enemyShot() {
    noise(0.09, 0.22, 1600);
  };

  s.crash = function crash() {
    noise(0.25, 0.4, 700);
    tone(90, 0.2, 'sawtooth', 0.2, 40);
  };

  s.pickup = function pickup() {
    tone(660, 0.09, 'sine', 0.22);
    setTimeout(() => tone(990, 0.12, 'sine', 0.22), 70);
  };

  s.cash = function cash() {
    tone(880, 0.1, 'triangle', 0.25);
    setTimeout(() => tone(1174, 0.14, 'triangle', 0.25), 80);
  };

  s.click = function click() {
    tone(440, 0.05, 'square', 0.12);
  };

  s.horn = function horn() {
    tone(370, 0.28, 'sawtooth', 0.16);
    tone(466, 0.28, 'sawtooth', 0.12);
  };

  s.sting = function sting(win) {
    const notes = win ? [523, 659, 784, 1046] : [392, 330, 262, 196];
    notes.forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.25), i * 110));
  };

  s.busted = function busted() {
    [440, 415, 392].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sawtooth', 0.18), i * 160));
  };

  // --- continuous layers -------------------------------------------------
  s.startEngine = function startEngine() {
    try {
      s.engineOsc = s.ctx.createOscillator();
      s.engineOsc.type = 'sawtooth';
      s.engineOsc.frequency.value = 55;
      s.engineGain = s.ctx.createGain();
      s.engineGain.gain.value = 0;
      const f = s.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 320;
      s.engineOsc.connect(f);
      f.connect(s.engineGain);
      s.engineGain.connect(s.master);
      s.engineOsc.start();
    } catch (err) {}
  };

  s.engine = function engine(speed01, inCar) {
    if (!s.ctx || !s.engineGain) return;
    const target = s.muted ? 0 : inCar ? 0.05 + speed01 * 0.09 : 0;
    s.engineGain.gain.setTargetAtTime(target, s.ctx.currentTime, 0.1);
    if (s.engineOsc) s.engineOsc.frequency.setTargetAtTime(50 + speed01 * 130, s.ctx.currentTime, 0.08);
  };

  s.startSiren = function startSiren() {
    try {
      s.sirenOsc = s.ctx.createOscillator();
      s.sirenOsc.type = 'sine';
      s.sirenOsc.frequency.value = 700;
      s.sirenGain = s.ctx.createGain();
      s.sirenGain.gain.value = 0;
      s.sirenOsc.connect(s.sirenGain);
      s.sirenGain.connect(s.master);
      s.sirenOsc.start();
    } catch (err) {}
  };

  s.siren = function siren(wanted, dt) {
    if (!s.ctx || !s.sirenOsc) return;
    s.sirenTimer += dt;
    const on = wanted >= 1 && !s.muted;
    s.sirenGain.gain.setTargetAtTime(on ? 0.05 : 0, s.ctx.currentTime, 0.2);
    if (on) {
      const hi = Math.sin(s.sirenTimer * 2.4) > 0;
      s.sirenOsc.frequency.setTargetAtTime(hi ? 880 : 620, s.ctx.currentTime, 0.05);
    }
  };

  // --- music: 16-step golden-hour groove (bass + pad + hats) -------------
  s.startMusic = function startMusic() {
    if (s.musicOn || !s.ctx) return;
    s.musicOn = true;
    s.nextStep = s.ctx.currentTime + 0.1;
    const bassLine = [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 58.3, 0, 73.4, 0];
    const padChords = [220, 261.6, 329.6];
    function scheduler() {
      if (!s.ctx || !s.musicOn) return;
      const stepDur = 60 / 96 / 2; // 96 BPM eighth notes
      while (s.nextStep < s.ctx.currentTime + 0.25) {
        const i = s.step % 16;
        if (!s.muted) {
          const b = bassLine[i];
          if (b) toneAt(b, stepDur * 1.8, 'triangle', 0.16, s.nextStep);
          if (i % 4 === 0) {
            padChords.forEach((f) => toneAt(f, stepDur * 4, 'sine', 0.035, s.nextStep));
          }
          if (i % 2 === 0) noiseAt(0.03, 0.05, s.nextStep);
        }
        s.step++;
        s.nextStep += stepDur;
      }
      setTimeout(scheduler, 90);
    }
    function toneAt(freq, dur, type, vol, when) {
      try {
        const o = s.ctx.createOscillator();
        const g = s.ctx.createGain();
        o.type = type;
        o.frequency.value = freq;
        g.gain.setValueAtTime(vol, when);
        g.gain.exponentialRampToValueAtTime(0.001, when + dur);
        o.connect(g);
        g.connect(s.master);
        o.start(when);
        o.stop(when + dur + 0.02);
      } catch (err) {}
    }
    function noiseAt(dur, vol, when) {
      try {
        const len = Math.max(1, Math.floor(s.ctx.sampleRate * dur));
        const buf = s.ctx.createBuffer(1, len, s.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let j = 0; j < len; j++) data[j] = Math.random() * 2 - 1;
        const src = s.ctx.createBufferSource();
        src.buffer = buf;
        const g = s.ctx.createGain();
        g.gain.value = vol;
        src.connect(g);
        g.connect(s.master);
        src.start(when);
      } catch (err) {}
    }
    scheduler();
  };

  return s;
}
