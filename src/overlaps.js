import { radius } from './mapping.js';
import { clamp } from './util.js';

// Area shared by two circles, as a fraction of the smaller one.
function lensFraction(r1, r2, d) {
  if (d >= r1 + r2) return 0;
  const small = Math.min(r1, r2);
  if (d <= Math.abs(r1 - r2)) return 1;
  const a1 = Math.acos(clamp((d * d + r1 * r1 - r2 * r2) / (2 * d * r1), -1, 1));
  const a2 = Math.acos(clamp((d * d + r2 * r2 - r1 * r1) / (2 * d * r2), -1, 1));
  const tri = Math.sqrt(Math.max(0, (-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2)));
  const area = r1 * r1 * a1 + r2 * r2 * a2 - tri / 2;
  return clamp(area / (Math.PI * small * small), 0, 1);
}

// Each overlapping pair sounds its sum tone an octave down, so it sits among the circles' own pitches.
export function updateOverlaps(state) {
  for (const o of state.overlaps) {
    const a = state.voices[o.a];
    const b = state.voices[o.b];
    o.freq = (a.freq + b.freq) / 2;
    o.ox = (a.ox + b.ox) / 2;
    const r1 = radius(a.freq, a.amp, 1);
    const r2 = radius(b.freq, b.amp, 1);
    const d = Math.hypot(a.ox - b.ox, a.oy - b.oy);
    o.level = Math.sqrt(lensFraction(r1, r2, d)) * Math.min(a.amp, b.amp);
  }
}
