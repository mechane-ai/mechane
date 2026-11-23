import { dateFormatter } from '@ui-sdk/core/date';
import { formatNumber } from '@ui-sdk/core/number';
import type { NumberFormat } from '@ui-sdk/core/number';

/** How a figure writes a number: `Intl.NumberFormat` options in the figure's locale, or a function of the value. */
export type ValueFormat = NumberFormat;

/**
 * How a figure writes an instant: `Intl.DateTimeFormat` options that name their time zone, or a function of the
 * timestamp in milliseconds.
 */
export type TimeFormat = (Intl.DateTimeFormatOptions & { readonly timeZone: string }) | ((timestamp: number) => string);

/** The text every figure shows for a value that was not recorded. A missing value is never drawn or written as zero. */
export const MISSING_VALUE_TEXT = 'Unavailable';

export type ValueFormatInput = { readonly value: number | null; readonly locale: string; readonly format: ValueFormat };

/** A value as the reader sees it in a readout, a legend or a table. */
export function formatValue({ value, locale, format }: ValueFormatInput): string {
  if (value === null || !Number.isFinite(value)) {
    return MISSING_VALUE_TEXT;
  }

  return formatNumber(value, locale, format);
}

/**
 * The short form of a value format for an axis, where "1.2M" reads better than "1,200,000". A function format and a
 * format that names its own notation stay as supplied.
 */
export function tickFormat(format: ValueFormat): ValueFormat {
  if (typeof format === 'function') {
    return format;
  }

  return { notation: 'compact', ...format };
}

export type TimeFormatInput = {
  /** The instant in milliseconds since the epoch. */
  readonly timestamp: number;
  readonly locale: string;
  readonly format: TimeFormat;
};

/** An instant as the reader sees it, in the format's declared time zone. */
export function formatTime({ timestamp, locale, format }: TimeFormatInput): string {
  if (typeof format === 'function') {
    return format(timestamp);
  }

  return dateFormatter(locale, format).format(timestamp);
}

const zoneFields = {
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
} as const;

const SECOND = 1000;

/** How far a time zone is ahead of UTC at an instant, in milliseconds, so axis ticks land on local clock steps. */
export function zoneOffset(timestamp: number, timeZone: string): number {
  const parts = dateFormatter('en-US', { ...zoneFields, timeZone }).formatToParts(timestamp);

  function field(type: Intl.DateTimeFormatPartTypes): number {
    return Number(parts.find((part) => part.type === type)?.value);
  }

  const local = Date.UTC(
    field('year'),
    field('month') - 1,
    field('day'),
    field('hour'),
    field('minute'),
    field('second'),
  );

  return local - Math.floor(timestamp / SECOND) * SECOND;
}
