// Synthesised audio for Solmar Bay (v10). WebAudio only, no audio files.
// Engine hum, police siren, horn, crash, punch, coin chime and three original
// radio tracks (simple looping note patterns). Everything is guarded so the
// game keeps running when audio is unavailable or blocked.

const STATIONS = [
  { name: 'NEON 88.4', bpm: 96, wave: 'sawtooth', notes: [55, 0, 65.41, 0, 49, 0, 58.27, 0, 55, 0, 82.41, 0, 73.42, 0, 65.41, 0] },
  { name: 'BAY FM 101', bpm: 120, wave: 'square', notes: [87.31, 103.83, 116.54, 103.83, 87.31, 0, 98, 116.54, 130.81, 116.54, 98, 0, 87.31, 0, 110, 0] },
  { name: 'SOLMAR NIGHTS', bpm: 76, wave: 'triangle', notes: [110, 0, 0, 130.81, 0, 0, 98, 0, 0, 110, 0, 0, 146.83, 0, 130.81, 0] },
];

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let radioTimer = null;
  let radioStep = 0;
  let radioGain = null;
  let station = 0;
  let radioOn = false;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      radioGain = ctx.createGain();
      radioGain.gain.value = 0.12;
      radioGain.connect(master);
    } catch (e) {
      ctx = null;
      return false;
    }
    return true;
  }

  function resume() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch (e) { /* audio is best-effort */ }
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    try {
      const t = ctx.currentTime;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filterFreq || 800;
      const g = ctx.createGain();
      g.gain.value = vol || 0.3;
      src.connect(f);
      f.connect(g);
      g.connect(master);
      src.start(t);
    } catch (e) { /* best-effort */ }
  }

  function startEngine() {
    if (!ensure()) return;
    try {
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 55;
        engineGain = ctx.createGain();
        engineGain.gain.value = 0.0;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 320;
        engineOsc.connect(f);
        f.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
    } catch (e) { /* best-effort */ }
  }

  function setEngine(speedNorm, inCar) {
    if (!engineOsc || !engineGain) return;
    try {
      const t = ctx.currentTime;
      engineGain.gain.setTargetAtTime(inCar ? 0.05 + speedNorm * 0.06 : 0.0, t, 0.1);
      engineOsc.frequency.setTargetAtTime(48 + speedNorm * 130, t, 0.08);
    } catch (e) { /* best-effort */ }
  }

  function startSiren() {
    if (!ensure() || sirenOsc) return;
    try {
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0.0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      let high = true;
      sirenTimer = window.setInterval(() => {
        if (!sirenOsc) return;
        try {
          sirenOsc.frequency.setTargetAtTime(high ? 950 : 650, ctx.currentTime, 0.05);
          sirenGain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.1);
        } catch (e) { /* best-effort */ }
        high = !high;
      }, 420);
    } catch (e) { /* best-effort */ }
  }

  function stopSiren() {
    try {
      if (sirenTimer) { window.clearInterval(sirenTimer); sirenTimer = null; }
      if (sirenOsc) {
        sirenOsc.stop();
        sirenOsc.disconnect();
        sirenOsc = null;
      }
      if (sirenGain) { sirenGain.disconnect(); sirenGain = null; }
    } catch (e) { /* best-effort */ }
  }

  function radioTick() {
    if (!radioOn || !ensure() || muted) return;
    const st = STATIONS[station];
    const freq = st.notes[radioStep % st.notes.length];
    radioStep += 1;
    if (freq > 0) {
      try {
        const t = ctx.currentTime;
        const o = ctx.createOscillator();
        o.type = st.wave;
        o.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + (60 / st.bpm) * 0.9);
        o.connect(g);
        g.connect(radioGain);
        o.start(t);
        o.stop(t + (60 / st.bpm));
      } catch (e) { /* best-effort */ }
    }
  }

  function startRadio() {
    if (radioOn) return;
    radioOn = true;
    radioStep = 0;
    if (!ensure()) return;
    const st = STATIONS[station];
    radioTimer = window.setInterval(radioTick, (60 / st.bpm) * 1000);
  }

  function stopRadio() {
    radioOn = false;
    if (radioTimer) { window.clearInterval(radioTimer); radioTimer = null; }
  }

  function nextStation() {
    station = (station + 1) % STATIONS.length;
    if (radioOn) {
      stopRadio();
      startRadio();
    }
    return STATIONS[station].name;
  }

  function horn() { blip(370, 0.35, 'square', 0.16); blip(466, 0.35, 'square', 0.12); }
  function crash(strength) { noise(0.25, Math.min(0.5, 0.15 + strength * 0.3), 500); blip(70, 0.2, 'sine', 0.25, 40); }
  function punch() { noise(0.09, 0.28, 300); blip(120, 0.08, 'sine', 0.2, 60); }
  function coin() { blip(988, 0.12, 'sine', 0.18); window.setTimeout(() => blip(1319, 0.18, 'sine', 0.18), 90); }
  function missionDone() { [523, 659, 784, 1047].forEach((f, i) => window.setTimeout(() => blip(f, 0.22, 'triangle', 0.2), i * 110)); }
  function busted() { [392, 311, 233].forEach((f, i) => window.setTimeout(() => blip(f, 0.3, 'sawtooth', 0.14), i * 160)); }
  function click() { blip(800, 0.05, 'square', 0.08); }

  function setMuted(v) {
    muted = v;
    if (master) { try { master.gain.value = v ? 0 : 0.5; } catch (e) { /* best-effort */ } }
  }

  return {
    resume, ensure, startEngine, setEngine, startSiren, stopSiren,
    startRadio, stopRadio, nextStation, stationName: () => STATIONS[station].name,
    horn, crash, punch, coin, missionDone, busted, click, setMuted,
  };
}
