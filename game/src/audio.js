// Synthesised WebAudio SFX + music for Solmar Bay. No audio files, no network.
// Rebuild r2: the same best-effort engine, reorganised around a small synth
// kit (tone / noise / sweep), with new sounds — skid, door slam, police radio
// blip, coin chime — and a two-track radio (N switches patterns).
(function () {
  'use strict';
  window.SB = window.SB || {};

  // Two radio patterns: A is the v1 bass-and-hat loop, B is a minor-key drive.
  const TRACKS = [
    { name: 'NEON DRIVE', bass: [55, 0, 55, 0, 65.4, 0, 49, 0, 55, 0, 55, 0, 82.4, 0, 73.4, 0], stepMs: 240, hatEvery: 2 },
    { name: 'KINGFISH BLUES', bass: [49, 0, 0, 58.3, 0, 49, 0, 0, 65.4, 0, 0, 58.3, 0, 73.4, 0, 0], stepMs: 300, hatEvery: 4 },
  ];

  const AudioSys = {
    ctx: null, master: null, muted: false,
    engineOsc: null, engineGain: null,
    sirenOsc: null, sirenGain: null, _sirenLfo: null,
    musicTimer: null, musicStep: 0, track: 0,

    init: function () {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
      } catch (e) { this.ctx = null; }
    },
    toggleMute: function () {
      this.muted = !this.muted;
      if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
      return this.muted;
    },
    // --- synth kit ---
    tone: function (freq, dur, type, vol, slideTo) {
      if (!this.ctx || this.muted) return;
      try {
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type || 'square';
        o.frequency.setValueAtTime(freq, t);
        if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
        g.gain.setValueAtTime(vol || 0.15, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g); g.connect(this.master);
        o.start(t); o.stop(t + dur + 0.02);
      } catch (e) { /* audio is best-effort */ }
    },
    at: function (delayMs, fn) { setTimeout(fn, delayMs); },
    noise: function (dur, vol, lowpass) {
      if (!this.ctx || this.muted) return;
      try {
        const t = this.ctx.currentTime;
        const len = Math.floor(this.ctx.sampleRate * dur);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const g = this.ctx.createGain();
        g.gain.value = vol || 0.2;
        let node = src;
        if (lowpass) {
          const f = this.ctx.createBiquadFilter();
          f.type = 'lowpass'; f.frequency.value = lowpass;
          src.connect(f); node = f;
        }
        node.connect(g); g.connect(this.master);
        src.start(t);
      } catch (e) { /* best-effort */ }
    },
    // --- one-shots ---
    shoot: function () { this.noise(0.16, 0.35, 1800); this.tone(160, 0.1, 'square', 0.12, 60); },
    punch: function () { this.noise(0.09, 0.3, 500); this.tone(90, 0.12, 'sine', 0.25, 45); },
    pickup: function () { this.tone(660, 0.1, 'sine', 0.16); this.at(90, () => this.tone(990, 0.16, 'sine', 0.16)); },
    coin: function () { this.tone(1318, 0.09, 'sine', 0.16); this.at(80, () => this.tone(1760, 0.2, 'sine', 0.16)); },
    cash: function () {
      this.tone(880, 0.08, 'triangle', 0.18);
      this.at(70, () => this.tone(1174, 0.08, 'triangle', 0.18));
      this.at(140, () => this.tone(1568, 0.18, 'triangle', 0.18));
    },
    mission: function () { const n = [523, 659, 784, 1046]; n.forEach((f, i) => this.at(i * 110, () => this.tone(f, 0.22, 'triangle', 0.2))); },
    fail: function () { this.tone(220, 0.4, 'sawtooth', 0.15, 110); },
    click: function () { this.tone(1200, 0.05, 'square', 0.1); },
    crash: function () { this.noise(0.3, 0.3, 900); },
    skid: function () { this.noise(0.25, 0.14, 2400); },
    door: function () { this.noise(0.08, 0.28, 700); this.tone(140, 0.09, 'sine', 0.2, 70); },
    radio: function () { this.tone(950, 0.07, 'square', 0.08); this.at(90, () => this.tone(1250, 0.1, 'square', 0.08)); },
    engineStart: function () { this.tone(70, 0.5, 'sawtooth', 0.12, 160); },
    repair: function () { this.tone(440, 0.1, 'triangle', 0.15); this.at(120, () => this.tone(587, 0.12, 'triangle', 0.15)); this.at(240, () => this.tone(880, 0.2, 'triangle', 0.15)); },
    // --- continuous: engine + siren ---
    engineSet: function (speed01, on) {
      if (!this.ctx || this.muted) { if (this.engineGain) this.engineGain.gain.value = 0; return; }
      try {
        if (!this.engineOsc) {
          this.engineOsc = this.ctx.createOscillator();
          this.engineOsc.type = 'sawtooth';
          this.engineGain = this.ctx.createGain();
          this.engineGain.gain.value = 0;
          const f = this.ctx.createBiquadFilter();
          f.type = 'lowpass'; f.frequency.value = 700;
          this.engineOsc.connect(f); f.connect(this.engineGain); this.engineGain.connect(this.master);
          this.engineOsc.start();
        }
        const t = this.ctx.currentTime;
        this.engineOsc.frequency.setTargetAtTime(60 + speed01 * 160, t, 0.08);
        this.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.05 : 0, t, 0.1);
      } catch (e) { /* best-effort */ }
    },
    sirenSet: function (on) {
      if (!this.ctx) return;
      try {
        if (on && !this.sirenOsc) {
          this.sirenOsc = this.ctx.createOscillator();
          this.sirenOsc.type = 'sine';
          this.sirenGain = this.ctx.createGain();
          this.sirenGain.gain.value = this.muted ? 0 : 0.045;
          const lfo = this.ctx.createOscillator();
          lfo.frequency.value = 0.9;
          const lg = this.ctx.createGain(); lg.gain.value = 320;
          lfo.connect(lg); lg.connect(this.sirenOsc.frequency);
          this.sirenOsc.frequency.value = 780;
          this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
          this.sirenOsc.start(); lfo.start();
          this._sirenLfo = lfo;
        } else if (!on && this.sirenOsc) {
          try { this.sirenOsc.stop(); this._sirenLfo.stop(); } catch (e) {}
          this.sirenOsc = null; this.sirenGain = null; this._sirenLfo = null;
        }
      } catch (e) { /* best-effort */ }
    },
    // --- radio: two bass-and-hat loops, scheduled; starts on user gesture ---
    startMusic: function () {
      if (!this.ctx || this.musicTimer) return;
      this.musicTimer = setInterval(() => {
        if (this.muted || !this.ctx) return;
        const tr = TRACKS[this.track];
        const f = tr.bass[this.musicStep % tr.bass.length];
        if (f) this.tone(f, 0.22, 'triangle', 0.11);
        if (this.musicStep % tr.hatEvery === 0) this.noise(0.03, 0.03, 6000);
        this.musicStep++;
      }, TRACKS[this.track].stepMs);
    },
    nextTrack: function () {
      this.track = (this.track + 1) % TRACKS.length;
      this.musicStep = 0;
      if (this.musicTimer) {
        clearInterval(this.musicTimer);
        this.musicTimer = null;
        this.startMusic();
      }
      return TRACKS[this.track].name;
    },
    trackName: function () { return TRACKS[this.track].name; },
  };
  SB.Audio = AudioSys;
})();
