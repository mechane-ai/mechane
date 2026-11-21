import { isHeatmapValueInDomain } from './heatmap-scale.ts';
import type { MatrixCell } from './matrix-types.ts';

export const CELL_TEXT_MAX_CHARACTERS = 6;

export function matrixCellGlyph(cell: MatrixCell, text: string, isOutsideDomain: boolean): string {
  switch (cell.kind) {
    case 'masked':
      return '×';
    case 'missing':
      return '—';
    case 'value':
      if (isOutsideDomain) {
        return '!';
      }

      if (text.length <= CELL_TEXT_MAX_CHARACTERS) {
        return text;
      }

      return cell.value === 0 ? '0' : '•';
  }
}

export function matrixValueText(
  cell: MatrixCell | undefined,
  domain: readonly [number, number],
  formatValue: (value: number) => string,
): string {
  if (cell === undefined) {
    return 'Not supplied';
  }

  switch (cell.kind) {
    case 'value':
      return `${formatValue(cell.value)}${isHeatmapValueInDomain(cell.value, domain) ? '' : ' (outside domain)'}`;
    case 'masked':
      return `Masked: ${cell.reason}`;
    case 'missing':
      return `Missing: ${cell.reason}`;
  }
}
