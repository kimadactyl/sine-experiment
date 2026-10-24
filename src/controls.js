export function attachControls(state, conductor) {
  const panel = document.getElementById('panel');
  const stage = document.getElementById('stage');

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
  document.getElementById('next').addEventListener('click', () => conductor.skip());

  addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === 'h') toggle();
    if (e.key === 'ArrowRight') conductor.skip();
  });

  return function showStage() {
    if (stage.textContent !== state.stage) stage.textContent = state.stage;
  };
}
