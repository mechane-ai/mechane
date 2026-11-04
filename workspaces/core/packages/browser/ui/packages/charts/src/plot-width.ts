import { useEffect, useState } from 'react';

const INITIAL_WIDTH_PX = 640;

export function usePlotWidth() {
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

  return { ref, width, element };
}
