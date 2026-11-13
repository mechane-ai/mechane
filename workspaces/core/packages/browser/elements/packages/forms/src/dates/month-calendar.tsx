import * as stylex from '@stylexjs/stylex';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Button, IconButton } from '../../../core/src/index.ts';
import { spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { formatMonth, isMonth, monthOrder } from './civil.ts';
import type { CalendarMonth } from './civil.ts';

export type MonthEnvironment = {
  readonly locale: string;
  readonly timeZone: string;
  readonly today: CalendarMonth;
  readonly initialMonth: CalendarMonth;
  readonly minimum?: CalendarMonth;
  readonly maximum?: CalendarMonth;
};

export type MonthDraft = { readonly from: CalendarMonth; readonly to?: CalendarMonth | undefined };

const styles = stylex.create({
  calendar: { display: 'flex', flexDirection: 'column', gap: spacing.sm, minWidth: 0 },
  heading: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  year: { fontWeight: typography.mediumWeight, fontVariantNumeric: 'tabular-nums' },
  months: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: spacing.xs },
  month: { width: '100%' },
});

function boundedMonth(value: CalendarMonth, minimum?: CalendarMonth, maximum?: CalendarMonth): CalendarMonth {
  const valid = isMonth(value) ? value : { year: 2000, month: 1 };

  if (minimum !== undefined && monthOrder(valid) < monthOrder(minimum)) {
    return minimum;
  }

  if (maximum !== undefined && monthOrder(valid) > monthOrder(maximum)) {
    return maximum;
  }

  return valid;
}

export function MonthCalendar({
  label,
  selection,
  onSelect,
  locale,
  today,
  initialMonth,
  minimum,
  maximum,
}: MonthEnvironment & {
  readonly label: string;
  readonly selection: MonthDraft | undefined;
  readonly onSelect: (value: CalendarMonth) => void;
}): ReactNode {
  const initial = boundedMonth(initialMonth, minimum, maximum);
  const [year, setYear] = useState(initial.year);
  const [active, setActive] = useState(initial);
  const buttons = useRef(new Map<number, HTMLElement>());
  const pendingFocus = useRef(false);

  useEffect(() => {
    if (!pendingFocus.current) {
      return;
    }

    pendingFocus.current = false;

    buttons.current.get(active.month)?.focus();
  }, [active]);

  function keyDown(event: KeyboardEvent<HTMLButtonElement>, value: CalendarMonth): void {
    const offsets: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -3,
      ArrowDown: 3,
      PageUp: -12,
      PageDown: 12,
    };

    let offset = offsets[event.key];

    if (event.key === 'Home') {
      offset = 1 - value.month;
    }

    if (event.key === 'End') {
      offset = 12 - value.month;
    }

    if (offset === undefined) {
      return;
    }

    event.preventDefault();

    const ordinal = Math.max(12, Math.min(9999 * 12 + 11, monthOrder(value) - 1 + offset));
    const next = boundedMonth({ year: Math.floor(ordinal / 12), month: (ordinal % 12) + 1 }, minimum, maximum);
    pendingFocus.current = true;

    setYear(next.year);
    setActive(next);
  }

  function changeYear(next: number): void {
    const month = boundedMonth({ year: next, month: active.month }, minimum, maximum);

    setYear(month.year);
    setActive(month);
  }

  return (
    <div {...stylex.props(styles.calendar)}>
      <div {...stylex.props(styles.heading)}>
        <IconButton
          aria-label="Previous year"
          disabled={year <= (minimum?.year ?? 1)}
          onClick={() => changeYear(year - 1)}
        >
          <ChevronLeft size={16} />
        </IconButton>
        <span aria-live="polite" {...stylex.props(styles.year)}>
          {year}
        </span>
        <IconButton
          aria-label="Next year"
          disabled={year >= (maximum?.year ?? 9999)}
          onClick={() => changeYear(year + 1)}
        >
          <ChevronRight size={16} />
        </IconButton>
      </div>
      <div role="group" aria-label={label} {...stylex.props(styles.months)}>
        {Array.from({ length: 12 }, (_, index) => {
          const value = { year, month: index + 1 };
          const order = monthOrder(value);
          const from = selection === undefined ? undefined : monthOrder(selection.from);
          const to = selection?.to === undefined ? undefined : monthOrder(selection.to);
          const selected = order === from || order === to;
          const isRange = from !== undefined && to !== undefined;
          const between = isRange && order > from && order < to;

          const isBeforeMinimum = minimum !== undefined && order < monthOrder(minimum);
          const isAfterMaximum = maximum !== undefined && order > monthOrder(maximum);
          const disabled = isBeforeMinimum || isAfterMaximum;

          return (
            <Button
              key={value.month}
              variant={selected || between ? 'solid' : 'ghost'}
              aria-label={formatMonth(value, locale)}
              aria-pressed={selected || between}
              aria-current={year === today.year && value.month === today.month ? 'date' : undefined}
              disabled={disabled}
              tabIndex={active.year === year && active.month === value.month ? 0 : -1}
              ref={(element) => {
                if (element === null) {
                  buttons.current.delete(value.month);
                } else {
                  buttons.current.set(value.month, element);
                }
              }}
              onFocus={() => setActive(value)}
              onKeyDown={(event) => keyDown(event, value)}
              onClick={() => onSelect(value)}
              xstyle={styles.month}
            >
              {new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC', calendar: 'gregory' }).format(
                new Date(`${String(year).padStart(4, '0')}-${String(value.month).padStart(2, '0')}-01T12:00:00Z`),
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
