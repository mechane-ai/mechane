import { useSyncExternalStore } from 'react';

function listen(onChange: () => void) {
  globalThis.addEventListener('hashchange', onChange);

  return () => globalThis.removeEventListener('hashchange', onChange);
}

export function useStoryLocation() {
  return useSyncExternalStore(
    listen,
    () => globalThis.location.hash,
    () => '',
  );
}
