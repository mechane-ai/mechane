import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors } from '../../../foundations/src/tokens.stylex.ts';
import { chartStyles } from '../chart-theme.ts';
import { ChartMark } from '../chart.tsx';
import type { ChartView } from '../chart.tsx';
import { ImageFill } from './image-fill.tsx';

const styles = stylex.create({
  tile: {
    position: 'relative',
    display: 'block',
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    margin: 0,
    padding: 0,
    borderWidth: 0,
    overflow: 'hidden',
    backgroundColor: colors.canvas,
    outlineStyle: 'none',
  },
  ratio: (aspectRatio: number) => ({ aspectRatio }),
  action: { cursor: 'pointer' },
  placed: (column: number, row: number) => ({
    gridColumn: column + 1,
    gridRow: row + 1,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.surface,
  }),
  raised: { zIndex: 1 },
  inspected: { boxShadow: `0 0 0 1px ${colors.ink}` },
  selected: { boxShadow: `0 0 0 2px ${colors.ink}` },
});

export type ImageTileProps = {
  readonly id: string;
  /** What assistive technology reads for the tile: the alt text and every value the tile stands for. */
  readonly label: string;
  readonly src: string;
  readonly alt: string;
  /** Width divided by height. */
  readonly ratio: number;
  readonly view: ChartView;
  /** True when the application listens for selection, so the tile is a toggle button. */
  readonly isSelectable: boolean;
  /**
   * The grid position, counted from 0, when the tile sits in a layout of its own. A gap of one pixel then separates
   * tiles.
   */
  readonly place?: { readonly column: number; readonly row: number } | undefined;
};

/**
 * One image a reader can inspect and, when the application listens, select. Use it inside a chart plot. The tile is a
 * mark of the chart, so pointer, arrow keys and Enter work as in every chart.
 */
export function ImageTile({ id, label, src, alt, ratio, view, isSelectable, place }: ImageTileProps): ReactNode {
  const isSelected = view.selected === id;
  const isCursor = view.cursor === id;

  return (
    <ChartMark
      value={id}
      render={
        <button type="button" tabIndex={-1} aria-label={label} aria-pressed={isSelectable ? isSelected : undefined} />
      }
      {...stylex.props(
        styles.tile,
        styles.ratio(ratio),
        isSelectable && styles.action,
        (isSelected || isCursor) && styles.raised,
        view.inspected === id && styles.inspected,
        isSelected && styles.selected,
        isCursor && chartStyles.cursor,
        place !== undefined && styles.placed(place.column, place.row),
      )}
    >
      <ImageFill src={src} alt={alt} />
    </ChartMark>
  );
}
