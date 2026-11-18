// audio.js — fully synthesized WebAudio sound for Solmar Bay.
// No audio files: engine hum, sirens, horn, impacts and three radio
// stations are all generated with oscillators and filtered noise.
// Everything is guarded: if the AudioContext cannot start (headless
// browsers, no gesture yet) every call is a silent no-op.
const NOTE = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

const TRACKS = [
  {
    name: 'NEON FM 92.4 — synthwave',
    bpm: 112,
    bass: [45, 0, 45, 0, 48, 0, 45, 0, 43, 0, 43, 0, 50, 0, 52, 0],
    lead: [69, 0, 72, 76, 0, 74, 72, 0, 69, 0, 67, 69, 0, 0, 0, 0],
    wave: 'sawtooth',
  },
  {
    name: 'BAY 101 — latin groove',
    bpm: 96,
    bass: [41, 0, 0, 41, 0, 0, 44, 0, 46, 0, 0, 46, 0, 0, 48, 0],
    lead: [65, 68, 0, 72, 0, 70, 68, 0, 65, 0, 0, 0, 63, 0, 65, 0],
    wave: 'triangle',
  },
  {
    name: 'PALM RADIO — sunset pop',
    bpm: 124,
    bass: [50, 0, 50, 0, 45, 0, 45, 0, 48, 0, 48, 0, 43, 0, 43, 0],
    lead: [74, 0, 76, 79, 0, 77, 76, 0, 74, 0, 72, 74, 0, 76, 0, 0],
    wave: 'square',
  },
];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
    this.radioOn = false;
    this.track = 0;
    this.step = 0;
    this.radioTimer = null;
    this.muted = false;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      return true;
    } catch {
      this.ctx = null;
      return false;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.35;
  }

  _tone(freq, dur, type, vol, when = 0) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime + when;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch { /* silent */ }
  }

  _noise(dur, vol, freq) {
    if (!this.ctx || this.muted) return;
    try {
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.value = vol;
      src.connect(f).connect(g).connect(this.master);
      src.start();
    } catch { /* silent */ }
  }

  // Continuous engine hum while driving; pitch follows speed 0..1.
  setEngine(speed01, driving) {
    if (!this.ctx || this.muted) { this._stopEngine(); return; }
    try {
      if (!driving || speed01 < 0.02) { this._stopEngine(); return; }
      if (!this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineGain = this.ctx.createGain();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 60;
        this.engineGain.gain.value = 0.05;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 700;
        this.engineOsc.connect(f).connect(this.engineGain).connect(this.master);
        this.engineOsc.start();
      }
      this.engineOsc.frequency.value = 55 + speed01 * 130;
      this.engineGain.gain.value = 0.04 + speed01 * 0.05;
    } catch { /* silent */ }
  }
  _stopEngine() {
    if (this.engineOsc) {
      try { this.engineOsc.stop(); } catch { /* already stopped */ }
      this.engineOsc = null;
      this.engineGain = null;
    }
  }

  setSiren(on) {
    if (!this.ctx || this.muted) { this._stopSiren(); return; }
    if (on === this.sirenOn) return;
    this.sirenOn = on;
    try {
      if (on) {
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenGain = this.ctx.createGain();
        this.sirenOsc.type = 'sine';
        this.sirenOsc.frequency.value = 700;
        this.sirenGain.gain.value = 0.035;
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 1.4;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 260;
        lfo.connect(lfoGain).connect(this.sirenOsc.frequency);
        this.sirenOsc.connect(this.sirenGain).connect(this.master);
        this.sirenOsc.start();
        lfo.start();
        this._sirenLfo = lfo;
      } else {
        this._stopSiren();
      }
    } catch { /* silent */ }
  }
  _stopSiren() {
    if (this.sirenOsc) {
      try { this.sirenOsc.stop(); this._sirenLfo && this._sirenLfo.stop(); } catch { /* noop */ }
      this.sirenOsc = null;
      this._sirenLfo = null;
      this.sirenOn = false;
    }
  }

  horn() { this._tone(370, 0.35, 'square', 0.12); this._tone(466, 0.35, 'square', 0.08); }
  crash(hard) { this._noise(hard ? 0.4 : 0.2, hard ? 0.5 : 0.25, hard ? 900 : 500); this._tone(70, 0.25, 'sine', 0.3); }
  punch() { this._noise(0.12, 0.4, 400); this._tone(120, 0.1, 'sine', 0.25); }
  hurt() { this._tone(180, 0.2, 'sawtooth', 0.15); }
  coin() { this._tone(988, 0.12, 'sine', 0.15); this._tone(1319, 0.25, 'sine', 0.15, 0.1); }
  mission() { [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.22, 'triangle', 0.18, i * 0.11)); }
  wasted() { [392, 330, 262, 196].forEach((f, i) => this._tone(f, 0.35, 'sawtooth', 0.14, i * 0.18)); }
  click() { this._tone(660, 0.06, 'square', 0.08); }

  radioTrackName() { return TRACKS[this.track].name; }
  nextTrack() {
    this.track = (this.track + 1) % TRACKS.length;
    this.step = 0;
    return this.radioTrackName();
  }
  setRadio(on) {
    this.radioOn = on;
    if (!on) { this._stopRadio(); return; }
    if (!this.init()) return;
    this._stopRadio();
    const t = TRACKS[this.track];
    const stepMs = (60 / t.bpm / 4) * 1000;
    this.radioTimer = setInterval(() => {
      if (!this.radioOn || this.muted || !this.ctx) return;
      const s = this.step % 16;
      const bass = t.bass[s];
      const lead = t.lead[s];
      if (bass) this._tone(NOTE(bass), stepMs / 1000 * 0.9, 'sine', 0.22);
      if (lead) this._tone(NOTE(lead), stepMs / 1000 * 0.85, t.wave, 0.07);
      this.step++;
    }, stepMs);
  }
  _stopRadio() {
    if (this.radioTimer) { clearInterval(this.radioTimer); this.radioTimer = null; }
  }
  dispose() {
    this._stopEngine();
    this._stopSiren();
    this._stopRadio();
    if (this.ctx) { this.ctx.close().catch(() => {}); this.ctx = null; }
  }
}
