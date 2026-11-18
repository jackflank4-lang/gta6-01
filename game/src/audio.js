// Synthesised sound for Solmar Bay — WebAudio only, no audio files.
// Everything is built from oscillators and filtered noise, so the game
// loads nothing over the network. The audio context starts lazily on the
// first user gesture (browsers block audio before one).
const TRACKS = [
  // Neon Cruise — laid-back minor groove.
  { bpm: 96, root: 110, steps: [0, -1, 3, -1, 5, -1, 3, 2, 0, -1, 3, 5, 7, 5, 3, 2] },
  // Bay Lights — brighter, faster drive-time synth.
  { bpm: 122, root: 130.8, steps: [0, 3, 5, 7, 5, 3, 0, 3, 5, 7, 10, 7, 5, 3, 2, 0] },
  // Midnight Marina — slow and moody.
  { bpm: 76, root: 98, steps: [0, -1, -1, 5, -1, 3, -1, -1, 0, -1, 7, 5, 3, -1, 2, -1] },
];
const SCALE = [1, 1.122, 1.26, 1.335, 1.498, 1.682, 1.782, 2];

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this._engineOsc = null;
    this._engineGain = null;
    this._engineFilter = null;
    this._sirenOsc = null;
    this._sirenGain = null;
    this._sirenTimer = null;
    this._sirenHigh = false;
    this.radioTrack = 0;
    this.radioOn = false;
    this._radioTimer = null;
    this._radioStep = 0;
  }

  // Call from a click / key gesture. Safe to call repeatedly.
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
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this._startEngineLoop();
      return true;
    } catch (e) {
      return false;
    }
  }

  setMuted(m) {
    this.muted = !!m;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
  }

  _startEngineLoop() {
    const ctx = this.ctx;
    this._engineOsc = ctx.createOscillator();
    this._engineOsc.type = 'sawtooth';
    this._engineOsc.frequency.value = 55;
    this._engineFilter = ctx.createBiquadFilter();
    this._engineFilter.type = 'lowpass';
    this._engineFilter.frequency.value = 320;
    this._engineGain = ctx.createGain();
    this._engineGain.gain.value = 0.0;
    this._engineOsc.connect(this._engineFilter);
    this._engineFilter.connect(this._engineGain);
    this._engineGain.connect(this.master);
    this._engineOsc.start();
  }

  // speed 0..1 and whether the hero is driving at all.
  setEngine(speed, driving) {
    if (!this.ctx || !this._engineGain) return;
    const t = this.ctx.currentTime;
    const target = driving ? 0.05 + speed * 0.075 : 0.0;
    this._engineGain.gain.setTargetAtTime(target, t, 0.08);
    this._engineOsc.frequency.setTargetAtTime(52 + speed * 130, t, 0.1);
    this._engineFilter.frequency.setTargetAtTime(280 + speed * 900, t, 0.1);
  }

  setSiren(on) {
    if (!this.ctx) return;
    if (on && !this._sirenOsc) {
      const ctx = this.ctx;
      this._sirenOsc = ctx.createOscillator();
      this._sirenOsc.type = 'triangle';
      this._sirenOsc.frequency.value = 720;
      this._sirenGain = ctx.createGain();
      this._sirenGain.gain.value = 0.035;
      this._sirenOsc.connect(this._sirenGain);
      this._sirenGain.connect(this.master);
      this._sirenOsc.start();
      this._sirenHigh = false;
      this._sirenTimer = setInterval(() => {
        this._sirenHigh = !this._sirenHigh;
        if (this._sirenOsc) {
          this._sirenOsc.frequency.setTargetAtTime(this._sirenHigh ? 960 : 720, this.ctx.currentTime, 0.05);
        }
      }, 380);
    } else if (!on && this._sirenOsc) {
      clearInterval(this._sirenTimer);
      this._sirenTimer = null;
      try { this._sirenOsc.stop(); } catch (e) { /* already stopped */ }
      this._sirenOsc.disconnect();
      this._sirenOsc = null;
      this._sirenGain = null;
    }
  }

  _noiseBuffer(seconds) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  _blip(freq, dur, type, vol, when = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  horn() {
    this._blip(370, 0.28, 'square', 0.12);
    this._blip(466, 0.28, 'square', 0.08);
  }

  crash(strength = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.25);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25 * strength, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start();
  }

  gunshot() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.12);
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start();
  }

  punch() {
    this._blip(140, 0.12, 'sine', 0.25);
  }

  coin() {
    this._blip(988, 0.09, 'sine', 0.14);
    this._blip(1319, 0.14, 'sine', 0.14, 0.07);
  }

  missionDone() {
    [523, 659, 784, 1047].forEach((f, i) => this._blip(f, 0.22, 'triangle', 0.14, i * 0.09));
  }

  busted() {
    [392, 311, 233].forEach((f, i) => this._blip(f, 0.3, 'sawtooth', 0.1, i * 0.14));
  }

  // Radio: a tiny step sequencer, one note per 16th step, triangle wave.
  radioStart() {
    if (!this.ctx || this._radioTimer) return;
    this.radioOn = true;
    this._radioStep = 0;
    const track = TRACKS[this.radioTrack];
    const stepMs = 60000 / track.bpm / 4;
    this._radioTimer = setInterval(() => {
      if (!this.ctx || !this.radioOn) return;
      const step = track.steps[this._radioStep % track.steps.length];
      this._radioStep += 1;
      if (step < 0) return;
      const deg = step % 8;
      const oct = Math.floor(step / 8);
      const freq = track.root * SCALE[deg] * (oct > 0 ? 2 : 1);
      this._blip(freq, stepMs / 1000 * 0.9, 'triangle', 0.05);
    }, stepMs);
  }

  radioStop() {
    this.radioOn = false;
    if (this._radioTimer) {
      clearInterval(this._radioTimer);
      this._radioTimer = null;
    }
  }

  radioNext() {
    const wasOn = this.radioOn;
    this.radioStop();
    this.radioTrack = (this.radioTrack + 1) % TRACKS.length;
    if (wasOn) this.radioStart();
    return this.radioTrack;
  }

  radioName() {
    return ['Neon Cruise', 'Bay Lights', 'Midnight Marina'][this.radioTrack];
  }
}
