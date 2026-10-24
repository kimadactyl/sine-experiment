import {
  radius, hue, lightness, presence, CHROMA, rippleDepth, spikeDepth, trembleDepth, lensAlpha, colour,
} from './mapping.js';
import { TAU, rand, approach } from './util.js';

const EDGE_STEPS = 360;

// Ripple rotation, advanced by each voice's own frequency.
const spin = [];

// What was drawn last frame, for checking it against state.
export const lastFrame = [];

const shapes = [];
// Fixed per voice: tremble phases, and which way its fill sits off the outline.
const quirks = [];
// The background glow eases after the loudness-weighted centre of the circles.
const glow = { x: 0, y: 0, level: 0 };

export function draw(ctx, w, h, dpr, state, dt) {
  const unit = Math.min(w, h);
  background(ctx, w, h, unit, state, dt);
  const tremble = trembleDepth(state.wobble);

  ctx.globalCompositeOperation = 'lighter';
  state.voices.forEach((v, i) => {
    spin[i] = (spin[i] ?? 0) + dt * 0.15 * (v.freq / 165);
    if (v.amp < 0.002) {
      shapes[i] = null;
      lastFrame[i] = null;
      return;
    }
    const r = radius(v.freq, v.amp, unit);
    const H = hue(v.freq);
    const L = lightness(v.amp);
    quirks[i] ??= { phases: [rand(0, TAU), rand(0, TAU), rand(0, TAU)], offset: rand(0, TAU) };
    const shape = { cx: w / 2 + v.ox * unit, cy: h / 2 + v.oy * unit, r, v, phase: spin[i], tremble, quirk: quirks[i] };
    shapes[i] = shape;
    circle(ctx, shape, H, L, dpr);
    lastFrame[i] = { freq: v.freq, amp: v.amp, r, hue: H };
  });

  ctx.globalCompositeOperation = 'source-over';
  for (const o of state.overlaps) {
    if (o.level > 0.002 && shapes[o.a] && shapes[o.b]) lens(ctx, shapes[o.a], shapes[o.b], o);
  }
}

function background(ctx, w, h, unit, state, dt) {
  // Amplitude-weighted circular mean of the hues that are sounding, and where they are.
  let x = 0;
  let y = 0;
  let px = 0;
  let py = 0;
  let total = 0;
  for (const v of state.voices) {
    const a = (hue(v.freq) * Math.PI) / 180;
    x += Math.cos(a) * v.amp;
    y += Math.sin(a) * v.amp;
    px += v.ox * v.amp;
    py += v.oy * v.amp;
    total += v.amp;
  }
  const H = total > 0 ? ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360 : 0;
  if (total > 0.01) {
    glow.x = approach(glow.x, px / total, dt, 6);
    glow.y = approach(glow.y, py / total, dt, 6);
  }
  glow.level = approach(glow.level, Math.min(1, total), dt, 2);
  const s = glow.level;
  const gx = w / 2 + glow.x * unit * 0.8;
  const gy = h / 2 + glow.y * unit * 0.8;
  const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, (Math.hypot(w, h) / 2) * (0.75 + 0.35 * s));
  g.addColorStop(0, colour(0.16 + 0.08 * s, 0.06 * s, H));
  g.addColorStop(1, colour(0.1, 0.018 * s, H));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function edge(ctx, { cx, cy, r, v, phase, tremble, quirk }) {
  const [q0, q1, q2] = quirk.phases;
  ctx.beginPath();
  for (let s = 0; s <= EDGE_STEPS; s++) {
    const theta = (s / EDGE_STEPS) * TAU;
    // A swell laps the edge faster than the tips turn, so each tip rises and falls as it passes.
    const swell = 0.35 + 0.65 * ((1 + Math.cos(theta - phase * 3)) / 2) ** 3;
    let rr = 1 + tremble * (0.5 * Math.sin(7 * theta + q0 + phase * 1.3) + 0.3 * Math.sin(11 * theta + q1 - phase * 0.9) + 0.2 * Math.sin(17 * theta + q2 + phase * 0.7));
    for (let k = 1; k < v.partials.length; k++) {
      const n = k + 1;
      rr += rippleDepth(v.partials[k]) * Math.sin(n * theta + phase * n * (1 + 0.15 * k));
      // Spike harmonics share one phase, so they pile up into `points` sharp tips.
      rr += swell * spikeDepth(v.spikes[k]) * Math.cos(n * v.points * (theta - phase * 0.8));
    }
    const px = cx + Math.cos(theta) * r * rr;
    const py = cy + Math.sin(theta) * r * rr;
    if (s === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function circle(ctx, shape, H, L, dpr) {
  const { cx, cy, r, v } = shape;
  const halo = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 2.4);
  const P = presence(v.amp);
  halo.addColorStop(0, colour(L, CHROMA, H, 0.2 * P));
  halo.addColorStop(1, colour(L, CHROMA, H, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(cx - r * 2.4, cy - r * 2.4, r * 4.8, r * 4.8);

  // The fill sits a hair off the outline, like two print layers slightly out of register.
  ctx.save();
  ctx.translate(Math.cos(shape.quirk.offset) * 1.5 * dpr, Math.sin(shape.quirk.offset) * 1.5 * dpr);
  edge(ctx, shape);
  const body = ctx.createRadialGradient(cx, cy - r * 0.2, 0, cx, cy, r * 1.2);
  body.addColorStop(0, colour(L + 0.12, CHROMA * 0.7, H, 0.75 * P));
  body.addColorStop(1, colour(L, CHROMA, H, 0.3 * P));
  ctx.fillStyle = body;
  ctx.fill();
  ctx.restore();

  edge(ctx, shape);
  ctx.strokeStyle = colour(L + 0.15, CHROMA, H, 0.7 * P);
  ctx.lineWidth = 1.2 * dpr;
  ctx.stroke();
}

// Fill only where both circles are, in the colour of the pair's own note.
function lens(ctx, a, b, o) {
  const d = Math.hypot(b.cx - a.cx, b.cy - a.cy) || 1;
  const near = Math.max(0, d - b.r);
  const far = Math.min(d + b.r, a.r);
  const along = (near + far) / 2 / d;
  const x = a.cx + (b.cx - a.cx) * along;
  const y = a.cy + (b.cy - a.cy) * along;
  const H = hue(o.freq);
  const L = lightness(o.level) + 0.1;
  const alpha = lensAlpha(o.level);
  const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(far - near, 1));
  g.addColorStop(0, colour(L + 0.1, CHROMA, H, alpha));
  g.addColorStop(1, colour(L, CHROMA, H, alpha * 0.45));

  ctx.save();
  edge(ctx, a);
  ctx.clip();
  edge(ctx, b);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}
