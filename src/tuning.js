import { F_MIN, F_MAX } from './mapping.js';
import { pick } from './util.js';

// Just-intonation chords as ratios of the key, and how the key may move, for each mood.
// A chord listed twice is chosen twice as often; the signature is played first when the mood is chosen.
export const MOODS = {
  mixed: {
    chords: [
      [1, 5 / 4, 3 / 2],      // I, 4:5:6
      [4 / 3, 5 / 3, 2],      // IV
      [3 / 2, 15 / 8, 9 / 4], // V
      [5 / 3, 2, 5 / 2],      // vi, 10:12:15
      [5 / 4, 3 / 2, 15 / 8], // iii
      [1, 3 / 2, 9 / 4],      // open fifths, 4:6:9
      [1, 4 / 3, 3 / 2],      // sus4, 6:8:9
    ],
    keyMoves: [3 / 2, 4 / 3, 5 / 4, 4 / 5, 2 / 3, 3 / 4],
    signature: [1, 5 / 4, 3 / 2],
  },
  bright: {
    chords: [
      [1, 5 / 4, 3 / 2],      // I
      [1, 5 / 4, 3 / 2],      // I
      [4 / 3, 5 / 3, 2],      // IV
      [3 / 2, 15 / 8, 9 / 4], // V
      [1, 3 / 2, 9 / 4],      // open fifths
    ],
    keyMoves: [3 / 2, 4 / 3],
    signature: [1, 5 / 4, 3 / 2],
  },
  open: {
    chords: [
      [1, 3 / 2, 9 / 4],      // stacked fifths
      [1, 4 / 3, 16 / 9],     // stacked fourths
      [1, 4 / 3, 3 / 2],      // sus4
      [1, 9 / 8, 3 / 2],      // sus2
      [4 / 3, 2, 3],          // fifths on the fourth
      [3 / 2, 2, 8 / 3],      // fourths on the fifth
    ],
    keyMoves: [3 / 2, 4 / 3, 2 / 3, 3 / 4],
    signature: [1, 4 / 3, 16 / 9],
  },
  floating: {
    chords: [
      [1, 5 / 4, 3 / 2],         // I
      [9 / 8, 45 / 32, 27 / 16], // II major, carrying the raised fourth
      [1, 5 / 4, 15 / 8],        // I with the major seventh
      [3 / 2, 15 / 8, 9 / 4],    // V
      [5 / 4, 3 / 2, 15 / 8],    // iii
    ],
    keyMoves: [3 / 2, 9 / 8],
    signature: [9 / 8, 45 / 32, 27 / 16],
  },
  dusk: {
    chords: [
      [1, 6 / 5, 3 / 2],      // i, 10:12:15
      [1, 6 / 5, 3 / 2],      // i
      [4 / 3, 8 / 5, 2],      // iv
      [3 / 2, 9 / 5, 9 / 4],  // v
      [8 / 5, 2, 12 / 5],     // VI
    ],
    keyMoves: [4 / 3, 3 / 4, 6 / 5, 5 / 6],
    signature: [1, 6 / 5, 3 / 2],
  },
};

const CENTRE = 185;

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

// The chord tone nearest to freq; the centre pull stops voices creeping to the edges.
export function nearestTone(freq, chord) {
  let best = freq;
  let bestCost = Infinity;
  for (const c of chord) {
    const f = place(c, freq);
    const cost = dist(f, freq) + 0.3 * dist(f, CENTRE);
    if (cost < bestCost) {
      best = f;
      bestCost = cost;
    }
  }
  return best;
}

// Move every voice to a nearby chord tone, sounding each note of the chord before doubling any in another octave.
export function leadAll(current, chord) {
  const taken = [];
  return current.map((freq) => {
    let best = freq;
    let bestCost = Infinity;
    for (const c of chord) {
      for (let k = -4; k <= 4; k++) {
        const f = c * 2 ** k;
        if (f < F_MIN || f > F_MAX) continue;
        const clash = taken.some((g) => dist(f, g) < 0.01) ? 1 : 0;
        const doubled = taken.some((g) => Math.abs(Math.log2(f / g) - Math.round(Math.log2(f / g))) < 0.01) ? 0.5 : 0;
        const cost = dist(f, freq) + 0.15 * dist(f, CENTRE) + clash + doubled;
        if (cost < bestCost) {
          best = f;
          bestCost = cost;
        }
      }
    }
    taken.push(best);
    return best;
  });
}

// A chord tone for a new voice: the least doubled one, in a random octave.
export function freshTone(chord, sounding) {
  const uses = (c) => sounding.filter((f) => {
    const octaves = Math.log2(f / c);
    return Math.abs(octaves - Math.round(octaves)) < 0.01;
  }).length;
  const fewest = Math.min(...chord.map(uses));
  const c = pick(chord.filter((x) => uses(x) === fewest));
  const options = [];
  for (let k = -4; k <= 4; k++) {
    const f = c * 2 ** k;
    if (f >= F_MIN && f <= F_MAX) options.push(f);
  }
  const free = options.filter((f) => !sounding.some((g) => dist(f, g) < 0.01));
  return pick(free.length ? free : options);
}

export function moveKey(key, moves) {
  let k = key * pick(moves);
  while (k > 220) k /= 2;
  while (k < 130) k *= 2;
  return k;
}
