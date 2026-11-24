import type { ReactNode } from 'react';
import { plotHeights } from '../../../../charts/src/index.ts';
import type { NumericDomain, PlotAxis, ValueFormat } from '../../../../charts/src/index.ts';
import { axisTicks, PlotAxes, plotMargins, RuleMark, tickTexts } from '../../../../charts/src/plot/index.ts';
import type { AxisTicks, PlotGrid, PlotTick } from '../../../../charts/src/plot/index.ts';
import { useSceneContext, useSceneObject } from '../scene-context.ts';
import { SceneOutside } from '../scene-layer.tsx';
import { useObstacle } from '../scene-obstacles.ts';
import { PlaneMarks } from './plane-hit.tsx';

/** One axis of the plane: its title, how its numbers are written, and where its ticks fall. */
export type SceneAxis = {
  /** The axis title, with its unit: "Weight (kg)". Left out, the axis has no title. */
  readonly label?: string | undefined;
  /** How tick labels write a number. Defaults to at most two decimals. */
  readonly format?: ValueFormat | undefined;
  /** The values that get a tick. Left out, round values are chosen from the part of the box the camera shows. */
  readonly ticks?: ReadonlyArray<number> | undefined;
};

export type SceneAxesProps = {
  /** Defaults to `axes`. */
  readonly id?: string | undefined;
  /** The horizontal axis, along the bottom of the box. */
  readonly x?: SceneAxis | undefined;
  /** The vertical axis, along the left of the box. */
  readonly y?: SceneAxis | undefined;
  /** Which ticks draw a line across the plot. Defaults to `y`, horizontal lines, as in a chart. */
  readonly grid?: PlotGrid | undefined;
  /** False fades the axes out and gives their room back to the box. */
  readonly isShown?: boolean | undefined;
};

const defaultFormat: ValueFormat = { maximumFractionDigits: 2 };
const X_SPACING = 96;
const Y_SPACING = 56;
const gutterHeights = [plotHeights.compact, plotHeights.tall];

function plotAxis(axis: SceneAxis | undefined): PlotAxis {
  return { label: axis?.label ?? '', format: axis?.format ?? defaultFormat };
}

type TicksInput = {
  readonly axis: SceneAxis | undefined;
  readonly domain: NumericDomain;
  readonly length: number;
  readonly spacing: number;
  readonly locale: string;
};

function ticksOf({ axis, domain, length, spacing, locale }: TicksInput): AxisTicks {
  const hasTitle = axis?.label !== undefined;
  const measured = plotAxis(axis);

  if (axis?.ticks === undefined) {
    return axisTicks({ axis: measured, domain, length, spacing, locale, hasTitle });
  }

  const values = axis.ticks.filter((value) => value >= domain[0] && value <= domain[1]);

  return { values, labels: tickTexts({ values, axis: measured, locale, hasTitle }) };
}

function placed(ticks: AxisTicks, position: (value: number) => number): ReadonlyArray<PlotTick> {
  return ticks.values.map((value, index) => ({
    key: String(value),
    position: position(value),
    label: ticks.labels[index] ?? '',
  }));
}

/**
 * The x and y axes of the scene's data box: ticks, titles and grid lines drawn with the parts a chart uses. The scene
 * keeps room for the tick labels and titles beside the box, and the ticks follow the camera. Put it first in the
 * scene.
 */
export function SceneAxes({ id = 'axes', x, y, grid = 'y', isShown = true }: SceneAxesProps): ReactNode {
  const scene = useSceneContext();
  const { box, view, domain, locale } = scene;
  const hasXTitle = x?.label !== undefined;
  const hasYTitle = y?.label !== undefined;

  const valueLabels = gutterHeights.flatMap(
    (length) => ticksOf({ axis: y, domain: domain.y, length, spacing: Y_SPACING, locale }).labels,
  );

  const object = useSceneObject({
    id,
    kind: 'axes',
    values: {},
    margins: plotMargins({ width: box.width, valueLabels, hasXTitle, hasYTitle }),
    isShown,
  });

  const [left, right] = domain.x;
  const [bottom, top] = domain.y;
  const hasZeroX = left < 0 && right > 0;
  const hasZeroY = bottom < 0 && top > 0;

  useObstacle({
    id: `${id}:zero-x`,
    line: hasZeroX
      ? [
          { x: 0, y: bottom },
          { x: 0, y: top },
        ]
      : [],
  });

  useObstacle({
    id: `${id}:zero-y`,
    line: hasZeroY
      ? [
          { x: left, y: 0 },
          { x: right, y: 0 },
        ]
      : [],
  });

  if (!scene.isInScene) {
    return <SceneOutside part="SceneAxes" />;
  }

  if (!object.isVisible) {
    return null;
  }

  const xTicks = ticksOf({ axis: x, domain: [view.x0, view.x1], length: box.innerWidth, spacing: X_SPACING, locale });
  const yTicks = ticksOf({ axis: y, domain: [view.y0, view.y1], length: box.innerHeight, spacing: Y_SPACING, locale });
  const hasOriginX = view.x0 < 0 && view.x1 > 0;
  const hasOriginY = view.y0 < 0 && view.y1 > 0;

  return (
    <PlaneMarks id={id} layer="back" opacity={object.values.opacity}>
      <PlotAxes
        box={box}
        xTicks={placed(xTicks, scene.x.position)}
        yTicks={placed(yTicks, scene.y.position)}
        xTitle={x?.label}
        yTitle={y?.label}
        grid={grid}
      />
      {hasOriginX && <RuleMark x1={scene.x.position(0)} x2={scene.x.position(0)} y1={box.top} y2={box.bottom} />}
      {hasOriginY && <RuleMark x1={box.left} x2={box.right} y1={scene.y.position(0)} y2={scene.y.position(0)} />}
    </PlaneMarks>
  );
}
