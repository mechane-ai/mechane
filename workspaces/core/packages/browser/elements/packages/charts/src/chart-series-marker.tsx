import * as stylex from '@stylexjs/stylex';
import { Children } from 'react';
import type { ReactNode } from 'react';
import { chartToneColors } from '../../foundations/src/chart-tones.ts';
import type { ChartTone } from '../../foundations/src/chart-tones.ts';

const styles = stylex.create({
  root: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  color: (color: string) => ({ color }),
  icon: { width: 16, height: 16 },
  swatch: { width: 8, height: 8, backgroundColor: 'currentColor' },
});

export type ChartSeriesMarkerProps = { readonly tone: ChartTone; readonly children?: ReactNode };

export function ChartSeriesMarker({ tone, children }: ChartSeriesMarkerProps): ReactNode {
  const hasArtwork = Children.toArray(children).length > 0;

  return (
    <span
      aria-hidden
      inert
      {...stylex.props(styles.root, styles.color(chartToneColors[tone]), hasArtwork ? styles.icon : styles.swatch)}
    >
      {children}
    </span>
  );
}
