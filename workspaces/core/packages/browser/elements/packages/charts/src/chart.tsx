import {
  announce,
  bindLayer,
  createChange,
  definePrimitive,
  dispatch,
  isFocusFromKeyboard,
  isRTL,
  nearestInDirection,
  selects,
} from '@ui-sdk/core';
import type { ChangeDetails, SpatialRect } from '@ui-sdk/core';
import { stepFromKey } from '@ui-sdk/core/number';
import { createParts } from '@ui-sdk/react/primitive';
import type { PartProps } from '@ui-sdk/react/primitive';
import type { ComponentType } from 'react';

export type ChartItem = { readonly id: string; readonly label: string };

export type ChartInspectReason =
  | 'item-hover'
  | 'item-press'
  | 'list-navigation'
  | 'focus-in'
  | 'focus-out'
  | 'escape-key'
  | 'outside-press'
  | 'window-blur'
  | 'imperative';

export type ChartInspectDetails = ChangeDetails<ChartInspectReason>;
export type ChartSelectDetails = ChangeDetails<'item-press'>;

/** A pointer position inside the plot, in CSS pixels from its top left corner, with the plot's rendered size. */
export type ChartPoint = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

export type ChartOptions = {
  /** The marks a reader can inspect, in the order the arrow keys step through them. */
  readonly items: ReadonlyArray<ChartItem>;
  /** One item's exact values as a sentence, for the spoken readout and for agents. Defaults to the item's label. */
  readonly readout?: ((id: string) => string | undefined) | undefined;
  /** Arranges the items row by row in a grid this wide. Up and Down change rows; Home and End stay in the row. */
  readonly columns?: number | undefined;
  /** Whether Up and Down step through a list like Left and Right. Leave it out when the page should keep them. */
  readonly arrows?: 'horizontal' | 'both' | undefined;
  /** Where an item sits, in any one unit. Arrows then move to the nearest item in their direction. */
  readonly place?: ((id: string) => SpatialRect | undefined) | undefined;
  /** The item under a pointer anywhere in the plot. Leave it out when each mark hears its own pointer. */
  readonly locate?: ((point: ChartPoint) => string | undefined) | undefined;
  /** Names the data the readouts describe. An open inspection closes when it changes. */
  readonly revision?: string | undefined;
  /** The item the application has selected, or null. Selection is the application's state. */
  readonly selected?: string | null | undefined;
  /** Asks the application to select an item. Without it, the chart only inspects. */
  readonly onSelect?: ((id: string, details: ChartSelectDetails) => void) | undefined;
  readonly inspected?: string | null | undefined;
  readonly defaultInspected?: string | null | undefined;
  readonly onInspectedChange?: ((id: string | null, details: ChartInspectDetails) => void) | undefined;
  /** Other elements a press counts as inside, such as sibling plots that share one inspection. */
  readonly within?: ((target: Node) => boolean) | undefined;
};

type ChartState = {
  readonly items: ReadonlyArray<ChartItem>;
  readonly inspected: string | null;
  readonly selected: string | null;
  readonly cursor: string | null;
};

/** What a chart draws from: the open inspection, the application's selection, and where the keyboard cursor rests. */
export type ChartView = Pick<ChartState, 'inspected' | 'selected' | 'cursor'>;

const LARGE_STEP = 10;
const MARK = '[data-slot="chart-mark"]';
const activationKeys: ReadonlySet<string> = new Set(['Enter', ' ']);
const verticalArrows: ReadonlySet<string> = new Set(['ArrowDown', 'ArrowUp']);

const arrowDirections: Readonly<Record<string, readonly [number, number] | undefined>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

function has(items: ReadonlyArray<ChartItem>, id: string | null): id is string {
  return id !== null && items.some((item) => item.id === id);
}

function view(state: ChartState): ChartView {
  const cursor = [state.cursor, state.selected].find((id) => has(state.items, id)) ?? state.items[0]?.id ?? null;

  return {
    inspected: has(state.items, state.inspected) ? state.inspected : null,
    selected: has(state.items, state.selected) ? state.selected : null,
    cursor,
  };
}

function gridIndex({
  key,
  index,
  last,
  columns,
  isReversed,
}: {
  readonly key: string;
  readonly index: number;
  readonly last: number;
  readonly columns: number;
  readonly isReversed: boolean;
}): number | undefined {
  const rowStart = index - (index % columns);
  const rowEnd = Math.min(last, rowStart + columns - 1);
  const before = Math.max(rowStart, index - 1);
  const after = Math.min(rowEnd, index + 1);

  const indices: Readonly<Record<string, number | undefined>> = {
    Home: rowStart,
    End: rowEnd,
    ArrowLeft: isReversed ? after : before,
    ArrowRight: isReversed ? before : after,
    ArrowUp: index - columns < 0 ? index : index - columns,
    ArrowDown: index + columns > last ? index : index + columns,
  };

  return indices[key];
}

function listIndex({
  event,
  index,
  last,
  arrows,
  isReversed,
}: {
  readonly event: KeyboardEvent;
  readonly index: number;
  readonly last: number;
  readonly arrows: 'horizontal' | 'both';
  readonly isReversed: boolean;
}): number | undefined {
  if (arrows === 'both' && verticalArrows.has(event.key)) {
    return Math.max(0, Math.min(last, index + (event.key === 'ArrowDown' ? 1 : -1)));
  }

  const step = stepFromKey(event, { arrows: 'horizontal', dir: isReversed ? 'rtl' : 'ltr' });

  if (step === null) {
    return undefined;
  }

  if (step.bound !== undefined) {
    return step.bound === 'min' ? 0 : last;
  }

  return Math.max(0, Math.min(last, index + step.direction * (step.size === 'large' ? LARGE_STEP : 1)));
}

const chart = definePrimitive({
  name: 'chart',
  options: {
    items: 'value',
    readout: 'value',
    columns: 'number',
    arrows: 'string',
    place: 'value',
    locate: 'value',
    revision: 'string',
    selected: 'string',
    onSelect: 'callback',
    inspected: 'string',
    defaultInspected: 'string',
    onInspectedChange: 'callback',
    within: 'value',
  },
  controlled: ['inspected', 'selected'],
  state: (options: ChartOptions): ChartState => ({
    items: options.items,
    inspected: options.inspected ?? options.defaultInspected ?? null,
    selected: options.selected ?? null,
    cursor: null,
  }),
  sync: (options) => ({
    items: options.items,
    selected: options.selected ?? null,
    ...(options.inspected === undefined ? {} : { inspected: options.inspected }),
    ...(options.inspected === undefined || options.inspected === null ? {} : { cursor: options.inspected }),
  }),
  api: (context) => {
    const { store } = context;
    const change = createChange(context);
    let isHovering = false;
    let revision = context.options().revision;

    context.onOptions((options) => {
      const { inspected } = store.get();
      const isStale = options.revision !== revision || (inspected !== null && !has(options.items, inspected));

      revision = options.revision;

      if (isStale && inspected !== null && options.inspected === undefined) {
        store.set({ inspected: null });
      }
    });

    function readout(id: string): string {
      const { items, readout: describe } = context.options();

      return describe?.(id) ?? items.find((item) => item.id === id)?.label ?? id;
    }

    function show(id: string | null, details: { reason: ChartInspectReason; event?: Event | undefined }): boolean {
      if (id !== null && !has(context.options().items, id)) {
        return false;
      }

      isHovering = false;

      if (id !== null && details.reason !== 'item-hover') {
        store.set({ cursor: id });
      }

      if (store.get().inspected === id) {
        return false;
      }

      const { reason, event } = details;
      const isShown = change('inspected', id, event === undefined ? { reason } : { reason, event });

      if (isShown && id !== null && details.reason === 'list-navigation') {
        announce(id === store.get().selected ? `${readout(id)}. Selected.` : readout(id));
      }

      return isShown;
    }

    function select(id: string, event?: Event): boolean {
      if (!has(context.options().items, id)) {
        return false;
      }

      return !dispatch(
        context,
        'onSelect',
        id,
        event === undefined ? { reason: 'item-press' } : { reason: 'item-press', event },
      );
    }

    function destination(event: KeyboardEvent, el: HTMLElement): string | undefined {
      const { items, columns, arrows = 'horizontal', place } = context.options();
      const { cursor } = view(store.get());

      const index = Math.max(
        0,
        items.findIndex((item) => item.id === cursor),
      );

      const last = items.length - 1;
      const direction = arrowDirections[event.key];

      if (place !== undefined && direction !== undefined) {
        const from = cursor === null ? undefined : place(cursor);

        if (cursor === null || from === undefined) {
          return items[index]?.id;
        }

        const candidates = items.flatMap((item) => {
          const rect = item.id === cursor ? undefined : place(item.id);

          return rect === undefined ? [] : [{ key: item.id, rect }];
        });

        return nearestInDirection(from, candidates, direction) ?? cursor;
      }

      const isReversed = isRTL(el);

      const target =
        columns === undefined || columns < 1
          ? listIndex({ event, index, last, arrows, isReversed })
          : gridIndex({ key: event.key, index, last, columns, isReversed });

      return target === undefined ? undefined : items[target]?.id;
    }

    return {
      /** Opens an item's readout and moves the keyboard cursor to it. */
      inspect: (id: string) => show(id, { reason: 'imperative' }),
      /** Closes the readout. The keyboard cursor stays where it is. */
      dismiss: (reason: ChartInspectReason = 'imperative', event?: Event) => show(null, { reason, event }),
      get select() {
        return context.options().onSelect === undefined ? undefined : select;
      },
      /** Every item with its exact values, so an agent reads the chart without stepping through it. */
      items: () => context.options().items.map((item) => ({ value: item.id, label: readout(item.id) })),
      within: (target: Node) => context.options().within?.(target) === true,
      keydown(event: KeyboardEvent, el: HTMLElement): void {
        const hasModifier = event.altKey || event.ctrlKey || event.metaKey;

        if (event.defaultPrevented || hasModifier || context.options().items.length === 0) {
          return;
        }

        if (activationKeys.has(event.key)) {
          const { cursor } = view(store.get());

          const isInnerControl =
            event.target instanceof Element && event.target.closest('button, a, input, select, textarea') !== null;

          if (!isInnerControl && cursor !== null && context.options().onSelect !== undefined) {
            event.preventDefault();
            select(cursor, event);
          }

          return;
        }

        const id = destination(event, el);

        if (id !== undefined) {
          event.preventDefault();
          show(id, { reason: 'list-navigation', event });
        }
      },
      focus(event: FocusEvent, el: HTMLElement): void {
        if (event.target === el && isFocusFromKeyboard()) {
          show(view(store.get()).cursor, { reason: 'focus-in', event });
        }
      },
      point(event: PointerEvent, el: HTMLElement, reason: 'item-hover' | 'item-press'): void {
        const box = el.getBoundingClientRect();

        const id = context
          .options()
          .locate?.({ x: event.clientX - box.left, y: event.clientY - box.top, width: box.width, height: box.height });

        if (id !== undefined) {
          show(id, { reason, event });

          isHovering = event.pointerType === 'mouse';
        } else if (reason === 'item-hover' && isHovering) {
          show(null, { reason, event });

          isHovering = false;
        }
      },
      enter(id: string, event: PointerEvent): void {
        const isMouse = event.pointerType === 'mouse';

        show(id, { reason: isMouse ? 'item-hover' : 'item-press', event });

        isHovering = isMouse;
      },
      choose(id: string, event?: Event): void {
        show(id, { reason: 'item-press', event });

        if (context.options().onSelect !== undefined) {
          select(id, event);
        }
      },
      leave(event: PointerEvent): void {
        if (isHovering) {
          show(null, { reason: 'item-hover', event });
        }
      },
      press(event?: Event): void {
        const { inspected } = view(store.get());

        if (event?.target instanceof Element && event.target.closest(MARK) !== null) {
          return;
        }

        if (context.options().locate !== undefined && inspected !== null && context.options().onSelect !== undefined) {
          select(inspected, event);
        }
      },
    };
  },
  slots: (slot) => ({
    root: slot<object, ChartView>({ state: view }),
    plot: slot<object, ChartView>({
      state: view,
      attrs: (state) => ({
        'tabindex': state.items.length > 0 ? '0' : undefined,
        'data-inspecting': view(state).inspected === null ? undefined : '',
      }),
      press: ({ api }, event) => api.press(event),
      on: {
        keydown: (event, { api, el }) => {
          if (el !== undefined) {
            api.keydown(event, el);
          }
        },
        focusin: (event, { api, el }) => {
          if (el !== undefined) {
            api.focus(event, el);
          }
        },
        focusout: (event, { api, el }) => {
          if (!(event.relatedTarget instanceof Node) || el?.contains(event.relatedTarget) !== true) {
            api.dismiss('focus-out', event);
          }
        },
        pointermove: (event, { api, el }) => {
          if (el !== undefined && event.pointerType === 'mouse') {
            api.point(event, el, 'item-hover');
          }
        },
        pointerdown: (event, { api, el }) => {
          if (el !== undefined) {
            api.point(event, el, 'item-press');
          }
        },
        pointerleave: (event, { api }) => {
          if (event.pointerType === 'mouse') {
            api.leave(event);
          }
        },
        mousedown: (event, { el }) => {
          // A press on a mark leaves focus on the plot, so the arrow keys carry on from the pressed mark.
          if (el !== undefined && event.target instanceof Element && event.target.closest(MARK) !== null) {
            event.preventDefault();
            el.focus({ preventScroll: true });
          }
        },
      },
      bind: (el, part) => {
        let release: (() => void) | null = null;

        function follow(): void {
          const isOpen = part.store.get().inspected !== null;

          if (isOpen && release === null) {
            release = bindLayer(el, {
              onDismiss: (reason, event) => part.api.dismiss(reason, event),
              contains: (target) => part.api.within(target),
            });
          }

          if (!isOpen && release !== null) {
            release();

            release = null;
          }
        }

        follow();

        const unsubscribe = part.store.subscribe(follow);

        return () => {
          unsubscribe();
          release?.();
        };
      },
    }),
    mark: slot<{ value: string }, MarkState>({
      props: { value: 'string' },
      state: (state, { key }) => ({ isInspected: state.inspected === key, isSelected: state.selected === key }),
      attrs: (state, { key }) => ({
        'data-inspected': state.inspected === key ? '' : undefined,
        'data-selected': state.selected === key ? '' : undefined,
        'data-chart-mark': key,
      }),
      selects: selects({
        items: () => [],
        cursor: () => [],
        inspected: ({ key }) => [key],
        selected: ({ key }) => [key],
      }),
      press: ({ api, key }, event) => api.choose(key, event),
      on: { pointerenter: (event, { api, key }) => api.enter(key, event) },
    }),
  }),
  agent: { actions: ['inspect', 'select', 'dismiss'], items: (api) => api.items(), closed: true },
});

type MarkState = { readonly isInspected: boolean; readonly isSelected: boolean };

type ChartPart<Tag extends 'figure' | 'div' | 'svg' | 'p' | 'span', State, Named = object> = ComponentType<
  Omit<PartProps<Tag, State>, 'id' | keyof Named> & Named
>;

/** The chart's figure. It owns inspection, the keyboard cursor and selection requests for the plot inside it. */
export const Chart: ChartPart<'figure', ChartView, ChartOptions> = createParts(chart, { root: 'figure' }).Root;

const parts = createParts(chart, { root: 'figure', plot: 'div', mark: 'span' });

/** The plot as one Tab stop: arrows move the cursor, Enter or Space selects, Escape or an outside press dismisses. */
export const ChartPlot: ChartPart<'div', ChartView> = parts.Plot;
export const ChartTextPlot: ChartPart<'p', ChartView> = createParts(chart, { root: 'figure', plot: 'p' }).Plot;
/** One datum a pointer can inspect and press. Pass `render` for a mark that is not a span, such as an SVG shape. */
export const ChartMark: ChartPart<'span', MarkState, { readonly value: string }> = parts.Mark;

/** The visible readout for the open inspection, or a space that holds its line. */
export function inspectedLabel(items: ReadonlyArray<ChartItem>, inspected: string | null): string {
  return items.find((item) => item.id === inspected)?.label ?? '\u00A0';
}

/** Names a plot for a reader who steps through its marks, such as "categories". */
export function plotLabel({
  title,
  marks,
  isSelectable,
}: {
  readonly title: string;
  readonly marks?: string | undefined;
  readonly isSelectable: boolean;
}): string {
  const subject = marks === undefined ? '' : ` ${marks}`;

  return `${title}. Use arrow keys to inspect${subject}.${isSelectable ? ' Press Enter to select.' : ''}`;
}
