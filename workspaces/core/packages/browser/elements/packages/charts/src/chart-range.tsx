import * as stylex from '@stylexjs/stylex';
import { createChange, createSpans, definePrimitive } from '@ui-sdk/core';
import type { ChangeDetails, Span, SpansDraft, SpansReason } from '@ui-sdk/core';
import { createParts } from '@ui-sdk/react/primitive';
import type { PartProps } from '@ui-sdk/react/primitive';
import type { ComponentType, ReactNode } from 'react';
import { colors, controls } from '../../foundations/src/tokens.stylex.ts';

/** A range along a plot's axis, in the axis's own units, such as two timestamps. */
export type ChartRangeValue = readonly [number, number];

/** Why the range changed: a drag, an arrow key, Delete, a button beside the plot, or a call such as an agent's step. */
export type ChartRangeDetails = ChangeDetails<SpansReason | 'clear-press' | 'trigger-press'>;

export type ChartRangeOptions = {
  /** The selected range, or null. The application owns it and passes back what `onValueChange` asks for. */
  readonly value: ChartRangeValue | null;
  readonly onValueChange: (value: ChartRangeValue | null, details: ChartRangeDetails) => void;
  /** Where the axis starts and ends, in its units. */
  readonly min: number;
  readonly max: number;
  /** What each end snaps to, and what an arrow key moves the range by. */
  readonly step: number;
  /** A range as a reader hears it, such as "09:00 to 09:30". */
  readonly describe: (value: ChartRangeValue) => string;
};

type SpanChange = Parameters<Parameters<typeof createSpans<RangeState>>[1]['set']>[1];

type RangeState = {
  readonly value: ChartRangeValue | null;
  readonly spans: Array<Span>;
  readonly draft: SpansDraft | null;
};

const TRACK = 'axis';
const SELECTED = 'selected';
const DRAWN = 'drawn';

function controlledState({ value }: ChartRangeOptions): Pick<RangeState, 'value' | 'spans'> {
  return { value, spans: value === null ? [] : [{ id: SELECTED, track: TRACK, start: value[0], end: value[1] }] };
}

/** The spans to draw: only the new one while a pointer draws it, so it reads as replacing the old range. */
function shownSpans(state: RangeState, spans: ReadonlyArray<Span>): ReadonlyArray<Span> {
  const { draft } = state;

  return draft?.action === 'draw' ? spans.filter((span) => span.id === draft.id) : spans;
}

const chartRange = definePrimitive({
  name: 'chart-range',
  options: {
    value: 'value',
    onValueChange: 'callback',
    min: 'number',
    max: 'number',
    step: 'number',
    describe: 'value',
  },
  controlled: ['value'],
  state: (options: ChartRangeOptions): RangeState => ({ ...controlledState(options), draft: null }),
  sync: controlledState,
  api: (context) => {
    const change = createChange(context);

    function commit(value: ReadonlyArray<Span>, { id, action, reason, event }: SpanChange): boolean {
      const span = action === 'delete' ? undefined : value.find((candidate) => candidate.id === id);
      const next: ChartRangeValue | null = span === undefined ? null : [span.start, span.end];
      const isAccepted = change('value', next, event === undefined ? { reason } : { reason, event });

      // A deleted range takes its element with it, so focus goes back to the plot it was drawn on.
      if (isAccepted && action === 'delete') {
        context.element('root')?.querySelector<HTMLElement | SVGElement>('[tabindex="0"]:not([data-span-id])')?.focus();
      }

      return isAccepted;
    }

    const spans = createSpans<RangeState>(context, {
      key: 'spans',
      draft: 'draft',
      axis: 'x',
      min: () => context.options().min,
      max: () => context.options().max,
      step: () => context.options().step,
      create: (span) => ({ ...span, id: DRAWN }),
      label: (span) => context.options().describe([span.start, span.end]),
      createAutoScroll: false,
      set: (value, details) => commit(value, details),
    });

    return {
      spans,
      /** The spans to draw now, each with the name a reader hears. */
      shown(state: RangeState) {
        return shownSpans(state, spans.spans(state)).map((span) => ({
          id: span.id,
          label: context.options().describe([span.start, span.end]),
        }));
      },
      /** Draws a range from a press on the plot. A touch scrolls the page, and uses the span and the buttons. */
      draw(event: PointerEvent) {
        if (event.button === 0 && event.pointerType !== 'touch') {
          spans.trackPointerdown(event, TRACK);
        }
      },
      /** Selects a range. Each end snaps to the step and stays on the axis. */
      setRange(start: unknown, end: unknown) {
        const { min, max, step } = context.options();
        const snapped = [Number(start), Number(end)].map((value) => min + Math.round((value - min) / step) * step);
        const from = Math.max(min, Math.min(...snapped));
        const to = Math.min(max, Math.max(...snapped));

        if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) {
          throw new Error(`Give a start and a later end between ${min} and ${max}.`);
        }

        return change('value', [from, to], { reason: 'imperative' });
      },
      clear() {
        return change('value', null, { reason: 'imperative' });
      },
    };
  },
  slots: (slot) => ({
    root: slot<object, { readonly spans: ReadonlyArray<{ readonly id: string; readonly label: string }> }>({
      role: 'group',
      state: (state, { api }) => ({ spans: api.shown(state) }),
      on: { pointerdown: (event, { api }) => api.draw(event) },
    }),
    track: slot({ bind: (el, { api }) => api.spans.bindTrack(el, TRACK) }),
    span: slot<{ value: string }>({
      role: 'group',
      props: { value: 'string' },
      attrs: (state, { api, key }) => {
        const span = api.spans.spans(state).find((candidate) => candidate.id === key);

        return {
          ...api.spans.spanAttrs(state, key),
          tabindex: '0',
          style: span === undefined ? undefined : api.spans.spanStyle(span),
        };
      },
      bind: (el, { api, key }) => api.spans.bindSpan(el, key),
      on: {
        pointerdown: (event, { api, key }) => api.spans.spanPointerdown(event, key),
        keydown: (event, { api, key }) => {
          api.spans.keydown(event, key);
        },
      },
    }),
  }),
  agent: { actions: ['setRange', 'clear'] },
});

const parts = createParts(chartRange, { root: 'div', track: 'div', span: 'div' });

type RangeRootState = { readonly spans: ReadonlyArray<{ readonly id: string; readonly label: string }> };

const Root: ComponentType<Omit<PartProps<'div', RangeRootState>, 'id' | keyof ChartRangeOptions> & ChartRangeOptions> =
  parts.Root;

const Track: ComponentType<Omit<PartProps<'div'>, 'id'>> = parts.Track;
const RangeSpan: ComponentType<Omit<PartProps<'div'>, 'id' | 'value'> & { readonly value: string }> = parts.Span;

const EDGE_WIDTH = 10;
const GRIP_HEIGHT = 8;

const styles = stylex.create({
  root: { position: 'relative', minWidth: 0 },
  track: (left: number, width: number, height: number) => ({
    position: 'absolute',
    top: 0,
    left,
    width,
    height,
    pointerEvents: 'none',
  }),
  span: {
    'position': 'absolute',
    'top': 0,
    'height': '100%',
    'boxSizing': 'border-box',
    'backgroundColor': `color-mix(in srgb, ${colors.focus} 10%, transparent)`,
    'borderInlineWidth': 1,
    'borderBlockWidth': 0,
    'borderStyle': 'dashed',
    'borderColor': { 'default': colors.focus, '@media (forced-colors: active)': 'Highlight' },
    'outlineStyle': 'none',
    ':focus-visible': {
      outlineColor: colors.focus,
      outlineStyle: 'solid',
      outlineWidth: controls.focusWidth,
      outlineOffset: -2,
    },
  },
  // Only the edges and the grip take the pointer, so the plot under the range still shows what the pointer is over.
  handle: { position: 'absolute', pointerEvents: 'auto', touchAction: 'none' },
  edge: { top: 0, height: '100%', width: EDGE_WIDTH, cursor: 'ew-resize' },
  grip: {
    insetInline: EDGE_WIDTH / 2,
    bottom: 0,
    height: GRIP_HEIGHT,
    cursor: 'grab',
    backgroundColor: { 'default': colors.focus, '@media (forced-colors: active)': 'Highlight' },
    opacity: 0.35,
  },
  start: { insetInlineStart: -EDGE_WIDTH / 2 },
  end: { insetInlineEnd: -EDGE_WIDTH / 2 },
});

export type ChartRangeProps = ChartRangeOptions & {
  /** Where the axis sits inside the plot, in CSS pixels from the plot's top left corner. */
  readonly left: number;
  readonly width: number;
  readonly height: number;
  /** Names the plot and its range together, such as "Request latency time range". */
  readonly label: string;
  /** The plot the range is drawn over. A mouse or pen press on it starts a new range. */
  readonly children: ReactNode;
};

/**
 * A range a reader draws along a plot's axis and moves with a drag or the arrow keys. Its edges or Shift and an arrow
 * resize it, and Delete clears it. An agent reads the range and sets or clears it.
 */
export function ChartRange({ left, width, height, label, children, ...options }: ChartRangeProps): ReactNode {
  return (
    <Root
      {...options}
      aria-label={label}
      {...stylex.props(styles.root)}
      render={(root, { spans }) => (
        <div {...root}>
          {children}
          <Track {...stylex.props(styles.track(left, width, height))}>
            {spans.map((span) => (
              <RangeSpan
                key={span.id}
                value={span.id}
                aria-label={`Selected range, ${span.label}. Use arrow keys to move it, Shift and an arrow to move its end, and Delete to clear it.`}
                {...stylex.props(styles.span)}
              >
                <span {...stylex.props(styles.handle, styles.grip)} />
                <span data-span-edge="start" {...stylex.props(styles.handle, styles.edge, styles.start)} />
                <span data-span-edge="end" {...stylex.props(styles.handle, styles.edge, styles.end)} />
              </RangeSpan>
            ))}
          </Track>
        </div>
      )}
    />
  );
}
