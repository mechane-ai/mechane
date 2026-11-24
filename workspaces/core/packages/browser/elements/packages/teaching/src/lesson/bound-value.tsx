import * as stylex from '@stylexjs/stylex';
import { bindDrag, createChange, definePrimitive, dragThreshold, isRTL } from '@ui-sdk/core';
import type { ChangeDetails } from '@ui-sdk/core';
import { clamp, fractionOf, scrubTo, stepBy, stepFromKey, stepValue, valueAt } from '@ui-sdk/core/number';
import type { StepRange } from '@ui-sdk/core/number';
import { createParts } from '@ui-sdk/react/primitive';
import type { PartProps } from '@ui-sdk/react/primitive';
import type { ComponentType, ReactNode } from 'react';
import { formatValue } from '../../../charts/src/index.ts';
import type { ValueFormat } from '../../../charts/src/index.ts';
import { conditions } from '../../../foundations/src/constants.stylex.ts';
import type { ValueStateProperties } from '../../../foundations/src/control-state.ts';
import { colors, controls, radii, typography } from '../../../foundations/src/tokens.stylex.ts';

/** How a bound value maps a drag to a value: evenly, or by ratio so each tenfold takes the same distance. */
export type BoundValueScale = 'linear' | 'log';

/** Why the value changed: a horizontal drag, an arrow, Page, Home or End key, or an agent's call. */
export type BoundValueChangeDetails = ChangeDetails<'drag' | 'step-key' | 'imperative'>;

type BoundValueChange = (value: number, details: BoundValueChangeDetails) => void;

type BoundValueOptions = {
  readonly value?: number | undefined;
  readonly defaultValue?: number | undefined;
  readonly onValueChange?: BoundValueChange | undefined;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly scale?: BoundValueScale | undefined;
  /** The value as the reader sees and hears it. */
  readonly describe: (value: number) => string;
};

type BoundValueState = { readonly value: number; readonly isDragging: boolean };

type KeyMove = NonNullable<ReturnType<typeof stepFromKey>>;

type BoundValueView = { readonly text: string; readonly isDragging: boolean };

/** How far a drag moves across the whole range, in CSS pixels. */
const DRAG_RANGE_PX = 240;

/** The share of a log range one key step moves, and the large and small steps beside it. */
const logSteps: Readonly<Record<'step' | 'large' | 'small', number>> = { step: 0.01, large: 0.1, small: 0.001 };

const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'] as const;

function stepRange({ min, max, step }: BoundValueOptions): StepRange {
  return { min, max, step };
}

/** The value a position along the scale lands on, on the step grid. */
function valueAtPosition(fraction: number, options: BoundValueOptions): number {
  const range = stepRange(options);

  return scrubTo(valueAt(clamp(fraction, 0, 1), range, options.scale ?? 'linear'), range).value;
}

/**
 * A key move on a log scale steps the position, so every tenfold takes as many presses. Where the step grid is coarser
 * than that, the move takes one grid step instead, so a press always moves.
 */
function stepLog(value: number, move: KeyMove, options: BoundValueOptions): number {
  if (move.bound !== undefined) {
    return move.bound === 'min' ? options.min : options.max;
  }

  const range = stepRange(options);
  const target = valueAtPosition(fractionOf(value, range, 'log') + move.direction * logSteps[move.size], options);

  return target === value ? stepValue(value, move.direction, range) : target;
}

const boundValue = definePrimitive({
  name: 'bound-value',
  options: {
    value: 'number',
    defaultValue: 'number',
    onValueChange: 'callback',
    min: 'number',
    max: 'number',
    step: 'number',
    scale: 'string',
    describe: 'value',
  },
  controlled: ['value'],
  state: (options: BoundValueOptions): BoundValueState => ({
    value: options.value ?? options.defaultValue ?? options.min,
    isDragging: false,
  }),
  sync: (options) => (options.value === undefined ? {} : { value: options.value }),
  api: (context) => {
    const { store } = context;
    const change = createChange(context);
    let stop: (() => void) | null = null;

    context.onDestroy(() => stop?.());

    function set(value: number, reason: 'drag' | 'step-key' | 'imperative', event?: Event): boolean {
      if (value === store.get().value) {
        return false;
      }

      return change('value', value, event === undefined ? { reason } : { reason, event });
    }

    return {
      describe: (value: number) => context.options().describe(value),
      /** Sets the value. It must lie between the bounds; it lands on the step grid. */
      setValue(value: unknown) {
        const { min, max } = context.options();
        const next = Number(value);

        if (!Number.isFinite(next) || next < min || next > max) {
          throw new Error(`Give a number between ${min} and ${max}.`);
        }

        return set(scrubTo(next, stepRange(context.options())).value, 'imperative');
      },
      keydown(event: KeyboardEvent, el: HTMLElement): void {
        const move = stepFromKey(event, { dir: isRTL(el) ? 'rtl' : 'ltr' });

        if (move === null || event.defaultPrevented) {
          return;
        }

        event.preventDefault();

        const options = context.options();
        const { value } = store.get();
        const next = options.scale === 'log' ? stepLog(value, move, options) : stepBy(value, move, stepRange(options));

        set(next, 'step-key', event);
      },
      pointerdown(event: PointerEvent, el: HTMLElement): void {
        if (event.button !== 0) {
          return;
        }

        stop?.();

        const start = store.get().value;
        const direction = isRTL(el) ? -1 : 1;
        const origin = fractionOf(start, stepRange(context.options()), context.options().scale ?? 'linear');
        let moved = 0;

        stop = bindDrag(el, event, {
          threshold: dragThreshold,
          cancelOnEscape: true,
          onStart: () => {
            store.set({ isDragging: true });
          },
          onMove: ({ movementX, event: move }) => {
            moved += movementX * direction;

            set(valueAtPosition(origin + moved / DRAG_RANGE_PX, context.options()), 'drag', move);
          },
          onEnd: (end, isCanceled) => {
            store.set({ isDragging: false });

            if (isCanceled) {
              set(start, 'drag', end);
            }
          },
        });
      },
    };
  },
  slots: (slot) => ({
    root: slot<object, BoundValueView>({
      role: 'slider',
      focus: 'tab-stop',
      keys: [...keys],
      state: (state, { api }) => ({ text: api.describe(state.value), isDragging: state.isDragging }),
      attrs: (state, { api }) => ({
        'tabindex': '0',
        'aria-valuenow': String(state.value),
        'aria-valuetext': api.describe(state.value),
        'data-dragging': state.isDragging ? '' : undefined,
      }),
      on: {
        keydown: (event, { api, el }) => {
          if (el !== undefined) {
            api.keydown(event, el);
          }
        },
        pointerdown: (event, { api, el }) => {
          if (el !== undefined) {
            api.pointerdown(event, el);
          }
        },
      },
    }),
  }),
  agent: { actions: ['setValue'] },
});

const Root: ComponentType<Omit<PartProps<'span', BoundValueView>, 'id' | keyof BoundValueOptions> & BoundValueOptions> =
  createParts(boundValue, { root: 'span' }).Root;

const styles = stylex.create({
  value: {
    'display': 'inline',
    'borderRadius': radii.sm,
    'color': colors.ink,
    'fontVariantNumeric': 'tabular-nums',
    'fontWeight': typography.mediumWeight,
    'whiteSpace': 'nowrap',
    'cursor': 'ew-resize',
    'userSelect': 'none',
    'touchAction': 'pan-y',
    'textDecorationLine': 'underline',
    'textDecorationStyle': 'dotted',
    'textDecorationThickness': 2,
    'textDecorationColor': colors.focus,
    'textUnderlineOffset': '0.25em',
    ':hover': { backgroundColor: { [conditions.hoverPointer]: colors.canvas } },
    ':is([data-dragging])': { backgroundColor: colors.canvas, textDecorationStyle: 'solid' },
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: 2,
    },
  },
  error: { color: colors.danger, fontWeight: typography.strongWeight },
});

export type BoundValueProps = ValueStateProperties<number, BoundValueChange> & {
  /** The lowest and highest values the reader can pick. */
  readonly min: number;
  readonly max: number;
  /** The grid values land on, in the value's units. */
  readonly step: number;
  /** `log` gives each tenfold the same drag distance, for rates, sizes and other ratios. */
  readonly scale?: BoundValueScale | undefined;
  readonly locale: string;
  readonly format: ValueFormat;
  /** What the number is, for assistive technology: "Learning rate". */
  readonly label: string;
};

function boundValueError({
  min,
  max,
  step,
  scale,
  value,
}: Omit<BoundValueProps, 'label' | 'locale' | 'format'>): string | undefined {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
    return 'BoundValue needs finite bounds with min below max.';
  }

  if (!Number.isFinite(step) || step < 0) {
    return 'BoundValue needs a step of zero or more.';
  }

  if (scale === 'log' && min <= 0) {
    return 'A log BoundValue needs a min above zero.';
  }

  if (value !== undefined) {
    const isInRange = Number.isFinite(value) && value >= min && value <= max;

    if (!isInRange) {
      return `BoundValue ${value} lies outside ${min} to ${max}.`;
    }
  }

  return undefined;
}

/**
 * A number in a sentence that the reader changes in place: "with a learning rate of 0.003". Drag it sideways to scrub,
 * or focus it and use the arrow keys, Page Up and Page Down, Home and End. Assistive technology hears it as a slider
 * with the formatted value, and the value is the application's: pass `value` and `onValueChange`, or a `defaultValue`.
 */
export function BoundValue({ label, locale, format, ...options }: BoundValueProps): ReactNode {
  const error = boundValueError(options);

  if (error !== undefined) {
    return <span {...stylex.props(styles.error)}>{error}</span>;
  }

  return (
    <Root
      {...options}
      describe={(value) => formatValue({ value, locale, format })}
      aria-label={label}
      aria-valuemin={options.min}
      aria-valuemax={options.max}
      aria-orientation="horizontal"
      {...stylex.props(styles.value)}
      render={(props, { text }) => <span {...props}>{text}</span>}
    />
  );
}
