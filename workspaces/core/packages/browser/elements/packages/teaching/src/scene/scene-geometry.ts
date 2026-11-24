import type { NumericDomain } from '../../../charts/src/index.ts';
import type { PlotMargins } from '../../../charts/src/plot/index.ts';

/** The outline of a node: a box, a pill, a circle, or text with no outline. Wires attach at this outline. */
export type SceneShape = 'box' | 'pill' | 'circle' | 'plain';

/** A named node size. Each is a fixed pixel box that fits a short label, so layout never depends on measuring. */
export type SceneSizeName = 'small' | 'medium' | 'large';

/** A node size by name, or an exact box in CSS pixels. */
export type SceneSize = SceneSizeName | { readonly width: number; readonly height: number };

/** A position in the scene's data units, as `[x, y]`. */
export type ScenePosition = readonly [across: number, up: number];

/** A position in data units, with named parts. */
export type SceneDataPoint = { readonly x: number; readonly y: number };

/** A data box in data units on each axis. */
type SceneDomain = { readonly x: NumericDomain; readonly y: NumericDomain };

/** A shift in CSS pixels from a data position: across to the right, then down. */
export type SceneOffset = readonly [across: number, down: number];

/**
 * Where an object sits: its center in data units, an optional shift in pixels from there, and its size in pixels. A
 * part that lays objects out in pixels, such as a pile of cards, shifts each from one data position.
 */
export type SceneFrame = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly offset?: SceneOffset | undefined;
  /**
   * What the object draws outside its box, in pixels per side, such as a caption or row labels. The scene makes room
   * for it, and wires still meet the box.
   */
  readonly outset?: SceneMargins | undefined;
};

/** The room an object needs outside the data box, in pixels per side, such as the tick labels of an axis. */
export type SceneMargins = Partial<PlotMargins>;

/** A rectangle in the plot's CSS pixels, measured from its top left corner. */
export type SceneRect = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
};

/** A point in the plot's CSS pixels. */
export type ScenePixel = { readonly x: number; readonly y: number };

/** The part of the data box the camera shows. */
export type SceneView = { readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number };

/** The pixel boxes of the named node sizes for every shape but the circle. */
export const sceneNodeSizes = {
  small: { width: 64, height: 28 },
  medium: { width: 120, height: 40 },
  large: { width: 184, height: 64 },
} as const;

/** The diameters of the named circle sizes, in CSS pixels. */
export const sceneCircleSizes = { small: 32, medium: 48, large: 72 } as const;

const HALF = 0.5;
const EDGE_GAP = 8;
const NODE_GAP = 8;
/** The room kept between the ends of a joining object that names none of its own, such as a custom wire. */
const WIRE_ROOM = 16;
const SETTLE_ROUNDS = 4;
const ZOOM_MAX = 8;
const SIDES = 2;
const WIDTH_DERIVED_MAX = 2400;
const SHARED_STEP = 2;
/** Items whose centers are this close, in pixels on each axis, share one place for the arrow keys. */
const SHARED_REACH = 16;

/** The pixel box of a node of this size and shape. */
export function nodeBox(size: SceneSize, shape: SceneShape): { readonly width: number; readonly height: number } {
  if (typeof size !== 'string') {
    return size;
  }

  if (shape === 'circle') {
    return { width: sceneCircleSizes[size], height: sceneCircleSizes[size] };
  }

  return sceneNodeSizes[size];
}

/** The center of a rectangle. */
export function rectCenter(rect: SceneRect): ScenePixel {
  return { x: (rect.left + rect.right) * HALF, y: (rect.top + rect.bottom) * HALF };
}

/** The smallest rectangle around all of `rects`, or undefined when there are none. */
export function unionRect(rects: ReadonlyArray<SceneRect>): SceneRect | undefined {
  if (rects.length === 0) {
    return undefined;
  }

  return {
    left: Math.min(...rects.map((rect) => rect.left)),
    top: Math.min(...rects.map((rect) => rect.top)),
    right: Math.max(...rects.map((rect) => rect.right)),
    bottom: Math.max(...rects.map((rect) => rect.bottom)),
  };
}

/** A rectangle grown by `padding` pixels on every side. */
export function padRect(rect: SceneRect, padding: number): SceneRect {
  return {
    left: rect.left - padding,
    top: rect.top - padding,
    right: rect.right + padding,
    bottom: rect.bottom + padding,
  };
}

/** Whether two rectangles share any area. */
export function rectsOverlap(first: SceneRect, second: SceneRect): boolean {
  const isApartX = first.right <= second.left || second.right <= first.left;

  return !isApartX && !(first.bottom <= second.top || second.bottom <= first.top);
}

/** The area two rectangles share, in square pixels. */
export function sharedArea(first: SceneRect, second: SceneRect): number {
  const width = Math.min(first.right, second.right) - Math.max(first.left, second.left);
  const height = Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top);

  return Math.max(0, width) * Math.max(0, height);
}

/** How long the part of the segment from `from` to `to` that lies inside `rect` is, in pixels. */
export function segmentInside({
  rect,
  from,
  to,
}: {
  readonly rect: SceneRect;
  readonly from: ScenePixel;
  readonly to: ScenePixel;
}): number {
  const across = to.x - from.x;
  const down = to.y - from.y;

  const edges = [
    { step: -across, room: from.x - rect.left },
    { step: across, room: rect.right - from.x },
    { step: -down, room: from.y - rect.top },
    { step: down, room: rect.bottom - from.y },
  ];

  if (edges.some((edge) => edge.step === 0 && edge.room < 0)) {
    return 0;
  }

  const enter = Math.max(0, ...edges.filter((edge) => edge.step < 0).map((edge) => edge.room / edge.step));
  const leave = Math.min(1, ...edges.filter((edge) => edge.step > 0).map((edge) => edge.room / edge.step));

  return leave > enter ? (leave - enter) * Math.hypot(across, down) : 0;
}

type EdgeInput = {
  readonly rect: SceneRect;
  readonly shape: SceneShape;
  /** The point the edge faces, such as the other end of a wire. */
  readonly toward: ScenePixel;
};

function farRoot({
  center,
  corner,
  step,
  radius,
}: Readonly<Record<'center' | 'corner' | 'step', ScenePixel>> & { readonly radius: number }): number {
  const offsetX = center.x - corner.x;
  const offsetY = center.y - corner.y;
  const lengthSquared = step.x * step.x + step.y * step.y;
  const middle = offsetX * step.x + offsetY * step.y;
  const rest = offsetX * offsetX + offsetY * offsetY - radius * radius;
  const discriminant = Math.max(0, middle * middle - lengthSquared * rest);

  return (-middle + Math.sqrt(discriminant)) / lengthSquared;
}

/**
 * Where a line from the center of a node toward `toward` crosses the node's outline. Wires end there, so they meet the
 * edge of a box, pill or circle and never its middle.
 */
export function edgePoint({ rect, shape, toward }: EdgeInput): ScenePixel {
  const center = rectCenter(rect);
  const halfWidth = (rect.right - rect.left) * HALF;
  const halfHeight = (rect.bottom - rect.top) * HALF;
  const step = { x: toward.x - center.x, y: toward.y - center.y };
  const isDegenerate = halfWidth <= 0 || halfHeight <= 0;

  if (isDegenerate || (step.x === 0 && step.y === 0)) {
    return center;
  }

  if (shape === 'circle') {
    const scale = 1 / Math.hypot(step.x / halfWidth, step.y / halfHeight);

    return { x: center.x + step.x * scale, y: center.y + step.y * scale };
  }

  const reachX = step.x === 0 ? Number.POSITIVE_INFINITY : halfWidth / Math.abs(step.x);
  const reachY = step.y === 0 ? Number.POSITIVE_INFINITY : halfHeight / Math.abs(step.y);
  const reach = Math.min(reachX, reachY);
  const hit = { x: center.x + step.x * reach, y: center.y + step.y * reach };
  const radius = shape === 'pill' ? Math.min(halfWidth, halfHeight) : 0;
  const isCornerX = Math.abs(hit.x - center.x) > halfWidth - radius;

  if (radius === 0 || !isCornerX || Math.abs(hit.y - center.y) <= halfHeight - radius) {
    return hit;
  }

  const corner = {
    x: center.x + Math.sign(step.x) * (halfWidth - radius),
    y: center.y + Math.sign(step.y) * (halfHeight - radius),
  };

  const along = farRoot({ center, corner, step, radius });

  return { x: center.x + step.x * along, y: center.y + step.y * along };
}

/** The midpoint of the side of a node that faces along an axis, where a curved or elbowed wire leaves it. */
export function sidePoint({
  rect,
  axis,
  sign,
}: {
  readonly rect: SceneRect;
  readonly axis: 'x' | 'y';
  /** 1 for the right or bottom side, -1 for the left or top side. */
  readonly sign: number;
}): ScenePixel {
  const center = rectCenter(rect);

  if (axis === 'x') {
    return { x: sign > 0 ? rect.right : rect.left, y: center.y };
  }

  return { x: center.x, y: sign > 0 ? rect.bottom : rect.top };
}

type CameraInput = {
  /** The whole data box. */
  readonly domain: SceneDomain;
  /** The drawing area in pixels. */
  readonly width: number;
  readonly height: number;
  /** The frames the camera must show. Empty shows the whole box. */
  readonly frames: ReadonlyArray<SceneFrame>;
  /** The room left around the framed objects, in pixels. */
  readonly padding: number;
};

function clampStart({
  start,
  span,
  domain,
}: {
  readonly start: number;
  readonly span: number;
  readonly domain: NumericDomain;
}): number {
  return Math.min(domain[1] - span, Math.max(domain[0], start));
}

/**
 * The part of the data box that shows `frames` as large as it can with `padding` around them, keeping the box's aspect
 * ratio and staying inside it. It zooms in at most eight times.
 */
export function cameraView({ domain, width, height, frames, padding }: CameraInput): SceneView {
  const whole = { x0: domain.x[0], x1: domain.x[1], y0: domain.y[0], y1: domain.y[1] };

  if (frames.length === 0) {
    return whole;
  }

  const spanX = domain.x[1] - domain.x[0];
  const spanY = domain.y[1] - domain.y[0];
  const lowX = Math.min(...frames.map((frame) => frame.x));
  const highX = Math.max(...frames.map((frame) => frame.x));
  const lowY = Math.min(...frames.map((frame) => frame.y));
  const highY = Math.max(...frames.map((frame) => frame.y));
  const roomX = width - Math.max(...frames.map((frame) => frame.width)) - SIDES * padding;
  const roomY = height - Math.max(...frames.map((frame) => frame.height)) - SIDES * padding;
  const zoomX = highX === lowX ? ZOOM_MAX : (roomX / (highX - lowX)) * (spanX / width);
  const zoomY = highY === lowY ? ZOOM_MAX : (roomY / (highY - lowY)) * (spanY / height);
  const zoom = Math.min(ZOOM_MAX, Math.max(1, Math.min(zoomX, zoomY)));
  const viewX = spanX / zoom;
  const viewY = spanY / zoom;
  const x0 = clampStart({ start: (lowX + highX) * HALF - viewX * HALF, span: viewX, domain: domain.x });
  const y0 = clampStart({ start: (lowY + highY) * HALF - viewY * HALF, span: viewY, domain: domain.y });

  return { x0, x1: x0 + viewX, y0, y1: y0 + viewY };
}

/** A pair of objects a wire joins, with the pixels the wire keeps between them. */
type SceneLink = { readonly from: SceneFrame; readonly to: SceneFrame; readonly room: number | undefined };

/** How far a frame reaches from its data position on each side, in pixels: half its box, its shift and its outset. */
function frameReach(frame: SceneFrame): PlotMargins {
  const [across, down] = frame.offset ?? [0, 0];
  const outset: SceneMargins = frame.outset ?? {};

  return {
    top: frame.height * HALF - down + (outset.top ?? 0),
    right: frame.width * HALF + across + (outset.right ?? 0),
    bottom: frame.height * HALF + down + (outset.bottom ?? 0),
    left: frame.width * HALF - across + (outset.left ?? 0),
  };
}

/**
 * How far past each edge of an inner box of this size the frames reach, in pixels. A frame reaches past an edge only by
 * what its data position leaves short, so a frame on the right edge asks nothing of the left.
 */
function frameNeeds({
  frames,
  domain,
  innerWidth,
  innerHeight,
}: {
  readonly frames: ReadonlyArray<SceneFrame>;
  readonly domain: SceneDomain;
  readonly innerWidth: number;
  readonly innerHeight: number;
}): PlotMargins {
  const needs = frames.map((frame) => {
    const reach = frameReach(frame);
    const shareX = (frame.x - domain.x[0]) / (domain.x[1] - domain.x[0]);
    const shareY = (frame.y - domain.y[0]) / (domain.y[1] - domain.y[0]);

    return {
      top: reach.top - (1 - shareY) * innerHeight,
      right: reach.right - (1 - shareX) * innerWidth,
      bottom: reach.bottom - shareY * innerHeight,
      left: reach.left - shareX * innerWidth,
    };
  });

  return {
    top: Math.max(0, ...needs.map((need) => need.top)),
    right: Math.max(0, ...needs.map((need) => need.right)),
    bottom: Math.max(0, ...needs.map((need) => need.bottom)),
    left: Math.max(0, ...needs.map((need) => need.left)),
  };
}

/** The margins that hold `needs` with a gap to the edge, and the largest room any of `reserved` asks for. */
function heldMargins(needs: PlotMargins, reserved: ReadonlyArray<SceneMargins>): PlotMargins {
  function held(side: keyof PlotMargins): number {
    return Math.max(Math.ceil(needs[side]) + EDGE_GAP, ...reserved.map((margins) => margins[side] ?? 0));
  }

  return { top: held('top'), right: held('right'), bottom: held('bottom'), left: held('left') };
}

/**
 * The margins around the data box of a plot `width` by `height` pixels. Each side keeps whole the frames that reach
 * past it and holds the largest room any of `reserved` asks for there.
 */
export function sceneMargins({
  frames,
  reserved,
  domain,
  width,
  height,
}: {
  readonly frames: ReadonlyArray<SceneFrame>;
  readonly reserved: ReadonlyArray<SceneMargins>;
  readonly domain: SceneDomain;
  readonly width: number;
  readonly height: number;
}): PlotMargins {
  const settling = { margins: { top: 0, right: 0, bottom: 0, left: 0 }, rounds: 0, isSettled: false };

  while (!settling.isSettled && settling.rounds < SETTLE_ROUNDS) {
    const { margins } = settling;
    const innerWidth = width - margins.left - margins.right;
    const innerHeight = height - margins.top - margins.bottom;
    const next = heldMargins(frameNeeds({ frames, domain, innerWidth, innerHeight }), reserved);
    const isSameEnds = next.top === margins.top && next.bottom === margins.bottom;

    settling.isSettled = isSameEnds && next.left === margins.left && next.right === margins.right;
    settling.margins = next;
    settling.rounds += 1;
  }

  return settling.margins;
}

/**
 * The pixels per data unit at which two frames stand `gap` pixels apart along x, facing side to facing side. Zero when
 * any width does, or when no width can, as for two frames at one data position.
 */
function pixelsPerUnit(first: SceneFrame, second: SceneFrame, gap: number): number {
  const [left, right] = first.x <= second.x ? [first, second] : [second, first];
  const apart = right.x - left.x;

  if (apart === 0) {
    return 0;
  }

  return Math.max(0, (frameReach(left).right + frameReach(right).left + gap) / apart);
}

/** Whether two frames share a row: their pixel bands overlap, or come closer than the gap between nodes. */
function isSameRow({
  first,
  second,
  perUnitY,
}: {
  readonly first: SceneFrame;
  readonly second: SceneFrame;
  readonly perUnitY: number;
}): boolean {
  const firstReach = frameReach(first);
  const secondReach = frameReach(second);
  const firstY = -first.y * perUnitY;
  const secondY = -second.y * perUnitY;
  const isFirstAbove = firstY - firstReach.top < secondY + secondReach.bottom + NODE_GAP;

  return isFirstAbove && secondY - secondReach.top < firstY + firstReach.bottom + NODE_GAP;
}

/**
 * The plot width below which two frames on the same row would touch, or two wired frames would leave no room for the
 * wire. Rows are pixel bands, because the plot height is fixed. The result is capped at 2400 pixels.
 */
export function sceneMinWidth({
  frames,
  edged,
  links,
  domain,
  innerHeight,
  reserved,
}: {
  readonly frames: ReadonlyArray<SceneFrame>;
  /** The frames the margins keep whole: `frames`, and the room drawn around some of them, such as a group's outline. */
  readonly edged: ReadonlyArray<SceneFrame>;
  /** The ends of each wire, with the room the wire asks for between them: its stroke, its arrow and its text. */
  readonly links: ReadonlyArray<SceneLink>;
  readonly domain: SceneDomain;
  readonly innerHeight: number;
  readonly reserved: ReadonlyArray<SceneMargins>;
}): number {
  const perUnitY = innerHeight / (domain.y[1] - domain.y[0]);

  const needs = frames.map((first, index) =>
    Math.max(
      0,
      ...frames.slice(index + 1).map((second) => {
        const isRow = isSameRow({ first, second, perUnitY });

        return isRow ? pixelsPerUnit(first, second, NODE_GAP) : 0;
      }),
    ),
  );

  const wired = links.map((link) => pixelsPerUnit(link.from, link.to, link.room ?? WIRE_ROOM));
  const perUnitX = Math.max(0, ...needs, ...wired);

  if (perUnitX === 0) {
    return 0;
  }

  const innerWidth = perUnitX * (domain.x[1] - domain.x[0]);
  const margins = heldMargins(frameNeeds({ frames: edged, domain, innerWidth, innerHeight }), reserved);

  return Math.min(WIDTH_DERIVED_MAX, Math.ceil(innerWidth + margins.left + margins.right));
}

/** One item the arrow keys reach, where it sits now, with the stacking order that orders items sharing a place. */
export type SceneKeyboardItem = { readonly id: string; readonly rect: SceneRect; readonly order: number };

/**
 * Where the arrow keys find each item. Items whose centers lie a few pixels from an earlier one, such as piled cards,
 * line up on a short row through its center in stacking order. Left and Right then step through them.
 */
export function keyboardPlaces(items: ReadonlyArray<SceneKeyboardItem>): ReadonlyMap<string, SceneRect> {
  const centers = items.map((item) => rectCenter(item.rect));

  const groups = Map.groupBy(
    items.map((item, index) => ({ item, index })),
    ({ index }) =>
      centers.findIndex((center, earlier) => {
        const here = centers[index] ?? center;
        const isNear = Math.abs(center.x - here.x) <= SHARED_REACH && Math.abs(center.y - here.y) <= SHARED_REACH;

        return earlier <= index && isNear;
      }),
  );

  return new Map(
    Array.from(groups, ([anchor, group]) => {
      const ordered = group.toSorted((first, second) => first.item.order - second.item.order);
      const middle = (ordered.length - 1) * HALF;
      const center = centers[anchor] ?? { x: 0, y: 0 };

      return ordered.map(({ item, index }, place) => {
        const own = centers[index] ?? center;
        const across = group.length === 1 ? 0 : center.x + (place - middle) * SHARED_STEP - own.x;
        const down = group.length === 1 ? 0 : center.y - own.y;
        const { rect } = item;

        return [
          item.id,
          { left: rect.left + across, right: rect.right + across, top: rect.top + down, bottom: rect.bottom + down },
        ] as const;
      });
    }).flat(),
  );
}
