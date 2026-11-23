import { useEffect, useState } from 'react';

const INITIAL_WIDTH_PX = 640;

/** The width a plot's container gives it, measured as it resizes. Attach `ref` to the element that sets the width. */
export function usePlotWidth(): { readonly ref: (element: HTMLDivElement | null) => void; readonly width: number } {
  const [element, ref] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(INITIAL_WIDTH_PX);

  useEffect(() => {
    if (element === null) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined && entry.contentRect.width > 0) {
        setWidth(entry.contentRect.width);
      }
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, [element]);

  return { ref, width };
}
