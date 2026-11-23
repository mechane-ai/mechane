import { hasUniqueIds } from '../chart-input.ts';
import { formatValue } from '../figure/figure-format.ts';
import type { ValueFormat } from '../figure/figure-format.ts';

/** An image a figure shows, with the words that stand in for it. */
export type ImageRecord = {
  readonly id: string;
  /** Where the image loads from: a URL or a data URL. */
  readonly src: string;
  /** What the image shows, in the reader's words. Assistive technology reads it as part of the item. */
  readonly alt: string;
  /** A short name for the image, such as a dataset row number. */
  readonly label?: string | undefined;
  /** The number the figure attaches to the image, or null where there is none. */
  readonly value?: number | null | undefined;
};

/** Why the images cannot be drawn faithfully, or undefined when they can. */
export function imageRecordError(records: ReadonlyArray<ImageRecord>): string | undefined {
  if (!hasUniqueIds(records)) {
    return 'Images must have unique identifiers.';
  }

  const unnamed = records.find((record) => record.alt.trim() === '');

  if (unnamed !== undefined) {
    return `Image ${unnamed.id} needs alt text, so a reader who cannot see it knows what it shows.`;
  }

  const invalid = records.find((record) => typeof record.value === 'number' && !Number.isFinite(record.value));

  if (invalid !== undefined) {
    return `Image ${invalid.id} has a value that is not finite. Use null for no value.`;
  }

  return undefined;
}

/**
 * The sentence for one image: its label and alt text, its position when it has one, then its value when it has one. Use
 * it as the item's label, so a reader who steps through the images hears what each shows.
 */
export function imageReadout({
  record,
  position,
  valueLabel,
  locale,
  format,
}: {
  readonly record: ImageRecord;
  /** Where the image sits, in words, such as "Column 3 of 6, row 2 of 4". */
  readonly position?: string | undefined;
  readonly valueLabel: string;
  readonly locale: string;
  readonly format: ValueFormat;
}): string {
  const name = record.label === undefined ? record.alt : `${record.label}. ${record.alt}`;
  const placed = position === undefined ? name : `${name} · ${position}`;

  if (record.value === undefined) {
    return placed;
  }

  return `${placed} · ${valueLabel}: ${formatValue({ value: record.value, locale, format })}`;
}
