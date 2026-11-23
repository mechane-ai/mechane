import * as stylex from '@stylexjs/stylex';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { ChartData } from '../chart-data.tsx';
import { ChartReadout } from '../chart-frame.tsx';
import { Chart, ChartPlot, inspectedLabel, plotLabel } from '../chart.tsx';
import { formatValue } from '../figure/figure-format.ts';
import type { ValueFormat } from '../figure/figure-format.ts';
import { FigureEmpty, FigureFrame, FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps, FigureSelectionProps } from '../figure/figure-props.ts';
import { usePlotWidth } from '../plot-width.ts';
import { imageReadout, imageRecordError } from './image-input.ts';
import type { ImageRecord } from './image-input.ts';
import { ImageTile } from './image-tile.tsx';

/** One image in the grid, in the rank the application gives it. */
export type ImageGridItem = ImageRecord;

export type ImageGridProps = FigureProps &
  FigureSelectionProps & {
    /** The images in the order to show them, best first. The grid never reorders them. */
    readonly items: ReadonlyArray<ImageGridItem>;
    /** What each value measures, such as "Activation". It names the value in the readout. */
    readonly valueLabel?: string | undefined;
    readonly valueFormat?: ValueFormat | undefined;
    /** How many tiles sit in a row. Leave it out to fit as many as the width allows. */
    readonly columns?: number | undefined;
    /** Tile width divided by tile height. Every tile has the same one, so nothing moves as images load. */
    readonly aspectRatio?: number | undefined;
  };

export const imageGridLimits = { items: 200 } as const;

const DEFAULT_VALUE_LABEL = 'Value';
const DEFAULT_VALUE_FORMAT: ValueFormat = { maximumFractionDigits: 2 };
const TILE_WIDTH_MIN = 112;
const TILE_GAP = 12;
const RATIO_DEFAULT = 1;

const styles = stylex.create({
  grid: (columns: number) => ({
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    columnGap: spacing.md,
    rowGap: spacing.lg,
    minWidth: 0,
    padding: spacing.xs,
    outlineStyle: 'none',
    listStyle: 'none',
    margin: 0,
  }),
  cell: { display: 'grid', gap: spacing.xs, minWidth: 0, alignContent: 'start' },
  caption: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: spacing.sm,
    minWidth: 0,
    color: colors.ink,
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    fontVariantNumeric: 'tabular-nums',
  },
  name: { minWidth: 0, overflow: 'hidden', color: colors.muted, textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  number: { flexShrink: 0, marginInlineStart: 'auto' },
});

function gridInputError({ items, columns, aspectRatio }: Pick<ImageGridProps, 'items' | 'columns' | 'aspectRatio'>) {
  if (items.length > imageGridLimits.items) {
    return `This grid shows at most ${imageGridLimits.items} images. Supply the top ranked ones.`;
  }

  if (columns !== undefined && (!Number.isInteger(columns) || columns < 1)) {
    return 'The column count must be a whole number of at least 1.';
  }

  if (aspectRatio !== undefined && !(Number.isFinite(aspectRatio) && aspectRatio > 0)) {
    return 'The aspect ratio must be a finite number above zero.';
  }

  return imageRecordError(items);
}

/**
 * A ranked grid of image tiles, such as the dataset examples that most activate a feature. Tiles keep the supplied
 * order, each with its value beneath it, so use it when a reader needs to see what the images have in common. The
 * application supplies the images, their alt text, their order and their values.
 */
export function ImageGrid(props: ImageGridProps): ReactNode {
  const {
    items,
    valueLabel = DEFAULT_VALUE_LABEL,
    valueFormat = DEFAULT_VALUE_FORMAT,
    columns,
    aspectRatio = RATIO_DEFAULT,
    selected,
    onSelectedChange,
    ...figure
  } = props;

  const { emptyLabel = 'No images are available.', ...frame } = figure;
  const { locale, title } = frame;
  const readoutId = useId();
  const { ref, width } = usePlotWidth();

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} />;
  }

  const inputError = gridInputError({ items, columns, aspectRatio });

  if (inputError !== undefined) {
    return <FigureInvalid {...frame} message={inputError} />;
  }

  const fitted = Math.max(1, Math.floor((width + TILE_GAP) / (TILE_WIDTH_MIN + TILE_GAP)));
  const rowLength = columns ?? fitted;

  const entries = items.map((item) => ({
    item,
    label: imageReadout({ record: item, valueLabel, locale, format: valueFormat }),
    hasCaption: item.label !== undefined || item.value !== undefined,
  }));

  const chartItems = entries.map((entry) => ({ id: entry.item.id, label: entry.label }));

  return (
    <Chart
      items={chartItems}
      columns={rowLength}
      selected={selected ?? null}
      onSelect={onSelectedChange}
      render={(figureProps, view) => (
        <FigureFrame
          {...frame}
          figure={figureProps}
          footer={<ChartReadout id={readoutId}>{inspectedLabel(chartItems, view.inspected)}</ChartReadout>}
        >
          {items.length === 0 ? (
            <FigureEmpty>{emptyLabel}</FigureEmpty>
          ) : (
            <>
              <ChartPlot
                ref={ref}
                role="group"
                aria-label={plotLabel({ title, marks: 'images', isSelectable: onSelectedChange !== undefined })}
                aria-describedby={readoutId}
                {...stylex.props(styles.grid(rowLength), stylex.defaultMarker())}
              >
                {entries.map(({ item, label, hasCaption }) => (
                  <div key={item.id} {...stylex.props(styles.cell)}>
                    <ImageTile
                      id={item.id}
                      label={label}
                      src={item.src}
                      alt={item.alt}
                      ratio={aspectRatio}
                      view={view}
                      isSelectable={onSelectedChange !== undefined}
                    />
                    {hasCaption && (
                      <div aria-hidden {...stylex.props(styles.caption)}>
                        {item.label === undefined ? null : (
                          <span title={item.label} {...stylex.props(styles.name)}>
                            {item.label}
                          </span>
                        )}
                        {item.value === undefined ? null : (
                          <span {...stylex.props(styles.number)}>
                            {formatValue({ value: item.value, locale, format: valueFormat })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </ChartPlot>
              <ChartData
                label={`${title} images`}
                columns={[{ id: 'image', label: 'Image' }]}
                rows={chartItems.map((item) => ({ id: item.id, values: [item.label] }))}
              />
            </>
          )}
        </FigureFrame>
      )}
    />
  );
}
