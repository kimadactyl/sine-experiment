// Every sound to sight rule lives here.
import { clamp } from './util.js';

export const F_MIN = 110;
export const F_MAX = 440;
const F_REF = 165;

// 0 at F_MIN, 1 at F_MAX, even in pitch rather than Hz.
export const height = (freq) => clamp(Math.log2(freq / F_MIN) / Math.log2(F_MAX / F_MIN), 0, 1);

// Low is warm amber, high is cool blue, going via pink and violet so the middle never turns olive (oklch hue degrees).
export const hue = (freq) => (50 - height(freq) * 160 + 360) % 360;

// Proportional to wavelength, so a 3:2 fifth draws circles sized 2:3.
export const radius = (freq, amp, unit) => unit * 0.16 * (F_REF / freq) * (0.5 + 0.5 * amp);

export const lightness = (amp) => 0.45 + 0.3 * amp;
export const CHROMA = 0.15;

// Harmonic n puts n ripples around the edge, as deep as its gain.
export const rippleDepth = (gain) => gain * 0.18;

export const pan = (ox) => clamp(ox * 1.5, -0.8, 0.8);

export const grainAlpha = (noise) => noise * 0.07;

export const colour = (L, C, H, a = 1) => `oklch(${L} ${C} ${H} / ${a})`;
