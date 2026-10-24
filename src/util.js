export const TAU = Math.PI * 2;

export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export const rand = (lo, hi) => lo + Math.random() * (hi - lo);
export const pick = (list) => list[Math.floor(Math.random() * list.length)];
export const smoothstep = (x) => x * x * (3 - 2 * x);

// Frame-rate independent exponential ease towards a target.
export const approach = (x, target, dt, tau) => x + (target - x) * (1 - Math.exp(-dt / tau));
