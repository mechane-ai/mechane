import { useLayoutEffect, useRef } from 'react';

/** Rejects late completions after this screen leaves, before passive cleanup runs. */
export function useScreenLifetime(): () => boolean {
  const active = useRef(false);

  useLayoutEffect(() => {
    active.current = true;

    return () => {
      active.current = false;
    };
  }, []);

  return () => active.current;
}
