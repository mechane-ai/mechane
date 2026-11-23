import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { chartStyles } from '../chart-theme.ts';
import { IntervalMark, LabelMark } from '../plot/plot-marks.tsx';
import type { Segment } from '../plot/plot-marks.tsx';
import type { BarMarker } from './bar-data.ts';
import { clearLabels, labelInside } from './value-labels.ts';

/** The horizontal extent of one series' bar within a category. */
export type BarSpan = { readonly x: number; readonly width: number };

type BarMarkersProps = {
  readonly markers: ReadonlyArray<BarMarker>;
  readonly categoryIds: ReadonlyArray<string>;
  readonly span: (categoryId: string, seriesId: string) => BarSpan;
  /** The top of the decorated bar, which a tick's stem joins. Null leaves the tick without a stem. */
  readonly barTop: (categoryIndex: number, seriesId: string) => number | null;
  readonly y: (value: number) => number;
  readonly isReceded: (categoryId: string) => boolean;
};

/** A note above one bar, positioned in plot pixels. */
export type PlacedAnnotation = {
  readonly id: string;
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly isReceded: boolean;
};

const TICK_OVERHANG = 3;
const CAP_WIDTH_MAX = 14;
const CAP_SHARE = 0.6;
const HALF = 0.5;

/** The segments one marker draws on one bar: a tick with its stem from the bar, or a whisker with two caps. */
function markerSegments({
  marker,
  index,
  span,
  base,
  y,
}: {
  readonly marker: BarMarker;
  readonly index: number;
  readonly span: BarSpan;
  readonly base: number | null;
  readonly y: (value: number) => number;
}): ReadonlyArray<Segment & { readonly key: string }> {
  const center = span.x + span.width * HALF;

  if (marker.kind === 'tick') {
    const value = marker.values[index] ?? null;

    if (value === null) {
      return [];
    }

    const tick = {
      key: 'tick',
      x1: span.x - TICK_OVERHANG,
      x2: span.x + span.width + TICK_OVERHANG,
      y1: y(value),
      y2: y(value),
    };

    const hasStem = base !== null && base !== value;

    return hasStem ? [{ key: 'stem', x1: center, x2: center, y1: y(base), y2: y(value) }, tick] : [tick];
  }

  const lower = marker.lower[index] ?? null;
  const upper = marker.upper[index] ?? null;

  if (lower === null || upper === null) {
    return [];
  }

  const cap = Math.min(CAP_WIDTH_MAX, span.width * CAP_SHARE) * HALF;

  return [
    { key: 'whisker', x1: center, x2: center, y1: y(lower), y2: y(upper) },
    { key: 'upper', x1: center - cap, x2: center + cap, y1: y(upper), y2: y(upper) },
    { key: 'lower', x1: center - cap, x2: center + cap, y1: y(lower), y2: y(lower) },
  ];
}

/** Draws each marker's tick or whisker over its bar, on the value axis rather than the stack. */
export function BarMarkers({ markers, categoryIds, span, barTop, y, isReceded }: BarMarkersProps): ReactNode {
  return (
    <g>
      {markers.map((marker) => (
        <g key={marker.id}>
          {categoryIds.map((categoryId, index) => {
            const segments = markerSegments({
              marker,
              index,
              span: span(categoryId, marker.seriesId),
              base: barTop(index, marker.seriesId),
              y,
            });

            return (
              <g key={categoryId} {...stylex.props(chartStyles.emphasis, isReceded(categoryId) && chartStyles.receded)}>
                {segments.map(({ key, ...segment }) => (
                  <IntervalMark key={key} {...segment} tone={marker.tone ?? 'neutral'} />
                ))}
              </g>
            );
          })}
        </g>
      ))}
    </g>
  );
}

/**
 * Notes above their bars, kept inside the plot's horizontal bounds. Where notes would touch, as on a narrow plot, the
 * later ones are left out of the plot; they stay in the readout and the exact values.
 */
export function BarAnnotations({
  annotations,
  left,
  right,
}: {
  readonly annotations: ReadonlyArray<PlacedAnnotation>;
  readonly left: number;
  readonly right: number;
}): ReactNode {
  return (
    <g aria-hidden>
      {clearLabels(annotations).map((annotation) => {
        const placed = labelInside({ x: annotation.x, text: annotation.text, left, right });

        return (
          <g key={annotation.id} {...stylex.props(chartStyles.emphasis, annotation.isReceded && chartStyles.receded)}>
            <LabelMark x={placed.x} y={annotation.y} anchor={placed.anchor}>
              {annotation.text}
            </LabelMark>
          </g>
        );
      })}
    </g>
  );
}
