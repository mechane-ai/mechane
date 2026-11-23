const art = { tile: 96, sector: 60, turn: 360, scene: { width: 224, height: 160, cell: 16 } } as const;

const colorNames = ['red', 'amber', 'green', 'teal', 'blue', 'violet'] as const;
const shapeNames = ['circle', 'bar', 'square'] as const;

const HALF = 0.5;
const SHAPE_RADIUS = 28;
const SQUARE_WIDTH = 42;
const SHAPE_ORIGIN = 34;
const SHAPE_THICK = 14;
const BAR_LENGTH = 60;
const BAR_OFFSET = 18;
const TILT_STEP = 25;
const TILT_TURN = 180;

function dataUrl(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** The colored shape in a synthetic tile picture, for alt text. */
export function tileDescription(index: number): string {
  const color = colorNames[index % colorNames.length];
  const shape = shapeNames[Math.floor(index / colorNames.length) % shapeNames.length];

  return `Synthetic picture ${index + 1}: a white ${shape} on a ${color} gradient`;
}

/** A small closed-form picture: a white shape on a gradient. The same index always gives the same picture. */
export function tilePicture(index: number): string {
  const hue = (index % colorNames.length) * art.sector;
  const shape = shapeNames[Math.floor(index / colorNames.length) % shapeNames.length];
  const tilt = (index * TILT_STEP) % TILT_TURN;
  const center = art.tile * HALF;

  const marks = {
    circle: `<circle cx="${center}" cy="${center}" r="${SHAPE_RADIUS}" fill="white"/>`,
    bar: `<rect x="${BAR_OFFSET}" y="${center - SHAPE_THICK * HALF}" width="${BAR_LENGTH}" height="${SHAPE_THICK}" fill="white" transform="rotate(${tilt} ${center} ${center})"/>`,
    square: `<rect x="${SHAPE_ORIGIN}" y="${SHAPE_ORIGIN}" width="${SQUARE_WIDTH}" height="${SQUARE_WIDTH}" fill="white" transform="rotate(${tilt} ${center} ${center})"/>`,
  } as const;

  return dataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${art.tile} ${art.tile}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 70% 62%)"/><stop offset="1" stop-color="hsl(${hue} 65% 32%)"/></linearGradient></defs><rect width="${art.tile}" height="${art.tile}" fill="url(#g)"/>${marks[shape ?? 'circle']}</svg>`,
  );
}

const SUN = { x: 176, y: 36, radius: 20 } as const;
const HOUSE = { x: 76, y: 78, width: 72, height: 50 } as const;
const ROOF_RISE = 34;
const EAVE = 6;
const GROUND = 128;

/** A synthetic landscape with a sun and a house, 224 by 160 pixels, for overlay stories: its picture as a data URL. */
export const sceneSource = dataUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${art.scene.width} ${art.scene.height}"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fc1ee"/><stop offset="1" stop-color="#e8f2fb"/></linearGradient></defs><rect width="${art.scene.width}" height="${art.scene.height}" fill="url(#s)"/><circle cx="${SUN.x}" cy="${SUN.y}" r="${SUN.radius}" fill="#f4c542"/><rect y="${GROUND}" width="${art.scene.width}" height="${art.scene.height - GROUND}" fill="#5d9b57"/><rect x="${HOUSE.x}" y="${HOUSE.y}" width="${HOUSE.width}" height="${HOUSE.height}" fill="#c9693f"/><polygon points="${HOUSE.x - EAVE},${HOUSE.y} ${HOUSE.x + HOUSE.width * HALF},${HOUSE.y - ROOF_RISE} ${HOUSE.x + HOUSE.width + EAVE},${HOUSE.y}" fill="#6b3a2a"/></svg>`,
);

/** The landscape's size in pixels and its text alternative. */
export const sceneDetails = {
  alt: 'A landscape with a bright sun in the upper right and a brown house with a dark roof on green grass',
  width: art.scene.width,
  height: art.scene.height,
} as const;

/** Columns and rows of the 16 pixel patches that cover the landscape. */
export const sceneGrid = {
  columns: art.scene.width / art.scene.cell,
  rows: art.scene.height / art.scene.cell,
} as const;

const HOUSE_CELL = { column: 7, row: 6 } as const;
const SUN_CELL = { column: 11, row: 2 } as const;
const SPREAD_HOUSE = 8;
const SPREAD_SUN = 5;

function bump({
  index,
  at,
  spread,
}: {
  readonly index: number;
  readonly at: { readonly column: number; readonly row: number };
  readonly spread: number;
}) {
  const column = index % sceneGrid.columns;
  const row = Math.floor(index / sceneGrid.columns);

  const distance = Math.hypot(column - at.column, row - at.row);

  return Math.exp(-(distance * distance) / spread);
}

function sceneValues(sunWeight: number): ReadonlyArray<number> {
  return Array.from({ length: sceneGrid.columns * sceneGrid.rows }, (_, index) => {
    const house = bump({ index, at: HOUSE_CELL, spread: SPREAD_HOUSE });
    const sun = bump({ index, at: SUN_CELL, spread: SPREAD_SUN });

    return Math.max(-1, Math.min(1, house + sunWeight * sun));
  });
}

const SUN_SALIENCY = 0.5;
const SUN_PUSH = -1;

/** Synthetic saliency from 0 to 1, strongest on the house, weaker on the sun. Row by row from the top left. */
export const sceneSaliency: ReadonlyArray<number> = sceneValues(SUN_SALIENCY);

/** Synthetic signed attribution from -1 to 1: the house pushes the score up and the sun pushes it down. */
export const sceneContrast: ReadonlyArray<number> = sceneValues(SUN_PUSH);
