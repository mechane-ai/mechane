import { useEffect } from 'react';
import type { RefObject } from 'react';

type EndReachedOptions = {
  readonly end: RefObject<HTMLElement | null>;
  readonly viewport?: RefObject<HTMLElement | null> | undefined;
  readonly onEndReached?: (() => void) | undefined;
  readonly content: unknown;
};

export function useEndReached({ end, viewport, onEndReached, content }: EndReachedOptions): void {
  useEffect(() => {
    if (onEndReached === undefined || end.current === null) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onEndReached();
        }
      },
      { root: viewport?.current ?? null },
    );

    observer.observe(end.current);

    return () => observer.disconnect();
  }, [end, viewport, onEndReached, content]);
}
