// Synthesised sound only (WebAudio, no audio files): engine hum, police
// sirens, horns, crashes, punches, gunshots, coin chimes, and three original
// radio stations built from a tiny step sequencer. The context is created on
// the first user gesture (the start button), so autoplay rules never block it.

const NOTE = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

const STATIONS = [
  {
    name: 'Neon FM',
    wave: 'sawtooth',
    bpm: 116,
    root: 45, // A2
    bass: [0, 0, 12, 0, 3, 0, 10, 7, 0, 0, 12, 0, 3, 5, 7, 10],
    lead: [12, -1, 15, 19, -1, 15, 12, -1, 10, -1, 12, 15, 19, 15, 12, 10],
  },
  {
    name: 'Bay 98',
    wave: 'square',
    bpm: 104,
    root: 41, // F2
    bass: [0, -1, 0, 7, -1, 0, 5, 3, 0, -1, 0, 7, 10, 7, 5, 3],
    lead: [12, 15, 17, 15, 12, -1, 10, 12, 15, 17, 19, 17, 15, 12, 10, 7],
  },
  {
    name: 'Solmar Nights',
    wave: 'triangle',
    bpm: 88,
    root: 48, // C3
    bass: [0, -1, -1, 7, -1, -1, 5, -1, 3, -1, -1, 7, -1, 5, 7, 10],
    lead: [12, -1, 16, -1, 19, -1, 16, 12, 14, -1, 12, -1, 10, 12, 14, 16],
  },
];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineFilter = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.stationIndex = 0;
    this.stationStep = 0;
    this.nextStepTime = 0;
    this.muted = false;
    this.noiseBuffer = null;
  }

  // Must be called from a user gesture at least once.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.master);

    // Reusable white-noise buffer for crashes, gunshots and punches.
    const len = this.ctx.sampleRate;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    // Continuous engine hum: two detuned saws through a lowpass.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 52;
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'square';
    this.engineOsc2.frequency.value = 26;
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    this.engineOsc2.start();

    // Police siren: a sine that wails between two pitches.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'sine';
    this.sirenOsc.frequency.value = 720;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0.0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    this.sirenPhase = 0;

    this.nextStepTime = this.ctx.currentTime + 0.1;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.55;
  }

  stationName() {
    return STATIONS[this.stationIndex].name;
  }

  nextStation() {
    this.stationIndex = (this.stationIndex + 1) % STATIONS.length;
    this.stationStep = 0;
    return this.stationName();
  }

  // One short synth note, scheduled at `when`.
  blip(when, midi, duration, type, volume, dest) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = NOTE(midi);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + duration);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(when);
    osc.stop(when + duration + 0.02);
  }

  // A burst of filtered noise, scheduled at `when`.
  noise(when, duration, volume, filterType, filterFreq) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(when);
    src.stop(when + duration + 0.02);
  }

  // --- one-shot effects -------------------------------------------------
  horn() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.blip(t, 70, 0.28, 'square', 0.16, this.sfxGain);
    this.blip(t, 75, 0.28, 'square', 0.16, this.sfxGain);
  }

  crash(strength = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noise(t, 0.25 * strength + 0.1, 0.5 * strength, 'lowpass', 900);
    this.blip(t, 36, 0.2, 'sine', 0.5 * strength, this.sfxGain);
  }

  punch() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noise(t, 0.09, 0.4, 'bandpass', 300);
    this.blip(t, 55, 0.12, 'sine', 0.35, this.sfxGain);
  }

  gunshot() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noise(t, 0.14, 0.55, 'highpass', 1200);
    this.blip(t, 50, 0.1, 'square', 0.2, this.sfxGain);
  }

  coin() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.blip(t, 88, 0.12, 'sine', 0.3, this.sfxGain);
    this.blip(t + 0.09, 95, 0.22, 'sine', 0.3, this.sfxGain);
  }

  jingle() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [76, 79, 83, 88].forEach((midi, i) => this.blip(t + i * 0.09, midi, 0.18, 'triangle', 0.28, this.sfxGain));
  }

  fail() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [64, 61, 58].forEach((midi, i) => this.blip(t + i * 0.14, midi, 0.22, 'sawtooth', 0.2, this.sfxGain));
  }

  // --- per-frame update ---------------------------------------------------
  update(dt, speedKmh, wanted) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Engine pitch follows speed; quiet on foot.
    const rev = 46 + Math.min(speedKmh, 180) * 0.85;
    this.engineOsc.frequency.setTargetAtTime(rev, now, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(rev * 0.5, now, 0.08);
    const engineVol = speedKmh > 1 ? 0.05 + Math.min(speedKmh / 180, 1) * 0.05 : 0.028;
    this.engineGain.gain.setTargetAtTime(engineVol, now, 0.1);

    // Siren wails while the player is wanted.
    this.sirenPhase += dt * 2.1;
    const sirenFreq = 660 + Math.sin(this.sirenPhase) * 190;
    this.sirenOsc.frequency.setTargetAtTime(sirenFreq, now, 0.05);
    this.sirenGain.gain.setTargetAtTime(wanted > 0 ? 0.045 : 0, now, 0.3);

    // Radio sequencer: schedule steps slightly ahead of the playhead.
    const station = STATIONS[this.stationIndex];
    const stepDur = 60 / station.bpm / 2; // eighth notes
    while (this.nextStepTime < now + 0.15) {
      const step = this.stationStep % 16;
      const bassNote = station.bass[step];
      const leadNote = station.lead[step];
      if (bassNote >= 0) this.blip(this.nextStepTime, station.root + bassNote, stepDur * 0.95, station.wave, 0.22, this.musicGain);
      if (leadNote >= 0) this.blip(this.nextStepTime, station.root + 24 + leadNote, stepDur * 0.9, 'sine', 0.12, this.musicGain);
      this.stationStep++;
      this.nextStepTime += stepDur;
    }
  }
}
