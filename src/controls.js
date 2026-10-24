export function attachControls(state, conductor, togglePause) {
  const panel = document.getElementById('panel');
  const status = document.getElementById('stage');

  for (const input of panel.querySelectorAll('input[type=range]')) {
    input.value = state[input.name];
    input.addEventListener('input', () => {
      state[input.name] = Number(input.value);
    });
  }

  const toggle = () => {
    panel.hidden = !panel.hidden;
  };
  document.getElementById('toggle').addEventListener('click', toggle);
  document.getElementById('next').addEventListener('click', () => conductor.addVoice());

  const pause = document.getElementById('pause');
  const doPause = () => {
    const paused = togglePause();
    pause.textContent = paused ? 'play' : 'pause';
  };
  pause.addEventListener('click', (e) => {
    doPause();
    e.currentTarget.blur();
  });

  addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === 'h') toggle();
    if (e.key === 'ArrowRight') conductor.addVoice();
    if (e.key === ' ') {
      e.preventDefault();
      doPause();
    }
  });

  return function showStatus() {
    if (status.textContent !== state.status) status.textContent = state.status;
  };
}
