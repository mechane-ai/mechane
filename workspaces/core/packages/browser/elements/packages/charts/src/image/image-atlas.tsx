import * as stylex from '@stylexjs/stylex';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { ChartData } from '../chart-data.tsx';
import { ChartReadout } from '../chart-frame.tsx';
import { Chart, ChartPlot, inspectedLabel, plotLabel } from '../chart.tsx';
import type { ValueFormat } from '../figure/figure-format.ts';
import { FigureEmpty, FigureFrame, FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps, FigureSelectionProps } from '../figure/figure-props.ts';
import { imageReadout, imageRecordError } from './image-input.ts';
import type { ImageRecord } from './image-input.ts';
import { ImageTile } from './image-tile.tsx';

/** One thumbnail and the position the application gave it. Positions count from 0 at the top left. */
export type ImageAtlasCell = ImageRecord & {
  /** The column, from 0 at the left to `columns - 1`. */
  readonly column: number;
  /** The row, from 0 at the top to `rows - 1`. */
  readonly row: number;
};

export type ImageAtlasProps = FigureProps &
  FigureSelectionProps & {
    /** How many columns the layout has. Cells are square and the columns fill the width. */
    readonly columns: number;
    readonly rows: number;
    /** The thumbnails. Positions without a cell stay empty. Two cells may not share a position. */
    readonly cells: ReadonlyArray<ImageAtlasCell>;
    /**
     * Names what the left to right direction of the layout stands for, such as "First component". The positions are
     * layout coordinates the application chose, not measured axes, so the figure draws no ticks or scale.
     */
    readonly xLabel?: string | undefined;
    /** Names what the top to bottom direction of the layout stands for. Layout coordinates, like `xLabel`. */
    readonly yLabel?: string | undefined;
    /** What each cell's value measures, such as "Activation". It names the value in the readout. */
    readonly valueLabel?: string | undefined;
    readonly valueFormat?: ValueFormat | undefined;
  };

export const imageAtlasLimits = { cells: 1024 } as const;

const DEFAULT_VALUE_LABEL = 'Value';
const DEFAULT_VALUE_FORMAT: ValueFormat = { maximumFractionDigits: 2 };

const styles = stylex.create({
  atlas: (ratio: number, columns: number, rows: number) => ({
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
    aspectRatio: ratio,
    width: '100%',
    minWidth: 0,
    backgroundColor: colors.canvas,
    outlineStyle: 'none',
  }),
  footer: { display: 'grid', gap: spacing.xs, minWidth: 0 },
  layout: {
    margin: 0,
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
  },
});

function isOutside({
  cell,
  columns,
  rows,
}: {
  readonly cell: ImageAtlasCell;
  readonly columns: number;
  readonly rows: number;
}): boolean {
  const isWhole = Number.isInteger(cell.column) && Number.isInteger(cell.row);

  const isColumnOutside = cell.column < 0 || cell.column >= columns;
  const isRowOutside = cell.row < 0 || cell.row >= rows;

  return !isWhole || isColumnOutside || isRowOutside;
}

function atlasInputError({
  columns,
  rows,
  cells,
}: Pick<ImageAtlasProps, 'columns' | 'rows' | 'cells'>): string | undefined {
  if (![columns, rows].every((count) => Number.isInteger(count) && count >= 1)) {
    return 'The layout needs a whole number of columns and rows, at least 1 each.';
  }

  if (cells.length > imageAtlasLimits.cells) {
    return `This atlas draws at most ${imageAtlasLimits.cells} cells. Supply a coarser layout.`;
  }

  const outside = cells.find((cell) => isOutside({ cell, columns, rows }));

  if (outside !== undefined) {
    return `Cell ${outside.id} lies outside the ${columns} by ${rows} layout.`;
  }

  const positions = new Set(cells.map((cell) => `${cell.column},${cell.row}`));

  if (positions.size !== cells.length) {
    return 'Two cells share one position. Each position holds at most one cell.';
  }

  return imageRecordError(cells);
}

/**
 * Thumbnails placed on a grid the application laid out, such as an activation atlas, in square cells that fill the
 * width and leave empty positions empty. Hovering or stepping to a cell shows its label, position and value below, and
 * enlarges nothing. The application supplies every position.
 */
export function ImageAtlas(props: ImageAtlasProps): ReactNode {
  const {
    columns,
    rows,
    cells,
    xLabel,
    yLabel,
    valueLabel = DEFAULT_VALUE_LABEL,
    valueFormat = DEFAULT_VALUE_FORMAT,
    selected,
    onSelectedChange,
    ...figure
  } = props;

  const { emptyLabel = 'No images are available.', ...frame } = figure;
  const { locale, title } = frame;
  const readoutId = useId();

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} />;
  }

  const inputError = atlasInputError({ columns, rows, cells });

  if (inputError !== undefined) {
    return <FigureInvalid {...frame} message={inputError} />;
  }

  const entries = cells.map((cell) => ({
    cell,
    label: imageReadout({
      record: cell,
      position: `Column ${cell.column + 1} of ${columns}, row ${cell.row + 1} of ${rows}`,
      valueLabel,
      locale,
      format: valueFormat,
    }),
  }));

  const items = entries.map((entry) => ({ id: entry.cell.id, label: entry.label }));

  const places = new Map(
    cells.map((cell) => [cell.id, { left: cell.column, top: cell.row, right: cell.column + 1, bottom: cell.row + 1 }]),
  );

  const layoutNote = [
    xLabel === undefined ? undefined : `Left to right: ${xLabel}`,
    yLabel === undefined ? undefined : `Top to bottom: ${yLabel}`,
  ].filter((note) => note !== undefined);

  return (
    <Chart
      items={items}
      place={(id) => places.get(id)}
      selected={selected ?? null}
      onSelect={onSelectedChange}
      render={(figureProps, view) => (
        <FigureFrame
          {...frame}
          figure={figureProps}
          footer={
            <div {...stylex.props(styles.footer)}>
              {layoutNote.length > 0 && <p {...stylex.props(styles.layout)}>{layoutNote.join(' · ')}</p>}
              <ChartReadout id={readoutId}>{inspectedLabel(items, view.inspected)}</ChartReadout>
            </div>
          }
        >
          {cells.length === 0 ? (
            <FigureEmpty>{emptyLabel}</FigureEmpty>
          ) : (
            <>
              <ChartPlot
                role="group"
                aria-label={plotLabel({ title, marks: 'images', isSelectable: onSelectedChange !== undefined })}
                aria-describedby={readoutId}
                {...stylex.props(styles.atlas(columns / rows, columns, rows), stylex.defaultMarker())}
              >
                {entries.map(({ cell, label }) => (
                  <ImageTile
                    key={cell.id}
                    id={cell.id}
                    label={label}
                    src={cell.src}
                    alt={cell.alt}
                    ratio={1}
                    view={view}
                    isSelectable={onSelectedChange !== undefined}
                    place={cell}
                  />
                ))}
              </ChartPlot>
              <ChartData
                label={`${title} cells`}
                columns={[{ id: 'cell', label: 'Cell' }]}
                rows={items.map((item) => ({ id: item.id, values: [item.label] }))}
              />
            </>
          )}
        </FigureFrame>
      )}
    />
  );
}
