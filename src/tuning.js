import { F_MIN, F_MAX } from './mapping.js';
import { pick } from './util.js';

export const MELODY = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 2];

// Just-intonation triads as ratios of the key.
export const CHORDS = [
  [1, 5 / 4, 3 / 2],      // I, 4:5:6
  [4 / 3, 5 / 3, 2],      // IV
  [3 / 2, 15 / 8, 9 / 4], // V
  [5 / 3, 2, 5 / 2],      // vi, 10:12:15
  [5 / 4, 3 / 2, 15 / 8], // iii
  [1, 3 / 2, 9 / 4],      // open fifths, 4:6:9
  [1, 4 / 3, 3 / 2],      // sus4, 6:8:9
];

const KEY_MOVES = [3 / 2, 4 / 3, 5 / 4, 4 / 5, 2 / 3, 3 / 4];
const CENTRE = 185;

const PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];

const dist = (a, b) => Math.abs(Math.log2(a / b));

// The octave of freq nearest to `near`, inside [lo, hi].
export function place(freq, near, lo = F_MIN, hi = F_MAX) {
  let best = freq;
  let bestD = Infinity;
  for (let k = -4; k <= 4; k++) {
    const f = freq * 2 ** k;
    if (f < lo || f > hi) continue;
    if (dist(f, near) < bestD) {
      best = f;
      bestD = dist(f, near);
    }
  }
  return best;
}

// Give each voice a chord tone so the total movement is smallest; the centre pull stops voices creeping to the edges.
export function voiceLead(current, chord) {
  let best;
  let bestCost = Infinity;
  for (const perm of PERMS) {
    const targets = current.map((c, i) => place(chord[perm[i]], c));
    const cost = targets.reduce((sum, t, i) => sum + dist(t, current[i]) + 0.3 * dist(t, CENTRE), 0);
    if (cost < bestCost) {
      best = targets;
      bestCost = cost;
    }
  }
  return best;
}

export function moveKey(key) {
  let k = key * pick(KEY_MOVES);
  while (k > 220) k /= 2;
  while (k < 130) k *= 2;
  return k;
}
