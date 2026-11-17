// Synthesised sound for Solmar Bay — WebAudio only, no audio files.
// Engine hum, police siren, horn, crashes, punches, coins and three original
// radio tracks (a step sequencer). Everything is defensive: if the browser
// has no AudioContext, or it is suspended, every call is a silent no-op.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenPhase = 0;
    this.radioTimer = 0;
    this.radioStep = 0;
    this.radioOn = false;
    this.station = 0;
    this.muted = false;
  }

  // Call from a user gesture (the Start button). Safe to call twice.
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);

      // Engine: two detuned saws through a low-pass filter.
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineOsc2 = this.ctx.createOscillator();
      this.engineOsc2.type = 'sawtooth';
      this.engineOsc2.frequency.value = 55 * 1.5;
      this.engineOsc.connect(this.engineFilter);
      this.engineOsc2.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      this.engineOsc2.start();

      // Siren: one square wave, frequency flipped in update().
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'square';
      this.sirenOsc.frequency.value = 720;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
    } catch (e) {
      this.ctx = null;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  // speed01: 0..1 (car speed fraction). driving: hero is in a car.
  update(dt, speed01, driving, wanted) {
    if (!this.ctx) return;
    if (this.engineGain) {
      const target = driving ? 0.05 + speed01 * 0.09 : 0;
      this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
      const f = 50 + speed01 * 130;
      this.engineOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.1);
      this.engineOsc2.frequency.setTargetAtTime(f * 1.5, this.ctx.currentTime, 0.1);
      this.engineFilter.frequency.setTargetAtTime(320 + speed01 * 900, this.ctx.currentTime, 0.1);
    }
    if (this.sirenGain && this.sirenOsc) {
      const on = wanted > 0;
      this.sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, this.ctx.currentTime, 0.2);
      if (on) {
        this.sirenPhase += dt;
        const hi = Math.floor(this.sirenPhase * 1.6) % 2 === 0;
        this.sirenOsc.frequency.setTargetAtTime(hi ? 960 : 690, this.ctx.currentTime, 0.05);
      }
    }
    if (this.radioOn) this._radioTick(dt);
  }

  _blip(freq, dur, type, vol, slideTo) {
    if (!this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch (e) { /* ignore */ }
  }

  _noise(dur, vol, filterFreq) {
    if (!this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const flt = this.ctx.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.value = filterFreq || 900;
      const g = this.ctx.createGain();
      g.gain.value = vol || 0.3;
      src.connect(flt);
      flt.connect(g);
      g.connect(this.master);
      src.start(t);
    } catch (e) { /* ignore */ }
  }

  horn() { this._blip(330, 0.28, 'square', 0.16); this._blip(415, 0.28, 'square', 0.1); }
  punch() { this._noise(0.12, 0.35, 500); }
  thud() { this._noise(0.2, 0.25, 300); }
  crash() { this._noise(0.35, 0.5, 700); }
  coin() { this._blip(880, 0.09, 'sine', 0.18); this._blip(1320, 0.14, 'sine', 0.14); }
  missionDone() {
    this._blip(523, 0.12, 'triangle', 0.2);
    setTimeout(() => this._blip(659, 0.12, 'triangle', 0.2), 120);
    setTimeout(() => this._blip(784, 0.25, 'triangle', 0.22), 240);
  }

  // Radio: three original tracks, 16-step loops. Station 0: neon drive
  // (minor-key bass + lead), 1: bay breeze (major, sparse), 2: night chase
  // (fast, driving bass). Called with N to change station.
  setStation(n) {
    this.station = ((n % 3) + 3) % 3;
    this.radioStep = 0;
  }

  setRadio(on) { this.radioOn = on; }
  toggleRadio() { this.radioOn = !this.radioOn; return this.radioOn; }

  _radioTick(dt) {
    this.radioTimer += dt;
    const stepDur = this.station === 2 ? 0.16 : 0.24;
    while (this.radioTimer >= stepDur) {
      this.radioTimer -= stepDur;
      this._radioStep();
      this.radioStep = (this.radioStep + 1) % 16;
    }
  }

  _radioStep() {
    if (!this.ctx || this.muted) return;
    const s = this.radioStep;
    const tracks = [
      // station 0: A minor — bass A1/A1/C2/G1, lead sparkles
      { bass: [55, 0, 55, 0, 65.4, 0, 49, 0, 55, 0, 55, 0, 65.4, 0, 82.4, 0], lead: [0, 0, 440, 0, 0, 523, 0, 0, 0, 0, 659, 0, 0, 587, 0, 0] },
      // station 1: C major — soft bass, gentle lead
      { bass: [65.4, 0, 0, 0, 82.4, 0, 0, 0, 98, 0, 0, 0, 82.4, 0, 65.4, 0], lead: [0, 523, 0, 0, 659, 0, 0, 784, 0, 0, 659, 0, 523, 0, 0, 0] },
      // station 2: E minor chase — driving eighth-note bass
      { bass: [82.4, 82.4, 0, 82.4, 98, 0, 82.4, 0, 110, 0, 98, 0, 82.4, 82.4, 0, 73.4], lead: [0, 0, 659, 0, 784, 0, 0, 988, 0, 0, 880, 0, 0, 784, 0, 659] },
    ];
    const tr = tracks[this.station];
    const b = tr.bass[s];
    if (b) this._blip(b, 0.2, 'triangle', 0.12);
    const l = tr.lead[s];
    if (l) this._blip(l, 0.16, 'sine', 0.07);
    if (s % 4 === 0) this._noise(0.03, 0.04, 4000);
  }
}
