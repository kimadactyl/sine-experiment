// The only thing that changes state over time on its own. No meter: every gap is randomised.
import { state, PARTIALS, RIPPLES } from './state.js';
import { CHORDS, nearestTone, leadAll, freshTone, moveKey } from './tuning.js';
import { TAU, rand, pick, clamp, smoothstep, approach } from './util.js';

const START_KEY = 165;
const SILENT = 0.003;
const INTRO = 90;
const SPIKE_LEVEL = 0.45;

// Ears hear high sines as louder than low ones at the same level, so higher circles play softer; low ones aren't boosted, for small speakers' sake.
const pitchLoudness = (freq) => Math.min(1, (START_KEY / freq) ** 0.6);

// Harmonics landing above about 1 kHz, where hearing is most sensitive, fade away.
const soften = (freq) => 1 / (1 + (freq / 1200) ** 4);

// 0 before `from` seconds in, 1 after `to`, smooth in between.
const ramp = (t, from, to) => smoothstep(clamp((t - from) / (to - from), 0, 1));

// Two slow sine wobbles per axis with unrelated periods, so the path never repeats.
const wander = () => [rand(0.05, 0.15), rand(37, 89), rand(0, TAU), rand(0.05, 0.15), rand(29, 71), rand(0, TAU)];

export function createConductor() {
  let t = 0;
  let key = START_KEY;
  let chord = 0;
  let nextLeave = 0;
  const events = {};
  const tidePeriods = [rand(150, 200), rand(250, 330)];

  const voices = state.voices.map(() => ({
    alive: false,
    dies: Infinity,
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
    spike: 0,
    spikeTarget: 0,
    points: 1,
    breath: [rand(9, 14), rand(19, 31), rand(0, TAU), rand(0, TAU)],
    wow: rand(0, TAU),
    home: { x: 0, y: 0 },
    heading: 0,
    speed: 0,
    wander: wander(),
  }));

  const chordFreqs = () => CHORDS[chord].map((r) => key * r);
  const living = () => voices.filter((p) => p.alive);
  const at = (name, delay) => {
    events[name] = t + delay;
  };

  function glide(p, freq, dur) {
    p.from = p.log;
    p.to = Math.log2(freq);
    p.t0 = t;
    p.dur = dur;
  }

  function spawn(p, x, y, freq, amp, fadeIn, life) {
    p.alive = true;
    p.dies = t + life;
    p.log = p.from = p.to = Math.log2(freq);
    p.dur = 0;
    p.ampTarget = amp;
    p.ampTau = fadeIn;
    p.home = { x, y };
    p.heading = rand(0, TAU);
    p.speed = rand(0.004, 0.01);
    p.wander = wander();
    p.spike = p.spikeTarget = 0;
    newPartials(p);
  }

  function newPartials(p) {
    for (let k = 1; k < RIPPLES; k++) {
      p.partialTargets[k] = Math.random() < 0.55 ? rand(0.05, 0.4) / Math.sqrt(k) : 0;
    }
  }

  function addVoice() {
    const p = voices.find((q) => !q.alive && q.amp < SILENT);
    if (!p) return;
    const { hx, hy } = state.view;
    const freq = freshTone(chordFreqs(), living().map((q) => 2 ** q.log));
    spawn(p, rand(-hx, hx) * 0.75, rand(-hy, hy) * 0.75, freq, rand(0.3, 0.6), rand(4, 8), rand(50, 130));
  }

  // How full the piece wants to be: fills up over the intro, then ebbs and flows on two slow unrelated cycles.
  function tide() {
    if (t < INTRO) return 1;
    const s = t - INTRO;
    const [a, b] = tidePeriods;
    return 0.5 + 0.5 * (0.6 * Math.cos((TAU * s) / a) + 0.4 * Math.cos((TAU * s) / b));
  }

  function room() {
    if (t < INTRO) return 2 + Math.round(4 * ramp(t, 10, INTRO));
    return 1 + Math.round(5 * tide() ** 1.5);
  }

  const actions = {
    arrive() {
      if (living().length < room()) addVoice();
      at('arrive', rand(8, 25));
    },
    chord(dur = rand(4, 8)) {
      let next = chord;
      while (next === chord) next = Math.floor(Math.random() * CHORDS.length);
      chord = next;
      const moving = living();
      const targets = leadAll(moving.map((p) => 2 ** p.log), chordFreqs());
      moving.forEach((p, i) => glide(p, targets[i], dur));
      at('chord', rand(12, 26));
    },
    key() {
      key = moveKey(key);
      actions.chord(rand(6, 10));
      at('key', rand(70, 160));
    },
    partials() {
      for (const p of voices) newPartials(p);
      at('partials', rand(10, 22));
    },
    spike() {
      // Usually one spiky circle, sometimes two, never more; the lowest calm one, so its extra harmonics stay warm.
      const spiky = living().filter((p) => p.spikeTarget > 0);
      const calm = living().filter((p) => p.spikeTarget === 0);
      const busy = voices.filter((p) => (p.spike > 0.02 && (p.alive || p.amp > SILENT)) || (p.alive && p.spikeTarget > 0)).length;
      if (spiky.length && Math.random() < (spiky.length === 2 ? 0.5 : 0.35)) {
        pick(spiky).spikeTarget = 0;
      } else if (calm.length && (spiky.length === 0 ? busy === 0 : busy < 2 && Math.random() < 0.6)) {
        const p = calm.reduce((a, b) => (a.log < b.log ? a : b));
        p.spikeTarget = 1;
        p.dies = Math.max(p.dies, t + rand(90, 160));
        if (p.spike < 0.01) p.points = 4 + Math.floor(Math.random() * 4);
      }
      at('spike', rand(60, 150));
    },
  };

  function start() {
    spawn(voices[0], 0, 0, START_KEY, 0.55, 3, rand(120, 180));
    at('arrive', rand(8, 14));
    at('chord', rand(8, 14));
    at('key', rand(60, 100));
    at('partials', rand(5, 10));
    at('spike', INTRO + rand(60, 120));
  }

  function update(dtReal) {
    const dt = dtReal * state.driftSpeed;
    t += dt;
    for (const name in events) if (t >= events[name]) actions[name]();

    // Everything starts pure, and the texture fades in over the first minute or so.
    const motion = ramp(t, 0, 15);
    const breathDepth = 0.45 * ramp(t, 0, 12);
    const fullness = tide();
    const harm = (0.35 + 0.65 * ramp(t, 30, 100)) * (0.4 + 0.6 * fullness) * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin((TAU * t) / 97))) * state.harmonics;
    const wobble = 6 * ramp(t, 10, 60) * state.haze;
    const { hx, hy } = state.view;

    // When the tide goes out, the circles nearest the end of their lives leave first, a few seconds apart.
    const alive = living();
    if (alive.length > room() && t >= nextLeave) {
      const leaving = alive.filter((p) => !state.voices[voices.indexOf(p)].held).sort((a, b) => a.dies - b.dies)[0];
      if (leaving) leaving.dies = t;
      nextLeave = t + rand(4, 10);
    }

    voices.forEach((p, i) => {
      const v = state.voices[i];

      if (p.alive && t >= p.dies) {
        if (v.held || living().length === 1) {
          p.dies = t + rand(30, 60);
        } else {
          p.alive = false;
          p.ampTarget = 0;
          p.ampTau = rand(8, 14);
        }
      }

      if (v.held) {
        p.log = Math.log2(v.dragFreq);
        p.wasHeld = true;
      } else {
        if (p.wasHeld) {
          // Let go: ease back to the nearest note of whatever chord is sounding now.
          p.wasHeld = false;
          glide(p, nearestTone(2 ** p.log, chordFreqs()), 6);
        }
        const x = p.dur > 0 ? Math.min(1, (t - p.t0) / p.dur) : 1;
        p.log = p.from + (p.to - p.from) * smoothstep(x);
        v.userGain = approach(v.userGain, 1, dt, 25);
      }

      const wow = wobble * (0.7 * Math.sin(TAU * 0.4 * t + p.wow) + 0.3 * Math.sin(TAU * 0.13 * t));
      v.freq = 2 ** (p.log + wow / 1200);

      p.amp = approach(p.amp, p.ampTarget, dt, p.ampTau);
      const [b1, b2, o1, o2] = p.breath;
      const breath = 0.5 + 0.5 * (0.6 * Math.sin((TAU * t) / b1 + o1) + 0.4 * Math.sin((TAU * t) / b2 + o2));
      v.amp = clamp(p.amp * (1 - breathDepth * breath) * v.userGain * pitchLoudness(2 ** p.log), 0, 1);

      v.partials[0] = 1;
      for (let k = 1; k < PARTIALS; k++) {
        p.partials[k] = approach(p.partials[k], p.partialTargets[k], dt, 5);
        v.partials[k] = p.partials[k] * harm * soften(v.freq * (k + 1));
      }

      p.spike = approach(p.spike, p.spikeTarget, dt, 12);
      v.points = p.points;
      for (let k = 1; k < PARTIALS; k++) {
        v.spikes[k] = (p.spike * SPIKE_LEVEL * state.harmonics * soften(v.freq * (k + 1))) / Math.sqrt(k + 1);
      }

      // Home wanders on a slowly turning heading and turns back at the edges.
      p.heading += rand(-0.6, 0.6) * dt;
      p.home.x += Math.cos(p.heading) * p.speed * motion * dt;
      p.home.y += Math.sin(p.heading) * p.speed * motion * dt;
      if (Math.abs(p.home.x) > hx * 0.8) {
        p.home.x = Math.sign(p.home.x) * hx * 0.8;
        p.heading = Math.PI - p.heading;
      }
      if (Math.abs(p.home.y) > hy * 0.8) {
        p.home.y = Math.sign(p.home.y) * hy * 0.8;
        p.heading = -p.heading;
      }
      const [ax, px, ox, ay, py, oy] = p.wander;
      v.ox = p.home.x + motion * ax * Math.sin((TAU * t) / px + ox);
      v.oy = p.home.y + motion * ay * Math.sin((TAU * t) / py + oy);
    });

    state.noise = 0.8 * ramp(t, 20, 80) * state.haze;
    state.reverb = Math.min(1, (0.15 + 0.3 * ramp(t, 0, 60)) * state.haze);
    const n = living().length;
    state.status = `${n} circle${n === 1 ? '' : 's'}`;
  }

  return { start, addVoice, update };
}
