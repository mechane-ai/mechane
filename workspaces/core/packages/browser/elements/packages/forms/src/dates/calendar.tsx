import * as stylex from '@stylexjs/stylex';
import * as Sdk from '@ui-sdk/react/calendar';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { conditions } from '../../../foundations/src/constants.stylex.ts';
import { colors, controls, radii, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { isDate, parseCalendarDate, serializeCalendarDate, serializeCalendarMonth } from './civil.ts';
import type { CalendarDate } from './civil.ts';

export type { CalendarDate } from './civil.ts';

const styles = stylex.create({
  calendar: {
    color: colors.ink,
    backgroundColor: colors.surface,
    fontFamily: typography.fontFamily,
    fontWeight: typography.regularWeight,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    padding: 0,
    width: 'max-content',
    maxWidth: '100%',
    overflowX: 'auto',
  },
  month: { position: 'relative' },
  caption: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: { default: controls.height, [conditions.coarsePointer]: controls.coarseTarget },
    marginBottom: spacing.sm,
  },
  captionLabel: { margin: 0, fontSize: typography.bodySize, fontWeight: typography.mediumWeight },
  navigation: {
    position: 'absolute',
    insetInline: 0,
    top: 0,
    display: 'flex',
    justifyContent: 'space-between',
    pointerEvents: 'none',
  },
  navigationButton: {
    'display': 'inline-flex',
    'boxSizing': 'border-box',
    'alignItems': 'center',
    'justifyContent': 'center',
    'width': { default: controls.height, [conditions.coarsePointer]: controls.coarseTarget },
    'height': { default: controls.height, [conditions.coarsePointer]: controls.coarseTarget },
    'padding': 0,
    'borderWidth': 1,
    'borderStyle': 'solid',
    'borderColor': colors.line,
    'borderRadius': radii.sm,
    'color': colors.ink,
    'backgroundColor': colors.surface,
    'pointerEvents': 'auto',
    'cursor': 'pointer',
    ':disabled': { opacity: controls.disabledOpacity, cursor: 'default' },
    ':hover:not(:active, :disabled)': { backgroundColor: { [conditions.hoverPointer]: colors.canvas } },
    ':active:not(:disabled)': { backgroundColor: colors.line },
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: -2,
    },
  },
  chevron: { width: controls.iconSize, height: controls.iconSize },
  grid: { borderCollapse: 'collapse', borderSpacing: 0 },
  weekday: {
    color: colors.muted,
    fontWeight: typography.regularWeight,
    fontSize: typography.captionSize,
    height: controls.height,
    textAlign: 'center',
  },
  dayButton: {
    'boxSizing': 'border-box',
    'width': { default: controls.height, [conditions.coarsePointer]: controls.coarseTarget },
    'height': { default: controls.height, [conditions.coarsePointer]: controls.coarseTarget },
    'padding': 0,
    'borderWidth': 1,
    'borderStyle': 'solid',
    'borderColor': 'transparent',
    'borderRadius': radii.sm,
    'backgroundColor': 'transparent',
    'color': colors.ink,
    'fontFamily': typography.fontFamily,
    'fontWeight': typography.regularWeight,
    'fontSize': typography.bodySize,
    'lineHeight': typography.bodyLineHeight,
    'fontVariantNumeric': 'tabular-nums',
    'textAlign': 'center',
    'cursor': 'pointer',
    ':hover:not(:active, [aria-disabled="true"])': { backgroundColor: { [conditions.hoverPointer]: colors.canvas } },
    ':active:not([aria-disabled="true"])': { backgroundColor: colors.line },
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: -2,
    },
  },
  outside: { color: colors.muted },
  today: { borderColor: colors.line },
  selected: {
    'color': colors.inverse,
    'backgroundColor': colors.ink,
    ':hover:not([aria-disabled="true"])': { backgroundColor: { [conditions.hoverPointer]: colors.inkHover } },
    ':active:not([aria-disabled="true"])': { backgroundColor: colors.inkHover },
  },
  rangeMiddle: {
    'borderRadius': 0,
    'color': colors.ink,
    'backgroundColor': colors.canvas,
    ':hover:not(:active, [aria-disabled="true"])': { backgroundColor: { [conditions.hoverPointer]: colors.canvas } },
    ':active:not([aria-disabled="true"])': { backgroundColor: colors.line },
  },
  disabledDay: { opacity: controls.disabledOpacity, cursor: 'default' },
});

export type CalendarRange = { readonly from: CalendarDate; readonly to?: CalendarDate | undefined };

export type CalendarEnvironment = {
  readonly locale: string;
  readonly timeZone: string;
  readonly today: CalendarDate;
  readonly initialMonth: CalendarDate;
  readonly minimum?: CalendarDate;
  readonly maximum?: CalendarDate;
  readonly weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
};

export type CalendarProps = CalendarEnvironment & { readonly label: string; readonly autoFocus?: boolean } & (
    | {
        readonly mode: 'single';
        readonly value: CalendarDate | undefined;
        readonly onValueChange: (value: CalendarDate | undefined) => void;
      }
    | {
        readonly mode: 'range';
        readonly value: CalendarRange | undefined;
        readonly onValueChange: (value: CalendarRange | undefined) => void;
      }
  );

function isoDate(value: CalendarDate | undefined): string | undefined {
  return value !== undefined && isDate(value) ? serializeCalendarDate(value) : undefined;
}

export function Calendar(props: CalendarProps): ReactNode {
  const grid = useRef<HTMLTableElement>(null);

  useLayoutEffect(() => {
    if (props.autoFocus === true) {
      grid.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
    }
  }, [props.autoFocus, props.timeZone]);

  const today = isoDate(props.today) ?? '2000-01-01';
  const initialMonth = isDate(props.initialMonth) ? serializeCalendarMonth(props.initialMonth) : today.slice(0, 7);
  const minimum = isoDate(props.minimum);
  const maximum = isoDate(props.maximum);
  const from = props.mode === 'range' ? isoDate(props.value?.from) : undefined;
  const to = props.mode === 'range' ? isoDate(props.value?.to) : undefined;
  const range: [string, string] | null = from !== undefined && to !== undefined ? [from, to] : null;

  return (
    <Sdk.Calendar
      key={props.timeZone}
      {...stylex.props(styles.calendar)}
      aria-label={props.label}
      mode={props.mode}
      locale={props.locale}
      timeZone={props.timeZone}
      weekStartsOn={props.weekStartsOn ?? 1}
      today={today}
      defaultMonth={initialMonth}
      {...(minimum !== undefined && { min: minimum })}
      {...(maximum !== undefined && { max: maximum })}
      showOutsideDays
      deselectable
      value={props.mode === 'single' ? (isoDate(props.value) ?? null) : range}
      onAnchorChange={(anchor, details) => {
        if (props.mode !== 'range') {
          return;
        }

        if (anchor === null) {
          if (details.reason === 'escape-key') {
            props.onValueChange(undefined);
          }

          return;
        }

        const date = parseCalendarDate(anchor);

        if (date === undefined) {
          return;
        }

        if (props.value !== undefined && from !== undefined && to === undefined) {
          details.cancel();
          props.onValueChange(
            anchor < from ? { from: date, to: props.value.from } : { from: props.value.from, to: date },
          );
        } else {
          props.onValueChange({ from: date });
        }
      }}
      onValueChange={(next) => {
        if (props.mode === 'single') {
          props.onValueChange(typeof next === 'string' ? parseCalendarDate(next) : undefined);
        } else if (Array.isArray(next)) {
          const start = parseCalendarDate(next[0]);
          const end = parseCalendarDate(next[1]);

          if (start !== undefined && end !== undefined) {
            props.onValueChange({ from: start, to: end });
          }
        }
      }}
    >
      <div {...stylex.props(styles.month)}>
        <div {...stylex.props(styles.caption)}>
          <Sdk.CalendarHeading {...stylex.props(styles.captionLabel)} />
        </div>
        <div {...stylex.props(styles.navigation)}>
          <Sdk.CalendarPrevious {...stylex.props(styles.navigationButton)}>
            <ChevronLeft aria-hidden="true" {...stylex.props(styles.chevron)} />
          </Sdk.CalendarPrevious>
          <Sdk.CalendarNext {...stylex.props(styles.navigationButton)}>
            <ChevronRight aria-hidden="true" {...stylex.props(styles.chevron)} />
          </Sdk.CalendarNext>
        </div>
        <Sdk.CalendarGrid ref={grid} {...stylex.props(styles.grid)}>
          <Sdk.CalendarWeekdays>
            {(index) => <Sdk.CalendarWeekday index={index} {...stylex.props(styles.weekday)} />}
          </Sdk.CalendarWeekdays>
          <Sdk.CalendarWeeks>
            {(cell) => (
              <Sdk.CalendarDay
                value={cell.date}
                className={(day) => {
                  const isEndpoint = day.rangeStart || day.rangeEnd;
                  const isDraftStart = day.date === from && to === undefined;
                  const isSelected = day.selected || isEndpoint || isDraftStart;
                  const isRangeMiddle = day.inRange && !isEndpoint;

                  return (
                    stylex.props(
                      styles.dayButton,
                      day.outside && styles.outside,
                      day.today && styles.today,
                      isSelected && styles.selected,
                      isRangeMiddle && styles.rangeMiddle,
                      day.disabled && styles.disabledDay,
                    ).className ?? ''
                  );
                }}
              />
            )}
          </Sdk.CalendarWeeks>
        </Sdk.CalendarGrid>
      </div>
    </Sdk.Calendar>
  );
}
