import * as stylex from '@stylexjs/stylex';
import { Children } from 'react';
import type { ReactNode } from 'react';
import { chartToneColors, chartToneOutlines } from '../../foundations/src/chart-tones.ts';
import type { ChartTone } from '../../foundations/src/chart-tones.ts';

const styles = stylex.create({
  root: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  color: (color: string) => ({ color }),
  icon: { width: 16, height: 16 },
  swatch: { width: 8, height: 8, backgroundColor: 'currentColor' },
  edge: (outline: string) => ({ boxShadow: `inset 0 0 0 1px ${outline}` }),
  transparent: { backgroundColor: 'transparent' },
  glyph: { display: 'block', width: 8, height: 8, overflow: 'visible' },
});

/**
 * The mark a legend entry stands for. A swatch is a filled area or bar, a line a drawn series, and a band a translucent
 * range with its center. A tick is one value on a bar, a range a whisker, and dashed a reference line.
 */
export type ChartMarkShape = 'swatch' | 'line' | 'band' | 'tick' | 'range' | 'dashed';

export type ChartSeriesMarkerProps = {
  readonly tone: ChartTone;
  /** Draws the shared glyph for this mark; supplied artwork replaces it. Absent means the square swatch. */
  readonly shape?: ChartMarkShape | undefined;
  readonly children?: ReactNode;
};

const GLYPH_SIZE = 8;
const BAND_OPACITY = 0.3;

function ChartMarkGlyph({ shape }: { readonly shape: Exclude<ChartMarkShape, 'swatch'> }): ReactNode {
  switch (shape) {
    case 'line':
      return <path d="M0 4 H8" stroke="currentColor" strokeWidth={2} />;
    case 'band':
      return (
        <>
          <rect width={8} height={8} fill="currentColor" opacity={BAND_OPACITY} />
          <path d="M0 4 H8" stroke="currentColor" strokeWidth={1.5} />
        </>
      );
    case 'tick':
      return <path d="M0 4 H8" stroke="currentColor" strokeWidth={3} />;
    case 'range':
      return (
        <path d="M1.5 0.75 H6.5 M4 0.75 V7.25 M1.5 7.25 H6.5" stroke="currentColor" strokeWidth={1.5} fill="none" />
      );
    case 'dashed':
      return <path d="M0 4 H3 M5 4 H8" stroke="currentColor" strokeWidth={1.5} />;
  }
}

export function ChartSeriesMarker({ tone, shape = 'swatch', children }: ChartSeriesMarkerProps): ReactNode {
  const hasArtwork = Children.toArray(children).length > 0;
  const hasGlyph = !hasArtwork && shape !== 'swatch';

  const artwork =
    hasArtwork || shape === 'swatch' ? (
      children
    ) : (
      <svg
        width={GLYPH_SIZE}
        height={GLYPH_SIZE}
        viewBox={`0 0 ${GLYPH_SIZE} ${GLYPH_SIZE}`}
        focusable="false"
        {...stylex.props(styles.glyph)}
      >
        <ChartMarkGlyph shape={shape} />
      </svg>
    );

  return (
    <span
      aria-hidden
      inert
      {...stylex.props(
        styles.root,
        styles.color(chartToneColors[tone]),
        hasArtwork ? styles.icon : styles.swatch,
        hasGlyph && styles.transparent,
        !hasArtwork && !hasGlyph && styles.edge(chartToneOutlines[tone]),
      )}
    >
      {artwork}
    </span>
  );
}
