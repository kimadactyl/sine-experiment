// The single source of truth: audio.js plays these numbers and draw.js draws them.

export const PARTIALS = 5;
export const VOICES = 6;

function voice() {
  return {
    freq: 165,
    amp: 0,
    partials: [1, 0, 0, 0, 0],
    ox: 0,
    oy: 0,
    held: false,
    dragFreq: 165,
    userGain: 1,
  };
}

export const state = {
  voices: Array.from({ length: VOICES }, voice),
  // Half the visible width and height, in units of the shorter side.
  view: { hx: 0.5, hy: 0.5 },
  master: 0.5,
  driftSpeed: 1,
  harmonics: 1,
  haze: 1,
  noise: 0,
  reverb: 0,
  status: '',
};
