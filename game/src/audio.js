// Procedural sound for Solmar Bay — Neon Heat.
// Everything is synthesized with WebAudio: no audio files are shipped.
// The context is created lazily on the first user gesture so the page can
// boot silently under headless capture; every method is a no-op until then.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
    this.radioOn = false;
    this.station = 0;
    this.radioTimer = null;
    this.radioStep = 0;
    this.radioNextTime = 0;
    // Three stations: neon synthwave, lo-fi cruise, latin bounce.
    // Each step is [bassNote, leadNote] in semitones from A2; 0 = rest.
    this.stations = [
      {
        name: 'NEON 88.4',
        bpm: 112,
        bass: [0, 0, 12, 0, 10, 0, 12, 0, 0, 0, 12, 0, 15, 0, 12, 10],
        lead: [24, 0, 0, 27, 0, 24, 0, 0, 22, 0, 24, 0, 27, 29, 27, 24],
        wave: 'sawtooth',
      },
      {
        name: 'SUNSET 91.1',
        bpm: 84,
        bass: [0, 0, 0, 7, 0, 0, 5, 0, 0, 0, 0, 7, 0, 10, 0, 7],
        lead: [12, 0, 16, 0, 19, 0, 16, 12, 0, 14, 0, 16, 0, 19, 21, 0],
        wave: 'triangle',
      },
      {
        name: 'CALLE 97.9',
        bpm: 128,
        bass: [0, 7, 0, 7, 0, 10, 0, 7, 0, 7, 0, 12, 0, 10, 7, 0],
        lead: [24, 0, 24, 0, 26, 0, 24, 0, 29, 0, 26, 24, 0, 22, 0, 24],
        wave: 'square',
      },
    ];
  }

  // Must be called from a user gesture (Start button / key press).
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
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      return true;
    } catch (err) {
      return false;
    }
  }

  ready() {
    return !!this.ctx;
  }

  noteFreq(semitones) {
    return 110 * Math.pow(2, semitones / 12);
  }

  blip(freq, dur, type, vol, when) {
    if (!this.ctx) return;
    const t = when || this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise(dur, vol, filterFreq) {
    if (!this.ctx) return;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const g = this.ctx.createGain();
    g.gain.value = vol || 0.3;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start();
  }

  // Continuous engine hum; call every frame with speed 0..1.
  engine(speed01) {
    if (!this.ctx) return;
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(52 + speed01 * 130, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(320 + speed01 * 900, t, 0.1);
    this.engineGain.gain.setTargetAtTime(0.02 + speed01 * 0.05, t, 0.1);
  }

  // Two-tone police siren while the player is wanted.
  siren(on, dt) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 720;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.045;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.sirenTimer = 0;
    }
    if (!on && this.sirenOsc) {
      try { this.sirenOsc.stop(); } catch (err) { /* already stopped */ }
      this.sirenOsc.disconnect();
      this.sirenOsc = null;
      this.sirenGain = null;
      return;
    }
    if (this.sirenOsc) {
      this.sirenTimer += dt || 0;
      const hi = Math.floor(this.sirenTimer / 0.45) % 2 === 0;
      this.sirenOsc.frequency.setTargetAtTime(hi ? 920 : 660, this.ctx.currentTime, 0.05);
    }
  }

  horn() {
    if (!this.ctx) return;
    this.blip(330, 0.28, 'square', 0.12);
    this.blip(415, 0.28, 'square', 0.1);
  }

  crash() {
    this.noise(0.35, 0.5, 900);
    this.blip(70, 0.25, 'sine', 0.4);
  }

  punch() {
    this.noise(0.12, 0.4, 1800);
    this.blip(140, 0.1, 'sine', 0.3);
  }

  coin() {
    if (!this.ctx) return;
    this.blip(988, 0.09, 'sine', 0.22);
    this.blip(1319, 0.16, 'sine', 0.22, this.ctx.currentTime + 0.09);
  }

  pickup() {
    this.blip(523, 0.12, 'triangle', 0.2);
    this.blip(784, 0.2, 'triangle', 0.2, this.ctx ? this.ctx.currentTime + 0.1 : 0);
  }

  missionDone() {
    if (!this.ctx) return;
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => this.blip(f, 0.22, 'triangle', 0.22, this.ctx.currentTime + i * 0.11));
  }

  busted() {
    this.blip(220, 0.5, 'sawtooth', 0.2);
    this.blip(165, 0.7, 'sawtooth', 0.2, this.ctx ? this.ctx.currentTime + 0.4 : 0);
  }

  // Radio: a lookahead step sequencer, one 16-step loop per station.
  startRadio() {
    if (!this.ensure()) return;
    if (this.radioOn) return;
    this.radioOn = true;
    this.radioStep = 0;
    this.radioNextTime = this.ctx.currentTime + 0.06;
    this.radioTimer = setInterval(() => this.scheduleRadio(), 40);
  }

  stopRadio() {
    this.radioOn = false;
    if (this.radioTimer) {
      clearInterval(this.radioTimer);
      this.radioTimer = null;
    }
  }

  nextStation() {
    this.station = (this.station + 1) % this.stations.length;
    this.radioStep = 0;
    return this.stations[this.station].name;
  }

  currentStation() {
    return this.stations[this.station].name;
  }

  scheduleRadio() {
    if (!this.radioOn || !this.ctx) return;
    const st = this.stations[this.station];
    const stepDur = 60 / st.bpm / 2; // eighth notes
    while (this.radioNextTime < this.ctx.currentTime + 0.18) {
      const i = this.radioStep % 16;
      const bass = st.bass[i];
      const lead = st.lead[i];
      if (bass !== 0) this.blip(this.noteFreq(bass), stepDur * 0.9, 'triangle', 0.16, this.radioNextTime);
      if (lead !== 0) this.blip(this.noteFreq(lead), stepDur * 0.8, st.wave, 0.07, this.radioNextTime);
      if (this.radioStep % 4 === 0) this.noise(0.03, 0.05, 6000); // hat tick
      this.radioStep++;
      this.radioNextTime += stepDur;
    }
  }
}
