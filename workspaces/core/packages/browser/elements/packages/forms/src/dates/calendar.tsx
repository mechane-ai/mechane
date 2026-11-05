import { DayButton, DayPicker, TZDate } from '@daypicker/react';
import type { PropsBase } from '@daypicker/react';
import * as stylex from '@stylexjs/stylex';
import type { ComponentProps, ReactNode } from 'react';
import { conditions } from '../../../foundations/src/constants.stylex.ts';
import { colors, controls, radii, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';

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
  months: { display: 'flex', flexWrap: 'wrap', position: 'relative', gap: spacing.xl },
  caption: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: { default: controls.height, [conditions.coarsePointer]: controls.coarseTarget },
    marginBottom: spacing.sm,
  },
  captionLabel: { fontSize: typography.bodySize, fontWeight: typography.mediumWeight },
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
  chevron: { width: controls.iconSize, height: controls.iconSize, fill: 'currentColor' },
  grid: { borderCollapse: 'collapse', borderSpacing: 0 },
  weekday: {
    color: colors.muted,
    fontWeight: typography.regularWeight,
    fontSize: typography.captionSize,
    height: controls.height,
    textAlign: 'center',
  },
  day: { padding: 0, textAlign: 'center' },
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
    'cursor': 'pointer',
    ':hover:not(:active, :disabled)': { backgroundColor: { [conditions.hoverPointer]: colors.canvas } },
    ':active:not(:disabled)': { backgroundColor: colors.line },
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: -2,
    },
    ':disabled': { opacity: controls.disabledOpacity, cursor: 'default' },
  },
  outside: { color: colors.muted },
  today: { borderColor: colors.line },
  selected: {
    'color': colors.inverse,
    'backgroundColor': colors.ink,
    ':hover:not(:disabled)': { backgroundColor: { [conditions.hoverPointer]: colors.inkHover } },
    ':active:not(:disabled)': { backgroundColor: colors.inkHover },
  },
  rangeMiddle: {
    'borderRadius': 0,
    'color': colors.ink,
    'backgroundColor': colors.canvas,
    ':hover:not(:active, :disabled)': { backgroundColor: { [conditions.hoverPointer]: colors.canvas } },
    ':active:not(:disabled)': { backgroundColor: colors.line },
  },
  hidden: { visibility: 'hidden' },
});

export type CalendarDate = { readonly year: number; readonly month: number; readonly day: number };

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

function zonedDate(value: CalendarDate, timeZone: string): Date {
  // Noon avoids zones whose civil day starts with a daylight-saving transition.
  return new TZDate(value.year, value.month - 1, value.day, 12, 0, 0, timeZone);
}

function calendarDate(value: Date): CalendarDate {
  return { year: value.getFullYear(), month: value.getMonth() + 1, day: value.getDate() };
}

function CalendarDayButton({ className, modifiers, ...props }: ComponentProps<typeof DayButton>) {
  const appearance = stylex.props(
    styles.dayButton,
    modifiers['outside'] === true && styles.outside,
    modifiers['today'] === true && styles.today,
    modifiers['selected'] === true && styles.selected,
    modifiers['range_middle'] === true && styles.rangeMiddle,
  );

  return (
    <DayButton
      {...props}
      modifiers={modifiers}
      className={[className, appearance.className].filter(Boolean).join(' ')}
    />
  );
}

export function Calendar(props: CalendarProps): ReactNode {
  const { locale, timeZone, today, initialMonth, minimum, maximum, weekStartsOn = 1, label } = props;
  const disabled = [];

  if (minimum !== undefined) {
    disabled.push({ before: zonedDate(minimum, timeZone) });
  }

  if (maximum !== undefined) {
    disabled.push({ after: zonedDate(maximum, timeZone) });
  }

  const shared: PropsBase = {
    'aria-label': label,
    timeZone,
    'noonSafe': true,
    'autoFocus': props.autoFocus ?? false,
    weekStartsOn,
    'today': zonedDate(today, timeZone),
    'defaultMonth': zonedDate(initialMonth, timeZone),
    'startMonth': minimum === undefined ? undefined : zonedDate(minimum, timeZone),
    disabled,
    'showOutsideDays': true,
    'components': { DayButton: CalendarDayButton },
    'classNames': {
      root: stylex.props(styles.calendar).className ?? '',
      months: stylex.props(styles.months).className ?? '',
      month_caption: stylex.props(styles.caption).className ?? '',
      caption_label: stylex.props(styles.captionLabel).className ?? '',
      nav: stylex.props(styles.navigation).className ?? '',
      button_previous: stylex.props(styles.navigationButton).className ?? '',
      button_next: stylex.props(styles.navigationButton).className ?? '',
      chevron: stylex.props(styles.chevron).className ?? '',
      month_grid: stylex.props(styles.grid).className ?? '',
      weekday: stylex.props(styles.weekday).className ?? '',
      day: stylex.props(styles.day).className ?? '',
      hidden: stylex.props(styles.hidden).className ?? '',
    },
    'formatters': {
      formatCaption: (date: Date) =>
        new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone }).format(date),
      formatDay: (date: Date) => new Intl.DateTimeFormat(locale, { day: 'numeric', timeZone }).format(date),
      formatWeekdayName: (date: Date) => new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone }).format(date),
    },
  };

  if (maximum !== undefined) {
    shared.endMonth = zonedDate(maximum, timeZone);
  }

  if (props.mode === 'single') {
    return (
      <DayPicker
        key={timeZone}
        {...shared}
        mode="single"
        selected={props.value === undefined ? undefined : zonedDate(props.value, timeZone)}
        onSelect={(date) => props.onValueChange(date === undefined ? undefined : calendarDate(date))}
      />
    );
  }

  const selected =
    props.value === undefined
      ? undefined
      : {
          from: zonedDate(props.value.from, timeZone),
          to: props.value.to === undefined ? undefined : zonedDate(props.value.to, timeZone),
        };

  return (
    <DayPicker
      key={timeZone}
      {...shared}
      mode="range"
      resetOnSelect
      selected={selected}
      onSelect={(range) =>
        props.onValueChange(
          range?.from === undefined
            ? undefined
            : { from: calendarDate(range.from), to: range.to === undefined ? undefined : calendarDate(range.to) },
        )
      }
    />
  );
}
