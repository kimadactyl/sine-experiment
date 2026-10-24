import { state } from './state.js';
import { startAudio, updateAudio, setPaused, rms } from './audio.js';
import { draw, lastFrame } from './draw.js';
import { createConductor } from './conductor.js';
import { attachInput } from './input.js';
import { attachControls } from './controls.js';
import { updateOverlaps } from './overlaps.js';
import { createDither } from './dither.js';
import { ditherLevels } from './mapping.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const begin = document.getElementById('begin');
const dither = createDither(canvas, document.getElementById('dither'));

let w = 0;
let h = 0;
let dpr = 1;
function resize() {
  dpr = Math.min(2, devicePixelRatio || 1);
  w = canvas.width = Math.round(innerWidth * dpr);
  h = canvas.height = Math.round(innerHeight * dpr);
  const unit = Math.min(innerWidth, innerHeight);
  state.view.hx = innerWidth / 2 / unit;
  state.view.hy = innerHeight / 2 / unit;
}
addEventListener('resize', resize);
resize();

let running = false;
let paused = false;
function togglePause() {
  if (!running) return paused;
  paused = !paused;
  setPaused(paused);
  return paused;
}

const conductor = createConductor();
const showStatus = attachControls(state, conductor, togglePause);
attachInput(canvas, state);

begin.addEventListener('click', () => {
  startAudio(state);
  conductor.start();
  running = true;
  begin.classList.add('gone');
}, { once: true });

let last = performance.now();
function frame(now) {
  // Capped so a backgrounded tab doesn't jump the piece forward on return.
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const live = running && !paused;
  if (live) {
    conductor.update(dt);
    updateOverlaps(state);
    updateAudio(state);
  }
  draw(ctx, w, h, dpr, state, live ? dt : 0);
  dither(ditherLevels(state.noise), dpr);
  showStatus();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.sine = { state, conductor, rms, lastFrame };
