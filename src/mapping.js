// Every sound to sight rule lives here.
import { clamp } from './util.js';

export const F_MIN = 110;
export const F_MAX = 440;
const F_REF = 165;

// 0 at F_MIN, 1 at F_MAX, even in pitch rather than Hz.
export const height = (freq) => clamp(Math.log2(freq / F_MIN) / Math.log2(F_MAX / F_MIN), 0, 1);

// Low is warm amber, high is cool teal, going via pink, violet and blue so the middle never turns olive (oklch hue degrees).
export const hue = (freq) => (50 - height(freq) * 220 + 360) % 360;

// Proportional to wavelength, so a 3:2 fifth draws circles sized 2:3.
export const radius = (freq, amp, unit) => unit * 0.16 * (F_REF / freq) * (0.5 + 0.5 * amp);

export const lightness = (amp) => 0.45 + 0.3 * amp;
export const CHROMA = 0.2;

// Opacity follows a square-root curve, closer to how loudness is heard than a straight line.
export const presence = (amp) => Math.sqrt(amp);

// Harmonic n puts n ripples around the edge, as deep as its gain.
export const rippleDepth = (gain) => gain * 0.32;
export const spikeDepth = (gain) => gain * 0.18;

// An overlap's new note shows as a lens, as opaque as it is loud.
export const lensAlpha = (level) => clamp(level * 2.5, 0, 0.85);

export const pan = (ox) => clamp(ox * 1.5, -0.8, 0.8);

// Shades per colour channel in the dither: the noise bed coarsens it from barely there to fine speckle.
export const ditherLevels = (noise) => Math.max(12, 40 - 16 * noise);

// Tape wobble shows as a faint tremble along each edge.
export const trembleDepth = (wobbleCents) => 0.003 + wobbleCents * 0.0015;

export const colour = (L, C, H, a = 1) => `oklch(${L} ${C} ${H} / ${a})`;
