// The only thing that changes state over time on its own. No meter: every gap is randomised.
import { state, PARTIALS } from './state.js';
import { CHORDS, MELODY, place, voiceLead, moveKey } from './tuning.js';
import { TAU, rand, pick, clamp, smoothstep, approach } from './util.js';

const STAGES = [
  { name: 'one', dur: 35, env: { breath: 0, spread: 0, harm: 0, wobble: 0, noise: 0, reverb: 0.15 } },
  { name: 'breathing', dur: 70, env: { breath: 0.5, spread: 0, harm: 0, wobble: 3, noise: 0, reverb: 0.25 } },
  { name: 'growth', dur: 45, env: { breath: 0.3, spread: 0, harm: 0, wobble: 3, noise: 0.2, reverb: 0.3 } },
  { name: 'chord', dur: 110, env: { breath: 0.3, spread: 0.09, harm: 0, wobble: 4, noise: 0.4, reverb: 0.35 } },
  { name: 'harmonics', dur: 90, env: { breath: 0.3, spread: 0.1, harm: 1, wobble: 5, noise: 0.6, reverb: 0.4 } },
  { name: 'drift', dur: Infinity, env: { breath: 0.4, spread: 0.11, harm: 1, wobble: 6, noise: 0.8, reverb: 0.45 } },
];
const DRIFT = STAGES.length - 1;
const START_KEY = 165;

export function createConductor() {
  let t = 0;
  let stage = 0;
  let stageEnd = Infinity;
  let key = START_KEY;
  let chord = -1;
  const env = { ...STAGES[0].env };
  const events = {};

  const voices = state.voices.map(() => ({
    log: Math.log2(START_KEY),
    from: Math.log2(START_KEY),
    to: Math.log2(START_KEY),
    t0: 0,
    dur: 0,
    wasHeld: false,
    amp: 0,
    ampTarget: 0,
    ampTau: 3,
    partials: new Array(PARTIALS).fill(0),
    partialTargets: new Array(PARTIALS).fill(0),
    p1: rand(9, 14),
    p2: rand(19, 31),
    o1: rand(0, TAU),
    o2: rand(0, TAU),
    wow: rand(0, TAU),
  }));

  function glide(p, freq, dur) {
    p.from = p.log;
    p.to = Math.log2(freq);
    p.t0 = t;
    p.dur = dur;
  }

  const at = (name, delay) => {
    events[name] = t + delay;
  };

  const actions = {
    melody() {
      const p = voices[0];
      const now = 2 ** p.log;
      let f = now;
      for (let tries = 0; tries < 6 && Math.abs(Math.log2(f / now)) < 0.02; tries++) {
        f = place(key * pick(MELODY), now, 130, 280);
      }
      glide(p, f, rand(3, 7));
      at('melody', rand(7, 16));
    },
    chord(dur = rand(4, 8)) {
      let next = chord;
      while (next === chord) next = Math.floor(Math.random() * CHORDS.length);
      chord = next;
      const targets = voiceLead(voices.map((p) => 2 ** p.log), CHORDS[chord].map((r) => key * r));
      targets.forEach((f, i) => glide(voices[i], f, dur));
      at('chord', rand(12, 26));
    },
    partials() {
      for (const p of voices) {
        for (let k = 1; k < PARTIALS; k++) {
          p.partialTargets[k] = Math.random() < 0.55 ? rand(0.05, 0.4) / Math.sqrt(k) : 0;
        }
      }
      at('partials', rand(10, 22));
    },
    key() {
      key = moveKey(key);
      actions.chord(rand(6, 10));
      at('key', rand(70, 160));
    },
    levels() {
      for (const p of voices) p.ampTarget = rand(0.25, 0.75);
      at('levels', rand(15, 35));
    },
  };

  function enter(i) {
    stage = i;
    stageEnd = t + STAGES[i].dur * rand(0.8, 1.2);
    state.stage = STAGES[i].name;
    const [a, b, c] = voices;

    if (i === 0) {
      a.ampTarget = 0.55;
      a.ampTau = 3;
    }
    if (i === 1) at('melody', rand(4, 8));
    if (i === 2) {
      events.melody = Infinity;
      glide(a, key * (2 / 3), 14);
      a.ampTarget = 0.95;
      a.ampTau = 10;
    }
    if (i === 3) {
      events.melody = Infinity;
      // The two new voices are born in unison with the first and glide apart into the chord.
      for (const p of [b, c]) {
        p.log = p.from = p.to = a.log;
        p.ampTarget = 0.55;
      }
      a.ampTarget = 0.6;
      for (const p of voices) p.ampTau = 10;
      actions.chord(9);
    }
    if (i === 4) actions.partials();
    if (i === DRIFT) {
      at('key', rand(60, 120));
      at('levels', rand(10, 20));
    }
  }

  function update(dtReal) {
    const dt = dtReal * state.driftSpeed;
    t += dt;
    if (t >= stageEnd) enter(stage + 1);
    for (const name in events) if (t >= events[name]) actions[name]();

    const target = STAGES[stage].env;
    for (const k in env) env[k] = approach(env[k], target[k], dt, 10);

    const harmSwell = stage === DRIFT ? 0.45 + 0.55 * (0.5 + 0.5 * Math.sin((TAU * t) / 97)) : 1;
    const harm = env.harm * harmSwell * state.harmonics;
    const turn = (TAU * t) / 83;
    const cx = 0.02 * Math.sin((TAU * t) / 47);
    const cy = 0.015 * Math.sin((TAU * t) / 59 + 1);

    voices.forEach((p, i) => {
      const v = state.voices[i];

      if (v.held) {
        p.log = Math.log2(v.dragFreq);
        p.wasHeld = true;
      } else {
        if (p.wasHeld) {
          // Let go: ease back to wherever the piece wants this voice now.
          p.wasHeld = false;
          p.from = p.log;
          p.t0 = t;
          p.dur = 6;
        }
        const x = p.dur > 0 ? Math.min(1, (t - p.t0) / p.dur) : 1;
        p.log = p.from + (p.to - p.from) * smoothstep(x);
        v.userGain = approach(v.userGain, 1, dt, 25);
      }

      const wow = env.wobble * state.haze * (0.7 * Math.sin(TAU * 0.4 * t + p.wow) + 0.3 * Math.sin(TAU * 0.13 * t));
      v.freq = 2 ** (p.log + wow / 1200);

      p.amp = approach(p.amp, p.ampTarget, dt, p.ampTau);
      const breath = 0.5 + 0.5 * (0.6 * Math.sin((TAU * t) / p.p1 + p.o1) + 0.4 * Math.sin((TAU * t) / p.p2 + p.o2));
      v.amp = clamp(p.amp * (1 - env.breath * breath) * v.userGain, 0, 1);

      v.partials[0] = 1;
      for (let k = 1; k < PARTIALS; k++) {
        p.partials[k] = approach(p.partials[k], p.partialTargets[k], dt, 5);
        v.partials[k] = p.partials[k] * harm;
      }

      const angle = turn + (i * TAU) / 3;
      v.ox = cx + env.spread * Math.cos(angle);
      v.oy = cy + env.spread * Math.sin(angle);
    });

    state.noise = env.noise * state.haze;
    state.reverb = Math.min(1, env.reverb * state.haze);
  }

  return {
    start: () => enter(0),
    skip: () => enter(Math.min(stage + 1, DRIFT)),
    update,
  };
}
