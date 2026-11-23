import { formatValue } from '../figure/figure-format.ts';
import type { ValueFormat } from '../figure/figure-format.ts';
import type { NumericDomain } from '../plot/scale.ts';
import { isHeatmapValueInDomain } from './heatmap-scale.ts';
import type { MatrixCell } from './matrix-types.ts';

/** How wide a caption digit is and how much room a cell keeps between its text and its border. */
const cellText = { digitPx: 7, insetPx: 5, sides: 2, percent: 100 } as const;

/** How many characters of a value fit inside a square cell of this size without touching its border. */
export function cellTextCapacity(size: number): number {
  return Math.floor((size - cellText.insetPx * cellText.sides) / cellText.digitPx);
}

export type CellTextInput = {
  readonly value: number;
  readonly locale: string;
  readonly format: ValueFormat;
  /** The most characters the cell holds, from `cellTextCapacity`. */
  readonly capacity: number;
};

/**
 * The text a square cell writes for its value: the supplied format when it fits, else the value rounded to whole units,
 * else in compact notation. Rounding is skipped where it would write a nonzero value as zero. Undefined means no form
 * fits, and the cell shows a dot while the readout keeps the exact value.
 */
export function cellValueText({ value, locale, format, capacity }: CellTextInput): string | undefined {
  const units = typeof format !== 'function' && format.style === 'percent' ? value * cellText.percent : value;
  const isRoundable = typeof format !== 'function' && (value === 0 || Math.abs(units) >= 1);

  const forms: ReadonlyArray<ValueFormat> =
    typeof format === 'function' || !isRoundable
      ? [format]
      : [
          format,
          { ...format, minimumFractionDigits: 0, maximumFractionDigits: 0 },
          { ...format, notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 1 },
        ];

  return forms.map((form) => formatValue({ value, locale, format: form })).find((text) => text.length <= capacity);
}

/** What a square cell writes inside itself: its value text, or the glyph for its state. */
export function matrixCellGlyph(cell: MatrixCell, text: string | undefined, isOutsideDomain: boolean): string {
  switch (cell.kind) {
    case 'masked':
      return '×';
    case 'missing':
      return '—';
    case 'value':
      if (isOutsideDomain) {
        return '!';
      }

      return text ?? (cell.value === 0 ? '0' : '•');
  }
}

export type MatrixValueTextInput = {
  readonly cell: MatrixCell | undefined;
  readonly domain: NumericDomain;
  readonly locale: string;
  readonly format: ValueFormat;
};

/** A cell's exact value, or its state and reason, as a reader sees it in the readout and the exact-value table. */
export function matrixValueText({ cell, domain, locale, format }: MatrixValueTextInput): string {
  if (cell === undefined) {
    return 'Not supplied';
  }

  switch (cell.kind) {
    case 'value':
      return `${formatValue({ value: cell.value, locale, format })}${isHeatmapValueInDomain(cell.value, domain) ? '' : ' (outside domain)'}`;
    case 'masked':
      return `Masked: ${cell.reason}`;
    case 'missing':
      return `Missing: ${cell.reason}`;
  }
}
