// Keeps the screen on while the piece plays. The browser drops the lock whenever the tab is hidden, so take it back on return.
let lock = null;
let wanted = false;

async function acquire() {
  if (!wanted || lock || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    const next = await navigator.wakeLock.request('screen');
    if (!wanted) {
      next.release();
      return;
    }
    lock = next;
    lock.addEventListener('release', () => {
      lock = null;
    });
  } catch {
    lock = null;
  }
}

export function keepAwake(on) {
  wanted = on;
  if (on) {
    acquire();
  } else if (lock) {
    lock.release();
    lock = null;
  }
}

export const isAwake = () => lock !== null;

document.addEventListener('visibilitychange', acquire);
