import type { ReactNode } from 'react';
import { addCalendarDays, parseCalendarDate, serializeCalendarDate } from '../../../forms/src/dates/index.ts';
import type { CalendarDate } from '../../../forms/src/dates/index.ts';
import { formatTime } from '../figure/figure-format.ts';
import type { ValueFormat } from '../figure/figure-format.ts';
import { fitDomain } from '../plot/plot-layout.ts';
import type { NumericDomain } from '../plot/scale.ts';
import { MatrixFigure } from './matrix-figure.tsx';
import type { MatrixPresetProps } from './matrix-presets.ts';
import type { MatrixAxisItem, MatrixCell } from './matrix-types.ts';

/** A day of the week, for the row a week starts on. */
export type CalendarWeekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

/** One day's value. A day in the range with no entry, or with a null value, draws hollow as missing. */
export type CalendarDay = {
  /** The civil date, as `YYYY-MM-DD`. It is also the cell's id for selection. */
  readonly date: string;
  readonly value: number | null;
};

export type CalendarHeatmapProps = MatrixPresetProps & {
  readonly days: ReadonlyArray<CalendarDay>;
  /** The first and last civil dates drawn, inclusive, as `YYYY-MM-DD`. */
  readonly range: { readonly from: string; readonly to: string };
  /** The weekday in the top row, as the reader's calendar starts its weeks. */
  readonly weekStartsOn: CalendarWeekday;
  /** What one day's value is, with its unit: "Evaluation runs". */
  readonly valueLabel: string;
  readonly valueFormat: ValueFormat;
  /** The color domain. Absent spans zero to the largest value. */
  readonly domain?: NumericDomain | undefined;
};

/** The longest range: three years of days. */
export const calendarHeatmapLimits = { days: 1096 } as const;

const WEEKDAYS: ReadonlyArray<CalendarWeekday> = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

const DAYS_PER_WEEK = 7;
const DAY_MS = 86_400_000;
const UTC = 'UTC';
const weekdayFormat = { weekday: 'short', timeZone: UTC } as const;
const monthFormat = { month: 'short', timeZone: UTC } as const;
const dayFormat = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', timeZone: UTC } as const;

/** Days since 1970-01-01 for a civil date. It reads no clock and no time zone. */
function dayNumber(date: CalendarDate): number {
  return Date.UTC(date.year, date.month - 1, date.day) / DAY_MS;
}

/** The weekday of a civil date, from zero for Sunday. 1970-01-01 was a Thursday. */
function weekdayOf(date: CalendarDate): number {
  const THURSDAY = 4;

  return (((dayNumber(date) + THURSDAY) % DAYS_PER_WEEK) + DAYS_PER_WEEK) % DAYS_PER_WEEK;
}

type CalendarLayout = {
  readonly rows: ReadonlyArray<MatrixAxisItem>;
  readonly columns: ReadonlyArray<MatrixAxisItem>;
  /** Every date in the range, with its row and column. */
  readonly dates: ReadonlyArray<{ readonly date: string; readonly rowId: string; readonly columnId: string }>;
};

function calendarLayout({
  from,
  to,
  weekStartsOn,
  locale,
}: {
  readonly from: CalendarDate;
  readonly to: CalendarDate;
  readonly weekStartsOn: CalendarWeekday;
  readonly locale: string;
}): CalendarLayout {
  const first = WEEKDAYS.indexOf(weekStartsOn);
  const offset = (weekdayOf(from) - first + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  const start = addCalendarDays(from, -offset);
  const weekCount = Math.ceil((dayNumber(to) - dayNumber(start) + 1) / DAYS_PER_WEEK);

  function instant(date: CalendarDate): number {
    return dayNumber(date) * DAY_MS;
  }

  const rows = Array.from({ length: DAYS_PER_WEEK }, (_, row) => {
    const date = addCalendarDays(start, row);

    return {
      id: WEEKDAYS[(first + row) % DAYS_PER_WEEK] ?? weekStartsOn,
      label: formatTime({ timestamp: instant(date), locale, format: weekdayFormat }),
    };
  });

  const columns = Array.from({ length: weekCount }, (_, week) => {
    const weekStart = addCalendarDays(start, week * DAYS_PER_WEEK);

    const inRange = Array.from({ length: DAYS_PER_WEEK }, (__, day) => addCalendarDays(weekStart, day)).filter(
      (date) => dayNumber(date) >= dayNumber(from) && dayNumber(date) <= dayNumber(to),
    );

    const monthStart = inRange.find((date) => date.day === 1) ?? (week === 0 ? inRange[0] : undefined);

    return {
      id: serializeCalendarDate(weekStart),
      label: `Week of ${formatTime({ timestamp: instant(inRange[0] ?? weekStart), locale, format: dayFormat })}`,
      axisLabel:
        monthStart === undefined ? '' : formatTime({ timestamp: instant(monthStart), locale, format: monthFormat }),
    };
  });

  const length = dayNumber(to) - dayNumber(from) + 1;

  const dates = Array.from({ length }, (_, index) => {
    const date = addCalendarDays(from, index);
    const position = index + offset;

    return {
      date: serializeCalendarDate(date),
      rowId: rows[position % DAYS_PER_WEEK]?.id ?? '',
      columnId: columns[Math.floor(position / DAYS_PER_WEEK)]?.id ?? '',
    };
  });

  return { rows, columns, dates };
}

function calendarProblem({
  days,
  from,
  to,
}: {
  readonly days: ReadonlyArray<CalendarDay>;
  readonly from: CalendarDate | undefined;
  readonly to: CalendarDate | undefined;
}): string | undefined {
  if (from === undefined || to === undefined || dayNumber(to) < dayNumber(from)) {
    return 'The range needs two valid dates as YYYY-MM-DD, the first on or before the last.';
  }

  if (dayNumber(to) - dayNumber(from) + 1 > calendarHeatmapLimits.days) {
    return `This calendar draws at most ${calendarHeatmapLimits.days} days. Supply a shorter range.`;
  }

  const parsed = days.map((day) => parseCalendarDate(day.date));

  if (
    parsed.some((date) => date === undefined || dayNumber(date) < dayNumber(from) || dayNumber(date) > dayNumber(to))
  ) {
    return 'Every day must be a valid YYYY-MM-DD date inside the range.';
  }

  if (new Set(days.map((day) => day.date)).size !== days.length) {
    return 'Each date may appear only once.';
  }

  return days.some((day) => day.value !== null && !Number.isFinite(day.value))
    ? 'Day values must be finite. Use null for a day without a value.'
    : undefined;
}

/**
 * One supplied value per civil date over a range, with weeks as columns, weekdays as rows and the months named above:
 * daily evaluation runs, incidents, training jobs. Lightness of one hue shows the value; a day with no value is hollow.
 * Dates are `YYYY-MM-DD` strings, and the week start is an input, so the chart reads no clock and no time zone.
 */
export function CalendarHeatmap(props: CalendarHeatmapProps): ReactNode {
  const {
    days,
    range,
    weekStartsOn,
    valueLabel,
    valueFormat,
    domain,
    emptyLabel = 'No days were supplied.',
    ...figure
  } = props;

  const { locale } = figure;
  const from = parseCalendarDate(range.from);
  const to = parseCalendarDate(range.to);
  const problem = calendarProblem({ days, from, to });

  const hasCalendar = problem === undefined && days.length > 0;

  const layout =
    hasCalendar && from !== undefined && to !== undefined
      ? calendarLayout({ from, to, weekStartsOn, locale })
      : { rows: [], columns: [], dates: [] };

  const values = new Map(days.map((day) => [day.date, day.value]));
  const positions = new Map(layout.dates.map((entry) => [`${entry.rowId} ${entry.columnId}`, entry.date]));

  const cells = layout.dates.map(({ date, rowId, columnId }): MatrixCell => {
    const value = values.get(date) ?? null;

    return value === null
      ? { id: date, rowId, columnId, kind: 'missing', reason: 'No value recorded' }
      : { id: date, rowId, columnId, kind: 'value', value };
  });

  function dateAt(row: MatrixAxisItem, column: MatrixAxisItem): string | undefined {
    return positions.get(`${row.id} ${column.id}`);
  }

  function dayLabel(row: MatrixAxisItem, column: MatrixAxisItem): string {
    const date = parseCalendarDate(dateAt(row, column) ?? '');

    return date === undefined
      ? `${row.label}, ${column.label}`
      : formatTime({ timestamp: dayNumber(date) * DAY_MS, locale, format: dayFormat });
  }

  return (
    <MatrixFigure
      {...figure}
      emptyLabel={emptyLabel}
      problem={problem}
      rows={layout.rows}
      columns={layout.columns}
      cells={cells}
      domain={domain ?? fitDomain({ values: days.map((day) => day.value), isZeroBased: true })}
      palette="sequential"
      valueFormat={valueFormat}
      valueLabel={valueLabel}
      variant="strip"
      headers="overflow"
      rowNoun="weekday"
      columnNoun="week"
      marking={(row, column) => (dateAt(row, column) === undefined ? 'hidden' : undefined)}
      cellLabel={dayLabel}
    />
  );
}
