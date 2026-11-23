import { createVirtualizer } from '@ui-sdk/core';
import type { VirtualItem } from '@ui-sdk/core';
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { RefObject } from 'react';

type TableWindowOptions = {
  readonly isEnabled: boolean;
  readonly viewport: RefObject<HTMLElement | null>;
  readonly count: number;
  readonly keyOf: (index: number) => string;
  /** A row's height before it is measured. A fixed row keeps it. */
  readonly estimate: number;
  /** The height of the caption and header above the first row. */
  readonly margin: number;
  /** Rows to render wherever the viewport is, such as the one with focus. */
  readonly keep: () => ReadonlyArray<number>;
  readonly onEnd: (() => void) | undefined;
};

type MeasureRef = (element: HTMLElement | null) => () => void;

const noItems: ReadonlyArray<VirtualItem> = [];

/** Renders only the rows in view, on the UI SDK virtualizer. Each item's `start` is measured from the first row. */
export function useTableWindow(options: TableWindowOptions) {
  const latest = useRef(options);

  const [{ rows, subscribe, readItems, scrollToIndex }] = useState(() => {
    const virtualizer = createVirtualizer({
      count: () => latest.current.count,
      estimate: () => latest.current.estimate,
      key: (index) => latest.current.keyOf(index),
      overscan: 6,
      keep: () => latest.current.keep(),
      onEnd: () => latest.current.onEnd?.(),
      endThreshold: 0,
      get scrollMargin() {
        return latest.current.margin;
      },
    });

    return {
      rows: virtualizer,
      subscribe: (listener: () => void) => virtualizer.subscribe(listener),
      readItems: (): ReadonlyArray<VirtualItem> => virtualizer.items(),
      scrollToIndex: (index: number) => virtualizer.scrollToIndex(index),
    };
  });

  const [measureRefs] = useState(() => new Map<number, MeasureRef>());
  const { isEnabled, viewport } = options;

  useLayoutEffect(() => {
    latest.current = options;

    rows.refresh();
  });

  useLayoutEffect(() => {
    const element = viewport.current;

    if (!isEnabled || element === null) {
      return;
    }

    return rows.connect(element);
  }, [isEnabled, rows, viewport]);

  const items = useSyncExternalStore(subscribe, readItems, () => noItems);

  return {
    items,
    size: rows.size(),
    scrollToIndex,
    /** A stable ref for a content-sized row, so its height is measured now and whenever it changes. */
    measure(index: number): MeasureRef {
      const known = measureRefs.get(index);

      if (known !== undefined) {
        return known;
      }

      const ref: MeasureRef = (element) => rows.measure(index, element);

      measureRefs.set(index, ref);

      return ref;
    },
  };
}
