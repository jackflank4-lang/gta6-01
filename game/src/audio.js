// All sound in Solmar Bay is synthesised live with WebAudio: no audio files,
// no network, nothing to load. Engine hum, sirens, gunshots, pickups and three
// little radio stations are all oscillators, noise buffers and envelopes built
// here. Everything is guarded: if the browser has no audio device, or the
// player muted the game, every call is a silent no-op.

// Three original radio loops, written as step patterns. Each step is
// [midi note or 0 for rest, length in steps]. 8th notes at 112 BPM.
const RADIO_TRACKS = [
  {
    name: 'SUNSET DRIVE',
    bass: [45, 0, 45, 0, 48, 0, 45, 0, 43, 0, 43, 0, 50, 0, 48, 0],
    lead: [69, 0, 72, 0, 76, 0, 72, 0, 69, 0, 67, 0, 69, 0, 0, 0],
  },
  {
    name: 'VICE LIGHTS',
    bass: [41, 41, 0, 41, 0, 41, 44, 0, 41, 41, 0, 41, 46, 0, 44, 0],
    lead: [77, 0, 0, 76, 0, 74, 0, 72, 0, 74, 0, 76, 0, 79, 0, 0],
  },
  {
    name: 'BAY BREEZE',
    bass: [48, 0, 0, 48, 0, 0, 53, 0, 48, 0, 0, 48, 0, 0, 55, 0],
    lead: [72, 0, 76, 0, 79, 0, 76, 0, 72, 0, 74, 0, 76, 0, 79, 0],
  },
];

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineNodes = null;
    this.sirenNodes = null;
    this.radio = { track: 0, step: 0, timer: null, on: false };
    this.unlocked = false;
  }

  // Browsers only let audio start from a user gesture; call this from the
  // start button (and any key press) and it builds the graph once.
  unlock() {
    if (this.unlocked) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.unlocked = true;
    } catch (err) {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.value = muted ? 0 : 0.5;
    }
  }

  // A short oscillator blip with a pitch slide and a decay envelope.
  blip(freqFrom, freqTo, seconds, type, volume) {
    if (!this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freqFrom, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), now + seconds);
      gain.gain.setValueAtTime(volume || 0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + seconds + 0.02);
    } catch (err) { /* audio is decoration, never fatal */ }
  }

  // Filtered noise burst: gunshots, punches, crashes.
  noise(seconds, volume, filterFreq) {
    if (!this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const length = Math.max(1, Math.floor(this.ctx.sampleRate * seconds));
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq || 1200;
      const gain = this.ctx.createGain();
      gain.gain.value = volume || 0.3;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      source.start(now);
    } catch (err) { /* ignore */ }
  }

  click() { this.blip(660, 520, 0.07, 'square', 0.12); }
  coin() { this.blip(988, 988, 0.09, 'sine', 0.2); setTimeout(() => this.blip(1319, 1319, 0.14, 'sine', 0.2), 80); }
  pickup() { this.blip(523, 784, 0.12, 'triangle', 0.22); }
  thud() { this.noise(0.12, 0.35, 300); this.blip(90, 45, 0.12, 'sine', 0.3); }
  shot() { this.noise(0.16, 0.5, 2600); this.blip(220, 60, 0.1, 'sawtooth', 0.25); }
  crash() { this.noise(0.4, 0.5, 700); this.blip(140, 40, 0.35, 'sawtooth', 0.3); }
  missionDone() {
    this.blip(523, 523, 0.12, 'triangle', 0.22);
    setTimeout(() => this.blip(659, 659, 0.12, 'triangle', 0.22), 110);
    setTimeout(() => this.blip(784, 784, 0.22, 'triangle', 0.25), 220);
  }
  busted() { this.blip(392, 196, 0.5, 'sawtooth', 0.25); }
  horn() { this.blip(370, 370, 0.28, 'square', 0.16); this.blip(466, 466, 0.28, 'square', 0.12); }

  // Continuous engine hum: a sawtooth through a lowpass, pitch follows speed.
  engine(on, speed01) {
    if (!this.ctx) return;
    try {
      if (on && !this.muted) {
        if (!this.engineNodes) {
          const osc = this.ctx.createOscillator();
          const filter = this.ctx.createBiquadFilter();
          const gain = this.ctx.createGain();
          osc.type = 'sawtooth';
          filter.type = 'lowpass';
          filter.frequency.value = 500;
          gain.gain.value = 0.0;
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.master);
          osc.start();
          this.engineNodes = { osc, filter, gain };
        }
        const now = this.ctx.currentTime;
        this.engineNodes.osc.frequency.setTargetAtTime(55 + speed01 * 165, now, 0.08);
        this.engineNodes.filter.frequency.setTargetAtTime(400 + speed01 * 1400, now, 0.08);
        this.engineNodes.gain.gain.setTargetAtTime(0.05 + speed01 * 0.05, now, 0.1);
      } else if (this.engineNodes) {
        const now = this.ctx.currentTime;
        this.engineNodes.gain.gain.setTargetAtTime(0, now, 0.05);
      }
    } catch (err) { /* ignore */ }
  }

  // Two-tone police siren, alternating every 0.45 s while wanted.
  siren(on) {
    if (!this.ctx) return;
    try {
      if (on && !this.muted) {
        if (!this.sirenNodes) {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.value = 750;
          gain.gain.value = 0.0;
          osc.connect(gain);
          gain.connect(this.master);
          osc.start();
          this.sirenNodes = { osc, gain, high: false, next: 0 };
        }
        const now = this.ctx.currentTime;
        if (now >= this.sirenNodes.next) {
          this.sirenNodes.high = !this.sirenNodes.high;
          this.sirenNodes.osc.frequency.setTargetAtTime(this.sirenNodes.high ? 950 : 650, now, 0.05);
          this.sirenNodes.next = now + 0.45;
        }
        this.sirenNodes.gain.gain.setTargetAtTime(0.045, now, 0.1);
      } else if (this.sirenNodes) {
        this.sirenNodes.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      }
    } catch (err) { /* ignore */ }
  }

  // The radio: a step sequencer ticking every 0.27 s, bass + lead, low volume.
  radioStart() {
    if (this.radio.on || !this.ctx) return;
    this.radio.on = true;
    this.radio.step = 0;
    const tick = () => {
      if (!this.radio.on) return;
      if (!this.muted && this.ctx) {
        const track = RADIO_TRACKS[this.radio.track];
        const bassNote = track.bass[this.radio.step % 16];
        const leadNote = track.lead[this.radio.step % 16];
        if (bassNote) this.blip(midiToFreq(bassNote), midiToFreq(bassNote), 0.24, 'triangle', 0.11);
        if (leadNote) this.blip(midiToFreq(leadNote), midiToFreq(leadNote), 0.22, 'square', 0.045);
      }
      this.radio.step += 1;
      this.radio.timer = setTimeout(tick, 268);
    };
    tick();
  }

  radioStop() {
    this.radio.on = false;
    if (this.radio.timer) clearTimeout(this.radio.timer);
  }

  radioNext() {
    this.radio.track = (this.radio.track + 1) % RADIO_TRACKS.length;
    return RADIO_TRACKS[this.radio.track].name;
  }

  radioName() {
    return RADIO_TRACKS[this.radio.track].name;
  }

  stopAll() {
    this.engine(false, 0);
    this.siren(false);
    this.radioStop();
  }
}
