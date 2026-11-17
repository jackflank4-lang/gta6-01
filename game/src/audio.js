// Synthesised sound for Solmar Bay: every sound is made with WebAudio
// oscillators and filtered noise, no audio files. The context is created
// on the first user gesture (the Start button), so browsers never block it.
function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

// Three original radio loops. Each is 16 steps: a bass line and a lead
// line of MIDI notes (0 = rest), with its own tempo and feel.
const TRACKS = [
  {
    name: 'Neon Drive',
    bpm: 112,
    bass: [45, 0, 45, 0, 48, 0, 45, 0, 43, 0, 43, 0, 50, 0, 48, 0],
    lead: [69, 0, 72, 76, 0, 74, 72, 0, 69, 0, 67, 69, 0, 72, 0, 0],
  },
  {
    name: 'Bay Lights',
    bpm: 96,
    bass: [41, 0, 0, 41, 0, 46, 0, 0, 44, 0, 0, 44, 0, 39, 0, 0],
    lead: [65, 68, 0, 72, 0, 0, 71, 0, 69, 0, 68, 0, 65, 0, 0, 0],
  },
  {
    name: 'Kingfish',
    bpm: 128,
    bass: [38, 38, 0, 38, 0, 41, 0, 38, 36, 36, 0, 36, 0, 43, 0, 0],
    lead: [74, 0, 74, 77, 0, 76, 0, 74, 72, 0, 74, 0, 79, 77, 0, 0],
  },
];

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
    this.radioOn = false;
    this.trackIndex = 0;
    this.step = 0;
    this.nextStepTime = 0;
    this.radioGain = null;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    this.radioGain = this.ctx.createGain();
    this.radioGain.gain.value = 0.16;
    this.radioGain.connect(this.master);
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  blip(freq, dur, type, vol, slideTo) {
    if (!this.ctx) return;
    const t = this.now();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noiseBurst(dur, vol, filterFreq) {
    if (!this.ctx) return;
    const t = this.now();
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  click() {
    this.blip(660, 0.07, 'square', 0.12);
  }

  horn() {
    this.blip(370, 0.35, 'square', 0.22, 370);
    this.blip(466, 0.35, 'square', 0.14, 466);
  }

  punch() {
    this.noiseBurst(0.12, 0.5, 500);
    this.blip(120, 0.1, 'sine', 0.4, 60);
  }

  crash() {
    this.noiseBurst(0.35, 0.6, 900);
    this.blip(90, 0.25, 'sawtooth', 0.25, 45);
  }

  coin() {
    if (!this.ctx) return;
    this.blip(988, 0.09, 'sine', 0.25);
    setTimeout(() => this.blip(1319, 0.14, 'sine', 0.25), 70);
  }

  shot() {
    this.noiseBurst(0.15, 0.5, 2400);
    this.blip(220, 0.1, 'square', 0.2, 70);
  }

  // Engine hum that follows the car's speed (0..1). Call every frame.
  setEngine(on, speedNorm) {
    if (!this.ctx) return;
    if (!on) {
      if (this.engineOsc) {
        try { this.engineOsc.stop(); } catch (e) { /* already stopped */ }
        this.engineOsc = null;
      }
      return;
    }
    if (!this.engineOsc) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 420;
      const g = this.ctx.createGain();
      g.gain.value = 0.05;
      o.connect(f);
      f.connect(g);
      g.connect(this.master);
      o.start();
      this.engineOsc = o;
      this.engineGain = g;
      this.engineFilter = f;
    }
    const t = this.now();
    this.engineOsc.frequency.setTargetAtTime(55 + speedNorm * 130, t, 0.08);
    this.engineGain.gain.setTargetAtTime(0.03 + speedNorm * 0.06, t, 0.08);
  }

  // Two-tone police siren while the player is wanted.
  setSiren(on) {
    if (!this.ctx) return;
    if (on === this.sirenOn) return;
    this.sirenOn = on;
    if (!on) {
      if (this.sirenOsc) {
        try { this.sirenOsc.stop(); } catch (e) { /* already stopped */ }
        this.sirenOsc = null;
      }
      return;
    }
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 750;
    const g = this.ctx.createGain();
    g.gain.value = 0.05;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 1.4;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain);
    lfoGain.connect(o.frequency);
    o.connect(g);
    g.connect(this.master);
    o.start();
    lfo.start();
    this.sirenOsc = o;
  }

  radioNext() {
    this.trackIndex = (this.trackIndex + 1) % TRACKS.length;
    this.step = 0;
    this.nextStepTime = this.now();
    return TRACKS[this.trackIndex].name;
  }

  trackName() {
    return TRACKS[this.trackIndex].name;
  }

  setRadio(on) {
    this.radioOn = on;
    if (on && this.ctx) this.nextStepTime = this.now() + 0.05;
  }

  // Step sequencer: schedule notes a little ahead of the playhead.
  update() {
    if (!this.ctx || !this.radioOn) return;
    const track = TRACKS[this.trackIndex];
    const stepDur = 60 / track.bpm / 2;
    while (this.nextStepTime < this.now() + 0.25) {
      const s = this.step % 16;
      const bass = track.bass[s];
      const lead = track.lead[s];
      if (bass) this.noteAt(midiToFreq(bass), this.nextStepTime, stepDur * 0.9, 'triangle', 0.22);
      if (lead) this.noteAt(midiToFreq(lead), this.nextStepTime, stepDur * 0.8, 'square', 0.07);
      this.step += 1;
      this.nextStepTime += stepDur;
    }
  }

  noteAt(freq, t, dur, type, vol) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.radioGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
}
