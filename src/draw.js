import { radius, hue, lightness, CHROMA, rippleDepth, grainAlpha, lensAlpha, colour } from './mapping.js';
import { TAU } from './util.js';

const EDGE_STEPS = 360;

// Ripple rotation, advanced by each voice's own frequency.
const spin = [];

// What was drawn last frame, for checking it against state.
export const lastFrame = [];

let grain;
const shapes = [];

export function draw(ctx, w, h, dpr, state, dt) {
  const unit = Math.min(w, h);
  background(ctx, w, h, state);

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
    const shape = { cx: w / 2 + v.ox * unit, cy: h / 2 + v.oy * unit, r, v, phase: spin[i] };
    shapes[i] = shape;
    circle(ctx, shape, H, L, dpr);
    lastFrame[i] = { freq: v.freq, amp: v.amp, r, hue: H };
  });

  ctx.globalCompositeOperation = 'source-over';
  for (const o of state.overlaps) {
    if (o.level > 0.002 && shapes[o.a] && shapes[o.b]) lens(ctx, shapes[o.a], shapes[o.b], o);
  }
  drawGrain(ctx, w, h, state.noise);
}

function background(ctx, w, h, state) {
  // Amplitude-weighted circular mean of the hues that are sounding.
  let x = 0;
  let y = 0;
  let total = 0;
  for (const v of state.voices) {
    const a = (hue(v.freq) * Math.PI) / 180;
    x += Math.cos(a) * v.amp;
    y += Math.sin(a) * v.amp;
    total += v.amp;
  }
  const H = total > 0 ? ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360 : 0;
  const s = Math.min(1, total);
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.hypot(w, h) / 2);
  g.addColorStop(0, colour(0.17 + 0.05 * s, 0.035 * s, H));
  g.addColorStop(1, colour(0.1, 0.012 * s, H));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function edge(ctx, { cx, cy, r, v, phase }) {
  ctx.beginPath();
  for (let s = 0; s <= EDGE_STEPS; s++) {
    const theta = (s / EDGE_STEPS) * TAU;
    let rr = 1;
    for (let k = 1; k < v.partials.length; k++) {
      const n = k + 1;
      rr += rippleDepth(v.partials[k]) * Math.sin(n * theta + phase * n * (1 + 0.15 * k));
      // Spike harmonics share one phase, so they pile up into `points` sharp tips.
      rr += rippleDepth(v.spikes[k]) * Math.cos(n * v.points * (theta - phase * 0.3));
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
  halo.addColorStop(0, colour(L, CHROMA, H, 0.16 * v.amp));
  halo.addColorStop(1, colour(L, CHROMA, H, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(cx - r * 2.4, cy - r * 2.4, r * 4.8, r * 4.8);

  edge(ctx, shape);

  const body = ctx.createRadialGradient(cx, cy - r * 0.2, 0, cx, cy, r * 1.2);
  body.addColorStop(0, colour(L + 0.12, CHROMA * 0.7, H, 0.7 * v.amp));
  body.addColorStop(1, colour(L, CHROMA, H, 0.25 * v.amp));
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = colour(L + 0.15, CHROMA, H, 0.6 * v.amp);
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

function drawGrain(ctx, w, h, noise) {
  const alpha = grainAlpha(noise);
  if (alpha < 0.002) return;
  if (!grain) grain = makeGrain(ctx);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(-Math.random() * 256, -Math.random() * 256);
  ctx.fillStyle = grain;
  ctx.fillRect(0, 0, w + 256, h + 256);
  ctx.restore();
}

function makeGrain(ctx) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const img = g.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = n;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return ctx.createPattern(c, 'repeat');
}
