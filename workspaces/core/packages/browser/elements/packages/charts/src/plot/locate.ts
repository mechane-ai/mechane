import type { ChartPoint } from '../chart.tsx';

/** Where a mark sits in the plot's drawn pixels. */
export type MarkPosition = { readonly id: string; readonly x: number; readonly y: number };

/**
 * A chart `locate` for marks at known positions: the pointer inspects the nearest one. The `axis` option limits the
 * distance to one direction, for marks a reader scans along a single axis such as the steps of a curve.
 */
export function locateNearest({
  marks,
  width,
  height,
  axis = 'both',
}: {
  readonly marks: ReadonlyArray<MarkPosition>;
  /** The size the marks were laid out in. The pointer arrives in rendered pixels and is rescaled to it. */
  readonly width: number;
  readonly height: number;
  readonly axis?: 'x' | 'y' | 'both' | undefined;
}): (point: ChartPoint) => string | undefined {
  return (point) => {
    const x = (point.x / point.width) * width;
    const y = (point.y / point.height) * height;

    const distances = marks.map((mark) => {
      const dx = axis === 'y' ? 0 : mark.x - x;
      const dy = axis === 'x' ? 0 : mark.y - y;

      return dx * dx + dy * dy;
    });

    const nearest = distances.indexOf(Math.min(...distances));

    return marks[nearest]?.id;
  };
}
