import * as stylex from '@stylexjs/stylex';
import * as Calendar from '@ui-sdk/react/calendar';
import type { ReactNode } from 'react';
import { accessibility } from '../../../foundations/src/accessibility.ts';
import { conditions, loading } from '../../../foundations/src/constants.stylex.ts';
import { colors, controls, radii, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { formatDate, parseCalendarDate, serializeCalendarDate, serializeCalendarMonth } from './civil.ts';
import type { CalendarDate } from './civil.ts';

const reveal = stylex.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });

const styles = stylex.create({
  grid: {
    width: '100%',
    tableLayout: 'fixed',
    borderCollapse: 'collapse',
    borderStyle: 'solid',
    borderWidth: '1px',
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontFamily: typography.fontFamily,
  },
  weekday: {
    paddingBlock: spacing.sm,
    paddingInline: spacing.xs,
    color: colors.muted,
    textAlign: 'center',
    fontSize: typography.captionSize,
    fontWeight: typography.mediumWeight,
  },
  day: {
    borderStyle: 'solid',
    borderWidth: '1px',
    borderColor: colors.line,
    verticalAlign: 'top',
    cursor: 'pointer',
    backgroundColor: { 'default': colors.surface, ':hover': { [conditions.hoverPointer]: colors.canvas } },
    outlineStyle: { 'default': 'none', ':focus-visible': 'solid' },
    outlineWidth: controls.focusWidth,
    outlineColor: colors.focus,
    outlineOffset: '-2px',
  },
  outside: { color: colors.muted, backgroundColor: colors.canvas },
  selected: { backgroundColor: colors.accentSoft },
  content: {
    display: 'grid',
    alignContent: 'start',
    gap: spacing.xs,
    minHeight: { 'default': '88px', '@media (max-width: 600px)': '52px' },
    padding: spacing.xs,
  },
  number: { justifySelf: 'start', paddingInline: spacing.xs, fontSize: typography.captionSize, borderRadius: radii.sm },
  today: { color: colors.accent, backgroundColor: colors.accentSoft, fontWeight: typography.boldWeight },
  event: {
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    paddingInline: spacing.xs,
    fontSize: typography.captionSize,
    backgroundColor: colors.canvas,
    borderRadius: radii.sm,
  },
  placeholder: {
    animationName: { default: reveal, [conditions.reducedMotion]: 'none' },
    animationDelay: `${loading.placeholderMs}ms`,
    animationDuration: `${loading.revealMs}ms`,
    animationFillMode: 'backwards',
  },
  overflow: { fontSize: typography.captionSize, color: colors.muted, whiteSpace: 'nowrap', overflow: 'hidden' },
});

export type EventMonthItem = { readonly id: string; readonly label: string };

export type EventMonthProps = {
  readonly label: string;
  readonly locale: string;
  readonly loading?: { readonly label: string; readonly placeholder: ReactNode } | undefined;
  readonly timeZone: string;
  readonly today: CalendarDate;
  readonly selected: CalendarDate;
  readonly weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  readonly itemsByDate: ReadonlyMap<string, ReadonlyArray<EventMonthItem>>;
  readonly onSelect: (date: CalendarDate) => void;
};

const visibleItems = 2;

export function EventMonth({
  label,
  loading: pendingItems,
  locale,
  timeZone,
  today,
  selected,
  weekStartsOn = 1,
  itemsByDate,
  onSelect,
}: EventMonthProps): ReactNode {
  const selectedDate = serializeCalendarDate(selected);
  const todayDate = serializeCalendarDate(today);

  function choose(value: string) {
    const date = parseCalendarDate(value);

    if (date !== undefined) {
      onSelect(date);
    }
  }

  return (
    <Calendar.Calendar
      aria-label={label}
      mode="single"
      locale={locale}
      timeZone={timeZone}
      today={todayDate}
      month={serializeCalendarMonth(selected)}
      value={selectedDate}
      weekStartsOn={weekStartsOn}
      weekdayFormat="short"
      showOutsideDays
      onValueChange={(value) => {
        if (typeof value === 'string') {
          choose(value);
        }
      }}
      onFocusedChange={(value, details) => {
        if (details.reason === 'list-navigation') {
          choose(value);
        }
      }}
    >
      <Calendar.CalendarGrid aria-busy={pendingItems !== undefined} {...stylex.props(styles.grid)}>
        <Calendar.CalendarWeekdays>
          {(index) => <Calendar.CalendarWeekday index={index} {...stylex.props(styles.weekday)} />}
        </Calendar.CalendarWeekdays>
        <Calendar.CalendarWeeks>
          {(cell) => {
            const date = parseCalendarDate(cell.date);

            if (date === undefined) {
              return null;
            }

            const items = itemsByDate.get(cell.date) ?? [];
            const needsPlaceholder = items.length === 0 && date.month === selected.month;
            const more = items.length - visibleItems;
            const visible = items.slice(0, visibleItems);

            const accessibleLabel = [
              formatDate(date, locale),
              ...visible.map((item) => item.label),
              more > 0 && `+${more} more`,
            ]
              .filter(Boolean)
              .join(', ');

            return (
              <Calendar.CalendarDay
                value={cell.date}
                aria-label={accessibleLabel}
                {...stylex.props(
                  styles.day,
                  date.month !== selected.month && styles.outside,
                  cell.date === selectedDate && styles.selected,
                )}
              >
                <div {...stylex.props(styles.content)} aria-hidden="true">
                  <span {...stylex.props(styles.number, cell.date === todayDate && styles.today)}>{date.day}</span>
                  {pendingItems !== undefined && needsPlaceholder && (
                    <span {...stylex.props(styles.placeholder)}>{pendingItems.placeholder}</span>
                  )}
                  {visible.map((item) => (
                    <span key={item.id} {...stylex.props(styles.event)}>
                      {item.label}
                    </span>
                  ))}
                  {more > 0 && <span {...stylex.props(styles.overflow)}>+{more} more</span>}
                </div>
              </Calendar.CalendarDay>
            );
          }}
        </Calendar.CalendarWeeks>
      </Calendar.CalendarGrid>
      {pendingItems !== undefined && (
        <span role="status" {...stylex.props(accessibility.hidden)}>
          {pendingItems.label}
        </span>
      )}
    </Calendar.Calendar>
  );
}
