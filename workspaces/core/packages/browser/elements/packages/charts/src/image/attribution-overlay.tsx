import * as stylex from '@stylexjs/stylex';
import { useId, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { Slider } from '../../../forms/src/index.ts';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { ChartData } from '../chart-data.tsx';
import { ChartReadout } from '../chart-frame.tsx';
import { chartStyles } from '../chart-theme.ts';
import { Chart, ChartPlot, inspectedLabel, plotLabel } from '../chart.tsx';
import { formatValue } from '../figure/figure-format.ts';
import type { ValueFormat } from '../figure/figure-format.ts';
import { FigureEmpty, FigureFrame, FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps } from '../figure/figure-props.ts';
import { outsideDomain, scaleDomainError } from '../plot/scale.ts';
import type { NumericDomain } from '../plot/scale.ts';
import { AttributionLegend } from './attribution-legend.tsx';
import { attributionColor, attributionScaleError } from './attribution-ramp.ts';
import type { AttributionPalette } from './attribution-ramp.ts';
import { ImageFill } from './image-fill.tsx';

/** The picture under the overlay. Its size sets the shape of the figure. */
export type AttributionImage = {
  readonly src: string;
  /** What the picture shows. Assistive technology reads it with the figure. */
  readonly alt: string;
  /** The picture's size in pixels. Only their ratio is used. */
  readonly width: number;
  readonly height: number;
};

/** Values on a grid of `columns` by `rows`, listed row by row from the top left. A null value is an empty cell. */
export type AttributionGrid = {
  readonly columns: number;
  readonly rows: number;
  readonly values: ReadonlyArray<number | null>;
};

type SliderDetails = Parameters<NonNullable<ComponentProps<typeof Slider.Root<number>>['onValueChange']>>[1];

/** Why the overlay strength changed: a press on the slider track, a drag or a key. */
export type AttributionOpacityDetails = SliderDetails;

export type AttributionOverlayProps = FigureProps & {
  readonly image: AttributionImage;
  readonly grid: AttributionGrid;
  /** What the values measure, such as "Saliency". It names the legend. */
  readonly valueLabel: string;
  readonly valueFormat: ValueFormat;
  /** The values the colors span. Every value must lie inside it. */
  readonly domain: NumericDomain;
  /** `sequential` for values from low to high. `diverging` for signed values, with zero as the neutral. */
  readonly palette: AttributionPalette;
  /** How strongly the overlay covers the picture, from 0 to 1. It never encodes a value. */
  readonly opacity?: number | undefined;
  /** Hears the reader's change of overlay strength. Without it, the figure keeps the strength itself. */
  readonly onOpacityChange?: ((opacity: number, details: AttributionOpacityDetails) => void) | undefined;
};

export const attributionOverlayLimits = { columns: 64, rows: 64 } as const;

const OPACITY_DEFAULT = 0.6;
const OPACITY_STEP = 0.05;
const OPACITY_FORMAT = { style: 'percent', maximumFractionDigits: 0 } as const;
/** The widest the picture, its color key and the strength control draw, one width for all three. */
const OVERLAY_WIDTH_MAX_PX = 640;

const styles = stylex.create({
  plot: (ratio: number) => ({
    position: 'relative',
    width: '100%',
    maxWidth: OVERLAY_WIDTH_MAX_PX,
    minWidth: 0,
    overflow: 'hidden',
    aspectRatio: ratio,
    backgroundColor: colors.canvas,
  }),
  layer: { position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%', pointerEvents: 'none' },
  hollow: {
    fill: 'none',
    stroke: colors.ink,
    strokeWidth: 1,
    strokeDasharray: '2 2',
    vectorEffect: 'non-scaling-stroke',
  },
  footer: { display: 'grid', gap: spacing.md, minWidth: 0 },
  controls: { display: 'grid', gap: spacing.md, maxWidth: OVERLAY_WIDTH_MAX_PX },
  title: { display: 'flex', justifyContent: 'space-between', gap: spacing.md },
  note: { margin: 0, color: colors.muted, fontSize: typography.captionSize, lineHeight: typography.captionLineHeight },
});

function overlayInputError({
  image,
  grid,
  domain,
  palette,
  opacity,
}: Pick<AttributionOverlayProps, 'image' | 'grid' | 'domain' | 'palette' | 'opacity'>): string | undefined {
  const isImageSized = [image.width, image.height].every((size) => Number.isFinite(size) && size > 0);

  if (!isImageSized || image.alt.trim() === '') {
    return 'The image needs a positive width and height and alt text that says what it shows.';
  }

  const { columns, rows, values } = grid;

  if (![columns, rows].every((count) => Number.isInteger(count) && count >= 1)) {
    return 'The grid needs a whole number of columns and rows, at least 1 each.';
  }

  if (columns > attributionOverlayLimits.columns || rows > attributionOverlayLimits.rows) {
    return `This overlay draws at most ${attributionOverlayLimits.columns} by ${attributionOverlayLimits.rows} cells. Supply a coarser grid.`;
  }

  if (values.length !== columns * rows) {
    return `The grid needs ${columns * rows} values for ${columns} columns and ${rows} rows, and has ${values.length}.`;
  }

  if (opacity !== undefined && !(opacity >= 0 && opacity <= 1)) {
    return 'The overlay strength must be between 0 and 1.';
  }

  const domainError = scaleDomainError(domain) ?? attributionScaleError({ domain, palette });

  if (domainError !== undefined) {
    return domainError;
  }

  if (values.some((value) => value !== null && outsideDomain(value, domain))) {
    return 'A value is not finite or lies outside the declared domain.';
  }

  return undefined;
}

/**
 * A picture with a grid of values laid over it, such as a saliency or attention map over image patches. Each cell is
 * colored by its value, and the reader sets how strongly the overlay covers the picture. A cell with no value is
 * hollow, and the application supplies the picture, the values and the color domain.
 */
export function AttributionOverlay(props: AttributionOverlayProps): ReactNode {
  const { image, grid, valueLabel, valueFormat, domain, palette, opacity, onOpacityChange, ...figure } = props;
  const { emptyLabel = 'No values are available.', ...frame } = figure;
  const { locale, title } = frame;
  const [ownOpacity, setOwnOpacity] = useState(opacity ?? OPACITY_DEFAULT);
  const readoutId = useId();

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} />;
  }

  const inputError = overlayInputError({ image, grid, domain, palette, opacity });

  if (inputError !== undefined) {
    return <FigureInvalid {...frame} message={inputError} />;
  }

  const { columns, rows, values } = grid;
  const strength = onOpacityChange === undefined ? ownOpacity : (opacity ?? OPACITY_DEFAULT);
  const scale = { domain, palette };

  function text(value: number | null): string {
    return formatValue({ value, locale, format: valueFormat });
  }

  const cells = values.map((value, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;

    return {
      id: `${row},${column}`,
      row,
      column,
      value,
      label: `Row ${row + 1}, column ${column + 1}: ${text(value)}`,
    };
  });

  const hasHollow = values.some((value) => value === null);

  function locate(point: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }) {
    const column = Math.min(columns - 1, Math.max(0, Math.floor((point.x / point.width) * columns)));
    const row = Math.min(rows - 1, Math.max(0, Math.floor((point.y / point.height) * rows)));

    return `${row},${column}`;
  }

  return (
    <Chart
      items={cells}
      columns={columns}
      locate={locate}
      render={(figureProps, view) => {
        const inspected = cells.find((cell) => cell.id === view.inspected);
        const cursor = cells.find((cell) => cell.id === view.cursor);

        return (
          <FigureFrame
            {...frame}
            figure={figureProps}
            scaleLegend={
              values.length === 0 ? undefined : (
                <AttributionLegend
                  label={valueLabel}
                  domain={domain}
                  palette={palette}
                  ends={{ low: text(domain[0]), high: text(domain[1]), zero: text(0) }}
                />
              )
            }
            footer={
              <div {...stylex.props(styles.footer)}>
                <div {...stylex.props(styles.controls)}>
                  <Slider.Root<number>
                    locale={locale}
                    value={strength}
                    onValueChange={(next, details) => {
                      if (onOpacityChange === undefined) {
                        setOwnOpacity(next);
                      } else {
                        onOpacityChange(next, details);
                      }
                    }}
                    min={0}
                    max={1}
                    step={OPACITY_STEP}
                    format={OPACITY_FORMAT}
                  >
                    <div {...stylex.props(styles.title)}>
                      <Slider.Label>Overlay strength</Slider.Label>
                      <Slider.Value />
                    </div>
                    <Slider.Control>
                      <Slider.Track>
                        <Slider.Indicator />
                      </Slider.Track>
                      <Slider.Thumb />
                    </Slider.Control>
                  </Slider.Root>
                </div>
                {hasHollow && <p {...stylex.props(styles.note)}>Dashed cells have no value.</p>}
                <ChartReadout id={readoutId}>{inspectedLabel(cells, view.inspected)}</ChartReadout>
              </div>
            }
          >
            {values.length === 0 ? (
              <FigureEmpty>{emptyLabel}</FigureEmpty>
            ) : (
              <>
                <ChartPlot
                  role="group"
                  aria-label={plotLabel({ title, marks: 'cells', isSelectable: false })}
                  aria-describedby={readoutId}
                  {...stylex.props(styles.plot(image.width / image.height), stylex.defaultMarker())}
                >
                  <ImageFill src={image.src} alt={image.alt} />
                  <svg
                    aria-hidden
                    viewBox={`0 0 ${columns} ${rows}`}
                    preserveAspectRatio="none"
                    {...stylex.props(styles.layer)}
                  >
                    <g opacity={strength} shapeRendering="crispEdges">
                      {cells.map((cell) =>
                        cell.value === null ? null : (
                          <rect
                            key={cell.id}
                            x={cell.column}
                            y={cell.row}
                            width={1}
                            height={1}
                            fill={attributionColor(cell.value, scale)}
                          />
                        ),
                      )}
                    </g>
                    {cells.map((cell) =>
                      cell.value === null ? (
                        <rect
                          key={cell.id}
                          x={cell.column}
                          y={cell.row}
                          width={1}
                          height={1}
                          {...stylex.props(styles.hollow)}
                        />
                      ) : null,
                    )}
                    {inspected !== undefined && (
                      <rect
                        x={inspected.column}
                        y={inspected.row}
                        width={1}
                        height={1}
                        fill="none"
                        {...stylex.props(chartStyles.inspected)}
                      />
                    )}
                    {cursor !== undefined && (
                      <rect
                        x={cursor.column}
                        y={cursor.row}
                        width={1}
                        height={1}
                        fill="none"
                        {...stylex.props(chartStyles.shapeCursor)}
                      />
                    )}
                  </svg>
                </ChartPlot>
                <ChartData
                  label={`${title} cells`}
                  columns={[
                    { id: 'cell', label: 'Cell' },
                    { id: 'value', label: valueLabel },
                  ]}
                  rows={cells.map((cell) => ({
                    id: cell.id,
                    values: [`Row ${cell.row + 1}, column ${cell.column + 1}`, text(cell.value)],
                  }))}
                />
              </>
            )}
          </FigureFrame>
        );
      }}
    />
  );
}
