/** A vertex of a line. A null `y` is a missing observation: the line breaks there and is never drawn through it. */
export type PathPoint = { readonly x: number; readonly y: number | null };

/** A vertex of a filled region between two edges. A null edge breaks the region. */
export type AreaPoint = { readonly x: number; readonly y0: number | null; readonly y1: number | null };

type Vertex = { readonly x: number; readonly y: number };

/** How neighbors join: a straight segment, or a step that holds each value until the next observation. */
export type PathCurve = 'linear' | 'step';

const PRECISION = 100;

function coordinate(value: number): string {
  return String(Math.round(value * PRECISION) / PRECISION);
}

function vertex(point: Vertex): string {
  return `${coordinate(point.x)},${coordinate(point.y)}`;
}

/** The stretches of neighboring present points, in order. */
function runs<Point>(
  points: ReadonlyArray<Point>,
  isPresent: (point: Point) => boolean,
): ReadonlyArray<ReadonlyArray<Point>> {
  const starts = points.flatMap((point, index) => {
    const previous = points[index - 1];
    const isStart = isPresent(point) && (previous === undefined || !isPresent(previous));

    return isStart ? [index] : [];
  });

  return starts.map((start) => {
    const end = points.findIndex((point, index) => index > start && !isPresent(point));

    return points.slice(start, end === -1 ? undefined : end);
  });
}

function trace(vertices: ReadonlyArray<Vertex>, curve: PathCurve): string {
  return vertices
    .map((point, index) => {
      const previous = vertices[index - 1];

      if (previous === undefined) {
        return vertex(point);
      }

      return curve === 'step' ? `H${coordinate(point.x)}V${coordinate(point.y)}` : `L${vertex(point)}`;
    })
    .join('');
}

function present(points: ReadonlyArray<PathPoint>): ReadonlyArray<ReadonlyArray<Vertex>> {
  return runs(points, (point) => point.y !== null).map((run) =>
    run.flatMap((point) => (point.y === null ? [] : [{ x: point.x, y: point.y }])),
  );
}

/** The SVG path of a line through the present points, broken at each missing one. */
export function linePath(points: ReadonlyArray<PathPoint>, curve: PathCurve = 'linear'): string {
  return present(points)
    .filter((run) => run.length > 1)
    .map((run) => `M${trace(run, curve)}`)
    .join('');
}

/** The present points with a missing or absent neighbor on both sides. A line cannot show them, so charts draw dots. */
export function isolatedPoints(points: ReadonlyArray<PathPoint>): ReadonlyArray<Vertex> {
  return present(points).flatMap((run) => (run.length === 1 ? run : []));
}

/** The SVG path of the region between two edges, joined by straight segments and broken where an edge is missing. */
export function areaPath(points: ReadonlyArray<AreaPoint>): string {
  return runs(points, (point) => point.y0 !== null && point.y1 !== null)
    .map((run) => {
      const upper = run.flatMap((point) => (point.y1 === null ? [] : [{ x: point.x, y: point.y1 }]));
      const lower = run.flatMap((point) => (point.y0 === null ? [] : [{ x: point.x, y: point.y0 }])).toReversed();

      return `M${trace(upper, 'linear')}L${trace(lower, 'linear')}Z`;
    })
    .join('');
}

/** How a link joins two marks: a smooth curve, or right-angled elbows that turn halfway along. */
export type LinkShape = 'curve' | 'elbow';

type Segment = { readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number };

export type LinkPathInput = Segment & {
  /** The axis the link advances along, from its source to its target: `y` for a link that runs up or down. */
  readonly axis: 'x' | 'y';
  readonly shape?: LinkShape | undefined;
};

const MIDDLE = 0.5;

/** The SVG path of a link from one mark to another, such as a graph edge or a tree branch. */
export function linkPath({ x1, y1, x2, y2, axis, shape = 'curve' }: LinkPathInput): string {
  const start = vertex({ x: x1, y: y1 });
  const end = vertex({ x: x2, y: y2 });

  if (axis === 'y') {
    const middle = coordinate(y1 + (y2 - y1) * MIDDLE);

    return shape === 'elbow'
      ? `M${start}V${middle}H${coordinate(x2)}V${coordinate(y2)}`
      : `M${start}C${coordinate(x1)},${middle} ${coordinate(x2)},${middle} ${end}`;
  }

  const middle = coordinate(x1 + (x2 - x1) * MIDDLE);

  return shape === 'elbow'
    ? `M${start}H${middle}V${coordinate(y2)}H${coordinate(x2)}`
    : `M${start}C${middle},${coordinate(y1)} ${middle},${coordinate(y2)} ${end}`;
}
