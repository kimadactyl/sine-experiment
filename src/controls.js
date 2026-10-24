export function attachControls(state, conductor) {
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

  addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === 'h') toggle();
    if (e.key === 'ArrowRight') conductor.addVoice();
  });

  return function showStatus() {
    if (status.textContent !== state.status) status.textContent = state.status;
  };
}
