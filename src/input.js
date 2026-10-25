import { radius, F_MIN, F_MAX } from './mapping.js';
import { clamp } from './util.js';

const GAIN_MIN = 0.2;
const GAIN_MAX = 1.6;

export function attachInput(canvas, state) {
  const pointers = new Map();
  let target = null;
  let startY = 0;
  let startLog = 0;
  let pinchStart = 0;
  let gainStart = 1;

  // Works in CSS pixels; radius() scales linearly so this matches what's drawn.
  function hit(x, y) {
    const box = canvas.getBoundingClientRect();
    const unit = Math.min(box.width, box.height);
    let best = null;
    let bestR = Infinity;
    for (const v of state.voices) {
      if (v.amp < 0.05) continue;
      const r = radius(v.freq, v.amp, unit);
      const d = Math.hypot(x - (box.left + box.width / 2 + v.ox * unit), y - (box.top + box.height / 2 + v.oy * unit));
      if (d < r * 1.1 && r < bestR) {
        best = v;
        bestR = r;
      }
    }
    return best;
  }

  const spread = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  canvas.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      target = hit(e.clientX, e.clientY);
      if (!target) return;
      target.held = true;
      target.dragFreq = target.freq;
      startY = e.clientY;
      startLog = Math.log2(target.freq);
      canvas.setPointerCapture(e.pointerId);
    } else if (pointers.size === 2 && target) {
      pinchStart = spread();
      gainStart = target.userGain;
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!target) {
      canvas.style.cursor = hit(e.clientX, e.clientY) ? 'grab' : '';
      return;
    }
    if (pointers.size === 1) {
      // One octave per half screen height, upwards is higher.
      const octaves = (startY - e.clientY) / (canvas.getBoundingClientRect().height / 2);
      target.dragFreq = clamp(2 ** (startLog + octaves), F_MIN, F_MAX);
    } else if (pointers.size === 2 && pinchStart > 0) {
      target.userGain = clamp((gainStart * spread()) / pinchStart, GAIN_MIN, GAIN_MAX);
    }
  });

  const release = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = 0;
    if (pointers.size === 0 && target) {
      target.held = false;
      target = null;
    }
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  canvas.addEventListener('wheel', (e) => {
    const v = hit(e.clientX, e.clientY);
    if (!v) return;
    e.preventDefault();
    v.userGain = clamp(v.userGain * Math.exp(-e.deltaY * 0.002), GAIN_MIN, GAIN_MAX);
  }, { passive: false });
}
