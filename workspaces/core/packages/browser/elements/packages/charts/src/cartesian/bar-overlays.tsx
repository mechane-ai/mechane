import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { chartToneColors } from '../../../foundations/src/chart-tones.ts';
import { colors } from '../../../foundations/src/tokens.stylex.ts';
import { chartStyles } from '../chart-theme.ts';
import type { BarMarker } from './bar-data.ts';

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

export type PlacedAnnotation = {
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly isReceded: boolean;
};

const styles = stylex.create({
  halo: { stroke: colors.surface, strokeLinecap: 'butt', vectorEffect: 'non-scaling-stroke' },
  stroke: (color: string) => ({ stroke: color, strokeLinecap: 'butt', vectorEffect: 'non-scaling-stroke' }),
});

const TICK_WIDTH_PX = 3;
const STEM_WIDTH_PX = 1;
const RANGE_WIDTH_PX = 1.5;
const HALO_PX = 2;
const TICK_OVERHANG_PX = 3;
const MAX_CAP_WIDTH_PX = 14;
const CHARACTER_WIDTH_PX = 6.5;

function HaloPath({ path, color, width }: { readonly path: string; readonly color: string; readonly width: number }) {
  return (
    <>
      <path d={path} strokeWidth={width + HALO_PX * 2} {...stylex.props(styles.halo)} />
      <path d={path} strokeWidth={width} {...stylex.props(styles.stroke(color))} />
    </>
  );
}

function stemPath({
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
}): string | undefined {
  const value = marker.kind === 'tick' ? (marker.values[index] ?? null) : null;

  if (value === null || base === null || value === base) {
    return undefined;
  }

  const center = span.x + span.width / 2;

  return `M${center},${y(base)} V${y(value)}`;
}

function markerPath({
  marker,
  index,
  span,
  y,
}: {
  readonly marker: BarMarker;
  readonly index: number;
  readonly span: BarSpan;
  readonly y: (value: number) => number;
}): string | undefined {
  if (marker.kind === 'tick') {
    const value = marker.values[index] ?? null;

    if (value === null) {
      return undefined;
    }

    const level = y(value);

    return `M${span.x - TICK_OVERHANG_PX},${level} H${span.x + span.width + TICK_OVERHANG_PX}`;
  }

  const lower = marker.lower[index] ?? null;
  const upper = marker.upper[index] ?? null;

  if (lower === null || upper === null) {
    return undefined;
  }

  const center = span.x + span.width / 2;
  const cap = Math.min(MAX_CAP_WIDTH_PX, span.width * 0.6) / 2;
  const bottom = y(lower);
  const top = y(upper);

  return `M${center - cap},${top} H${center + cap} M${center},${top} V${bottom} M${center - cap},${bottom} H${center + cap}`;
}

/** Draws each marker's tick or whisker over its bar with a surface halo, so it reads on the bar and on the canvas. */
export function BarMarkers({ markers, categoryIds, span, barTop, y, isReceded }: BarMarkersProps): ReactNode {
  return (
    <g>
      {markers.map((marker) => (
        <g key={marker.id}>
          {categoryIds.map((categoryId, index) => {
            const bar = span(categoryId, marker.seriesId);
            const path = markerPath({ marker, index, span: bar, y });

            if (path === undefined) {
              return null;
            }

            const color = chartToneColors[marker.tone ?? 'neutral'];
            const stem = stemPath({ marker, index, span: bar, base: barTop(index, marker.seriesId), y });

            return (
              <g key={categoryId} {...stylex.props(chartStyles.emphasis, isReceded(categoryId) && chartStyles.receded)}>
                {stem !== undefined && <HaloPath path={stem} color={color} width={STEM_WIDTH_PX} />}
                <HaloPath path={path} color={color} width={marker.kind === 'tick' ? TICK_WIDTH_PX : RANGE_WIDTH_PX} />
              </g>
            );
          })}
        </g>
      ))}
    </g>
  );
}

/** Centers each note above its anchor and keeps it inside the plot's horizontal bounds. */
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
      {annotations.map((annotation) => {
        const halfWidth = (annotation.label.length * CHARACTER_WIDTH_PX) / 2;
        const isPastStart = annotation.x - halfWidth < left;
        const isPastEnd = annotation.x + halfWidth > right;
        const anchor = isPastStart ? 'start' : isPastEnd ? 'end' : 'middle';
        const x = isPastStart ? left : isPastEnd ? right : annotation.x;

        return (
          <text
            key={annotation.id}
            x={x}
            y={annotation.y}
            textAnchor={anchor}
            {...stylex.props(
              chartStyles.label,
              chartStyles.strongLabel,
              chartStyles.haloLabel,
              chartStyles.emphasis,
              annotation.isReceded && chartStyles.receded,
            )}
          >
            {annotation.label}
          </text>
        );
      })}
    </g>
  );
}
