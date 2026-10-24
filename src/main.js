import { state } from './state.js';
import { startAudio, updateAudio, setPaused, rms } from './audio.js';
import { draw, lastFrame } from './draw.js';
import { createConductor } from './conductor.js';
import { attachInput } from './input.js';
import { attachControls } from './controls.js';
import { updateOverlaps } from './overlaps.js';
import { createDither } from './dither.js';
import { keepAwake, isAwake } from './wakelock.js';
import { ditherLevels } from './mapping.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const begin = document.getElementById('begin');
const ditherCanvas = document.getElementById('dither');
const dither = createDither(canvas, ditherCanvas);

let w = 0;
let h = 0;
let dpr = 1;
let frozen = null;
function resize() {
  // Setting the canvas size wipes it, so a paused picture has to be drawn again.
  frozen = null;
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
  keepAwake(!paused);
  return paused;
}

const conductor = createConductor();
const showStatus = attachControls(state, conductor, togglePause);
attachInput(canvas, state);

begin.addEventListener('click', () => {
  startAudio(state);
  conductor.start();
  running = true;
  keepAwake(true);
  begin.classList.add('gone');
}, { once: true });

// Everything moves slowly, so 60 frames a second looks the same as a 120 Hz screen's full rate at half the work.
const FRAME_MS = 1000 / 60;
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  if (now - last < FRAME_MS - 2) return;
  // Capped so a backgrounded tab doesn't jump the piece forward on return.
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const live = running && !paused;
  if (live) {
    conductor.update(dt);
    updateOverlaps(state);
    updateAudio(state);
  }
  // A paused picture is frozen, so draw it once and redraw only if the canvas or graphics mode changes.
  const look = `${w}x${h}:${state.lowGraphics}`;
  if (running && paused && frozen === look) return;
  frozen = running && paused ? look : null;
  draw(ctx, w, h, dpr, state, live ? dt : 0);
  const useDither = dither && !state.lowGraphics;
  ditherCanvas.hidden = !useDither;
  if (useDither) dither(ditherLevels(state.noise), dpr);
  showStatus();
}
requestAnimationFrame(frame);

window.sine = { state, conductor, rms, lastFrame, isAwake };
