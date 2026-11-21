// VELMARA — audio.js: all sound is synthesized with WebAudio — no audio
// files, no network. Engine hum, sirens, gunshots, pickups, mission stings
// and a looping golden-hour groove (bass + pad + hats, all oscillators).
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.started = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.5;
      this.sfxGain.connect(this.master);
      // Engine: sawtooth through a lowpass, pitch follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 40;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 320;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(lp); lp.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
      // Siren: two-tone triangle, LFO flips it.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.9;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain); lfoGain.connect(this.sirenOsc.frequency);
      lfo.start();
      this.started = true;
      this.startMusic();
      return true;
    } catch (e) { return false; }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }
  setEngine(speed01, driving) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(driving ? 0.05 + speed01 * 0.06 : 0, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(42 + speed01 * 130, t, 0.08);
  }
  setSiren(on) {
    if (!this.ctx) return;
    this.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, this.ctx.currentTime, 0.2);
  }

  blip(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, vol, filterFreq) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq || 1200;
    const g = this.ctx.createGain();
    g.gain.value = vol || 0.3;
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start(t);
  }

  gunshot() { this.noise(0.14, 0.5, 2600); this.blip(160, 0.09, 'square', 0.22, 60); }
  enemyShot() { this.noise(0.1, 0.2, 1800); }
  pickup() { this.blip(660, 0.09, 'sine', 0.25); setTimeout(() => this.blip(990, 0.14, 'sine', 0.25), 70); }
  cash() { this.blip(880, 0.08, 'sine', 0.22); setTimeout(() => this.blip(1174, 0.08, 'sine', 0.22), 60); setTimeout(() => this.blip(1568, 0.16, 'sine', 0.22), 120); }
  crash() { this.noise(0.25, 0.45, 500); this.blip(90, 0.2, 'sawtooth', 0.25, 40); }
  busted() { this.blip(392, 0.18, 'square', 0.2); setTimeout(() => this.blip(311, 0.18, 'square', 0.2), 160); setTimeout(() => this.blip(233, 0.4, 'square', 0.2), 320); }
  missionDone() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => setTimeout(() => this.blip(n, 0.22, 'triangle', 0.25), i * 110));
  }
  missionStart() { this.blip(440, 0.12, 'triangle', 0.22); setTimeout(() => this.blip(587, 0.2, 'triangle', 0.22), 110); }
  wantedUp() { this.blip(220, 0.15, 'sawtooth', 0.2, 440); }
  horn() { this.blip(370, 0.18, 'square', 0.15); }
  click() { this.blip(700, 0.05, 'sine', 0.15); }

  startMusic() {
    if (this.musicTimer) return;
    // A-minor golden-hour groove: 8-step bass, pad chord each bar, hats.
    const bass = [55, 0, 55, 0, 65.4, 0, 49, 0, 55, 0, 55, 0, 82.4, 0, 73.4, 0];
    const chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 220, 261.6]];
    let bar = 0;
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) { this.musicStep = (this.musicStep + 1) % 16; return; }
      const step = this.musicStep;
      const t = this.ctx.currentTime;
      const b = bass[step];
      if (b) {
        const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = b;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        o.connect(g); g.connect(this.musicGain); o.start(t); o.stop(t + 0.24);
      }
      if (step === 0) {
        const ch = chords[bar % 4]; bar += 1;
        for (const f of ch) {
          const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.12, t + 0.4);
          g.gain.exponentialRampToValueAtTime(0.001, t + 1.9);
          o.connect(g); g.connect(this.musicGain); o.start(t); o.stop(t + 2);
        }
      }
      if (step % 2 === 0) this.hatTick();
      this.musicStep = (this.musicStep + 1) % 16;
    }, 190);
  }
  hatTick() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * 0.03);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
    const g = this.ctx.createGain(); g.gain.value = 0.12;
    s.connect(f); f.connect(g); g.connect(this.musicGain); s.start(t);
  }
}
