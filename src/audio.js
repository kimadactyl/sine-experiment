import { PARTIALS } from './state.js';
import { pan } from './mapping.js';

const VOICE_LEVEL = 0.15;
const NOISE_LEVEL = 0.015;
const OVERLAP_LEVEL = 0.12;

let ctx;
let master;
let wet;
let noise;
let analyser;
let scopeBuf;
const voices = [];
const pairs = [];

export function startAudio(state) {
  ctx = new AudioContext();

  const mix = ctx.createGain();
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 1500;
  lowpass.Q.value = 0.4;

  const reverb = ctx.createConvolver();
  reverb.buffer = impulse(3.5);
  wet = ctx.createGain();
  wet.gain.value = 0;

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.knee.value = 12;
  comp.ratio.value = 4;
  comp.attack.value = 0.05;
  comp.release.value = 0.5;

  master = ctx.createGain();
  master.gain.value = 0;
  analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  scopeBuf = new Float32Array(analyser.fftSize);

  mix.connect(lowpass);
  lowpass.connect(comp);
  lowpass.connect(reverb).connect(wet).connect(comp);
  comp.connect(master).connect(analyser).connect(ctx.destination);

  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = brownNoise(4);
  noiseSrc.loop = true;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.value = 900;
  noise = ctx.createGain();
  noise.gain.value = 0;
  noiseSrc.connect(noiseFilter).connect(noise).connect(comp);
  noiseSrc.start();

  for (const v of state.voices) {
    const out = ctx.createGain();
    out.gain.value = 0;
    const panner = ctx.createStereoPanner();
    out.connect(panner).connect(mix);
    const oscs = [];
    const gains = [];
    for (let k = 0; k < PARTIALS; k++) {
      const osc = ctx.createOscillator();
      osc.frequency.value = v.freq * (k + 1);
      const g = ctx.createGain();
      g.gain.value = 0;
      osc.connect(g).connect(out);
      osc.start();
      oscs.push(osc);
      gains.push(g);
    }
    voices.push({ out, panner, oscs, gains });
  }

  for (const o of state.overlaps) {
    const osc = ctx.createOscillator();
    osc.frequency.value = o.freq;
    const out = ctx.createGain();
    out.gain.value = 0;
    const panner = ctx.createStereoPanner();
    osc.connect(out).connect(panner).connect(mix);
    osc.start();
    pairs.push({ osc, out, panner });
  }
}

// Called every frame with the same state draw.js is about to draw.
export function updateAudio(state) {
  if (!ctx) return;
  const t = ctx.currentTime;
  state.voices.forEach((v, i) => {
    const n = voices[i];
    n.out.gain.setTargetAtTime(v.amp * VOICE_LEVEL, t, 0.04);
    n.panner.pan.setTargetAtTime(pan(v.ox), t, 0.1);
    for (let k = 0; k < PARTIALS; k++) {
      n.oscs[k].frequency.setTargetAtTime(v.freq * (k + 1), t, 0.02);
      n.gains[k].gain.setTargetAtTime(v.partials[k] + v.spikes[k], t, 0.05);
    }
  });
  state.overlaps.forEach((o, i) => {
    const n = pairs[i];
    n.osc.frequency.setTargetAtTime(o.freq, t, 0.02);
    n.out.gain.setTargetAtTime(o.level * OVERLAP_LEVEL, t, 0.08);
    n.panner.pan.setTargetAtTime(pan(o.ox), t, 0.1);
  });
  noise.gain.setTargetAtTime(state.noise * NOISE_LEVEL, t, 0.2);
  wet.gain.setTargetAtTime(state.reverb, t, 0.2);
  master.gain.setTargetAtTime(state.master, t, 0.1);
}

// Loudness of what's actually leaving the speakers, for checking it's alive.
export function rms() {
  if (!analyser) return 0;
  analyser.getFloatTimeDomainData(scopeBuf);
  let sum = 0;
  for (const s of scopeBuf) sum += s * s;
  return Math.sqrt(sum / scopeBuf.length);
}

function impulse(seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buf.getChannelData(c);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  }
  return buf;
}

function brownNoise(seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[i] = last * 3.5;
  }
  return buf;
}
