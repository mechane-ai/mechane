import * as stylex from '@stylexjs/stylex';
import { useEffect, useEffectEvent, useState } from 'react';
import type { ReactNode } from 'react';
import { chartToneColors } from '../../../../foundations/src/chart-tones.ts';
import { colors } from '../../../../foundations/src/tokens.stylex.ts';
import type { PlotBox } from '../plot-layout.ts';
import { resolveColors, useDrawRevision } from './theme-colors.ts';

export type DensityLayerProps = {
  /** The plot the layer covers. The grid fills its drawing area, inside the axes. */
  readonly box: PlotBox;
  readonly columns: number;
  readonly rows: number;
  /** One value per cell, row by row. Row 0 is the bottom row and column 0 the leftmost. */
  readonly counts: ReadonlyArray<number>;
  /** The value drawn with the full hue. Zero draws nothing; values between draw lighter shades of the same hue. */
  readonly maximum: number;
};

const CHANNELS = 4;
const OPAQUE = 255;

const styles = stylex.create({
  canvas: { position: 'absolute', pointerEvents: 'none', imageRendering: 'pixelated' },
  place: (left: number, top: number) => ({ left, top }),
  size: (width: number, height: number) => ({ width, height }),
});

/**
 * A grid of cell values drawn on one canvas as the lightness of one hue, for a 2D histogram such as `DensityMap`. It
 * draws a 512 by 512 grid in one image copy, matches the matrix heatmap's sequential colors, and follows the theme.
 */
export function DensityLayer({ box, columns, rows, counts, maximum }: DensityLayerProps): ReactNode {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const revision = useDrawRevision(canvas);

  const paint = useEffectEvent((element: HTMLCanvasElement) => {
    const context = element.getContext('2d');

    if (context === null) {
      return;
    }

    const [surface = [0, 0, 0, 0], tone = [0, 0, 0, 0]] = resolveColors(element, [
      colors.surface,
      chartToneColors.series1,
    ]);

    const image = context.createImageData(columns, rows);

    for (const [index, count] of counts.entries()) {
      const share = Math.min(1, count / maximum);
      const row = rows - 1 - Math.floor(index / columns);
      const at = (row * columns + (index % columns)) * CHANNELS;

      image.data[at] = surface[0] + (tone[0] - surface[0]) * share;
      image.data[at + 1] = surface[1] + (tone[1] - surface[1]) * share;
      image.data[at + 2] = surface[2] + (tone[2] - surface[2]) * share;
      image.data[at + CHANNELS - 1] = count > 0 ? OPAQUE : 0;
    }

    element.setAttribute('width', String(columns));
    element.setAttribute('height', String(rows));
    context.putImageData(image, 0, 0);
  });

  useEffect(() => {
    if (canvas !== null) {
      paint(canvas);
    }
  }, [canvas, counts, columns, rows, maximum, revision]);

  return (
    <canvas
      ref={setCanvas}
      aria-hidden
      {...stylex.props(styles.canvas, styles.place(box.left, box.top), styles.size(box.innerWidth, box.innerHeight))}
    />
  );
}
