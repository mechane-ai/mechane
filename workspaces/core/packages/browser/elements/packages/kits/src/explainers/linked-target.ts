import type { FocusEvent, MouseEvent, PointerEvent } from 'react';
import { useChartLinkControl } from '../../../charts/src/index.ts';

/** The events a piece of prose or a diagram part listens to so it can point the linked figures at its record. */
export type LinkedTargetHandlers = {
  readonly onPointerEnter: (event: PointerEvent) => void;
  readonly onPointerLeave: (event: PointerEvent) => void;
  readonly onFocus: (event: FocusEvent) => void;
  readonly onBlur: (event: FocusEvent) => void;
  readonly onClick: (event: MouseEvent) => void;
};

/** A record outside the charts that points into them: whether the link inspects it now, and the events that set it. */
export type LinkedTarget = {
  readonly isInspected: boolean;
  readonly handlers: LinkedTargetHandlers;
  /** Points the link at this record from a press that is not a click, such as Enter on a diagram part. */
  readonly press: (event: Event) => void;
};

/**
 * Points the enclosing chart link at `id` while a mouse rests on the element or keyboard focus is in it, and on a
 * press, so touch readers get it too. Leaving clears the link only while it still holds this id, so moving from one
 * term straight to another never clears the second.
 */
export function useLinkedTarget(id: string): LinkedTarget {
  const control = useChartLinkControl();
  const isInspected = control?.inspected === id;

  function release(event: Event, reason: 'item-hover' | 'focus-out'): void {
    if (control?.inspected === id) {
      control.inspect(null, { reason, event });
    }
  }

  function press(event: Event): void {
    control?.inspect(id, { reason: 'item-press', event });
  }

  return {
    isInspected,
    handlers: {
      onPointerEnter: (event) => {
        if (event.pointerType === 'mouse') {
          control?.inspect(id, { reason: 'item-hover', event: event.nativeEvent });
        }
      },
      onPointerLeave: (event) => {
        if (event.pointerType === 'mouse') {
          release(event.nativeEvent, 'item-hover');
        }
      },
      onFocus: (event) => control?.inspect(id, { reason: 'focus-in', event: event.nativeEvent }),
      onBlur: (event) => release(event.nativeEvent, 'focus-out'),
      onClick: (event) => press(event.nativeEvent),
    },
    press,
  };
}
