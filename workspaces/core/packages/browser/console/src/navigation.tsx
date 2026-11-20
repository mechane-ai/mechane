import { TextLink } from '@mechane-ai/elements';
import { createLink, useElementScrollRestoration } from '@tanstack/react-router';
import { useMemo } from 'react';
import type { ReaderPosition } from './types.ts';

export const RouteLink = createLink(TextLink);

/** Reads the router's history position with an identity that cannot carry another owner's offset. */
export function useReaderPosition(scope: string, resource: string) {
  const id = `reader:${encodeURIComponent(scope)}:${encodeURIComponent(resource)}`;
  const entry = useElementScrollRestoration({ id });

  const position = useMemo(
    () => (entry === undefined ? undefined : { region: id, top: entry.scrollY, left: entry.scrollX }),
    [entry, id],
  );

  return { id, position };
}

export function readReaderPositions(): ReadonlyArray<ReaderPosition> {
  return [...document.querySelectorAll<HTMLElement>('[data-scroll-restoration-id]')]
    .filter((element) => element.checkVisibility({ visibilityProperty: true }))
    .map((element) => ({
      region: element.dataset['scrollRestorationId'] ?? '',
      top: element.scrollTop,
      left: element.scrollLeft,
    }));
}

export function restoreReaderPositions(positions: ReadonlyArray<ReaderPosition>): void {
  for (const position of positions) {
    const element = document.querySelector<HTMLElement>(
      `[data-scroll-restoration-id="${CSS.escape(position.region)}"]`,
    );

    if (element?.checkVisibility({ visibilityProperty: true }) === true) {
      element.scrollTo({ top: position.top, left: position.left, behavior: 'instant' });
    }
  }
}
