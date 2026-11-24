import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { chartToneColors, formatValue } from '../../../../charts/src/index.ts';
import type { NumericDomain, ValueFormat } from '../../../../charts/src/index.ts';
import type { HeatmapPalette } from '../../../../charts/src/matrix/index.ts';
import { ChartMark, labelBox } from '../../../../charts/src/plot/index.ts';
import type { MarkEmphasis } from '../../../../charts/src/plot/index.ts';
import { colors, radii, typography } from '../../../../foundations/src/tokens.stylex.ts';
import { useSceneObject } from '../scene-context.ts';
import type { ScenePosition } from '../scene-geometry.ts';
import { SceneOutside } from '../scene-layer.tsx';
import { sceneContextColor, sceneOutlines } from '../scene-style.ts';
import { fillLabel } from '../scene-validate.ts';
import { cellFill } from './cell-color.ts';
import { cellGap, cellGrid, cellOffset, cellsDomain, cellsExtent, sceneCellSizes } from './cell-grid.ts';
import type { SceneCellInput, SceneCellsDirection, SceneCellSizeName, SceneCellValues } from './cell-grid.ts';

/** The words a grid of cells speaks. Placeholders in braces are filled in. */
export type SceneCellsLabels = {
  /** A cell of a grid with several rows and columns. `{row}`, `{column}` and `{value}`. */
  readonly cell: string;
  /** A cell of a single row, such as a vector. `{column}` and `{value}`. */
  readonly inRow: string;
  /** A cell of a single column. `{row}` and `{value}`. */
  readonly inColumn: string;
  /** `{index}` counts from 1. */
  readonly rowName: string;
  readonly columnName: string;
  /** `{id}` names the grid. */
  readonly noCells: string;
  readonly ragged: string;
  /** `{id}` names the grid, `{labels}` how many labels it got and `{count}` how many rows or columns it has. */
  readonly rowLabelCount: string;
  readonly columnLabelCount: string;
};

/** The plain English words of a grid of cells. */
export const sceneCellsLabels = {
  cell: '{row}, {column}: {value}',
  inRow: '{column}: {value}',
  inColumn: '{row}: {value}',
  rowName: 'Row {index}',
  columnName: 'Column {index}',
  noCells: 'The cells "{id}" have nothing to draw. Give `values` or `cells`.',
  ragged: 'The cells "{id}" have rows of different lengths.',
  rowLabelCount: 'The cells "{id}" have {count} rows but {labels} row labels.',
  columnLabelCount: 'The cells "{id}" have {count} columns but {labels} column labels.',
} as const satisfies SceneCellsLabels;

export type SceneCellsProps = {
  /**
   * Stable across states. Name a cell `${id}.${row}.${column}`; as one object the grid is the box around its cells,
   * where wires meet it, and the scene makes room for its labels too.
   */
  readonly id: string;
  /** The center of the cells in data units. Labels hang outside it. */
  readonly at: ScenePosition;
  /** The numbers: a flat list is one row (or one column with `direction`), a list of lists is a matrix. */
  readonly values?: SceneCellValues | undefined;
  /** Cells with text or ids, as a list of rows. Used instead of `values`. */
  readonly cells?: ReadonlyArray<ReadonlyArray<SceneCellInput>> | undefined;
  /** Which way a flat list of `values` runs. Defaults to `row`. */
  readonly direction?: SceneCellsDirection | undefined;
  /** How a number is written. Defaults to at most two decimals. A value that eases is formatted on every frame. */
  readonly format?: ValueFormat | undefined;
  /**
   * Colors the cells on the matrix charts' scale: `sequential` shades one hue by size, `diverging` uses two hues around
   * zero. Left out, the cells are plain.
   */
  readonly palette?: HeatmapPalette | undefined;
  /** The values the color spans. Left out: zero to the largest magnitude, or its mirror for `diverging`. */
  readonly domain?: NumericDomain | undefined;
  /** The named size of each cell. Defaults to `medium`. */
  readonly size?: SceneCellSizeName | undefined;
  /** One caption per row, drawn left of the grid in a column as wide as the longest. */
  readonly rowLabels?: ReadonlyArray<string> | undefined;
  /** One caption per column, drawn above the grid. A long caption wraps, and a word wider than its column overhangs. */
  readonly columnLabels?: ReadonlyArray<string> | undefined;
  /** A row, a column, or one cell where both are given, drawn with a strong outline. Indices count from 0. */
  readonly highlight?: { readonly row?: number | undefined; readonly column?: number | undefined } | undefined;
  /** The readout sentence for the whole grid. With one, the arrow keys reach it. */
  readonly label?: string | undefined;
  /** `context` keeps the cells plain; the others yield to inspection. */
  readonly emphasis?: MarkEmphasis | undefined;
  /** False fades the grid out and takes its cells out of the keyboard order. */
  readonly isShown?: boolean | undefined;
  readonly labels?: Partial<SceneCellsLabels> | undefined;
};

const LABEL_GAP = 6;
/** The pixels between the grid's top edge and the last line of its column labels. */
const COLUMN_LABEL_GAP = 2;
/** The height of one line of a label, the caption line height in pixels. */
const LABEL_LINE = 18;
/** How strongly a cell's tone tints its fill, in percent, as a node's face is tinted. */
const TONE_TINT = 10;
const DEFAULT_FORMAT: ValueFormat = { maximumFractionDigits: 2 };
const HALF = 0.5;
const RING = 3;

const styles = stylex.create({
  grid: { position: 'absolute', left: 0, top: 0, display: 'grid', pointerEvents: 'none' },
  place: (transform: string, opacity: number) => ({ transform, opacity }),
  box: (width: number, height: number) => ({ width, height }),
  tracks: (columns: string, rows: string, gap: number) => ({ gridTemplateColumns: columns, gridAutoRows: rows, gap }),
  gone: { visibility: 'hidden' },
  ring: { position: 'absolute', inset: -RING, pointerEvents: 'none', borderRadius: radii.sm },
  cell: (fill: string | undefined, opacity: number) => ({
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    overflow: 'hidden',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    backgroundColor: fill ?? colors.surface,
    opacity,
    color: colors.ink,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    fontVariantNumeric: 'tabular-nums',
    pointerEvents: 'auto',
    outlineStyle: 'none',
  }),
  highlighted: { borderColor: colors.ink, borderWidth: 2 },
  ink: (color: string) => ({ color }),
  label: {
    position: 'absolute',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    textAlign: 'center',
    pointerEvents: 'none',
  },
  columnLabel: (left: number, width: number, bottom: number) => ({
    left,
    width,
    bottom,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    overflow: 'visible',
    whiteSpace: 'normal',
  }),
  columnText: { overflowWrap: 'normal', textAlign: 'center' },
  rowLabel: (top: number, height: number, width: number) => ({
    top,
    height,
    left: -(width + LABEL_GAP),
    width,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
  }),
  strong: { color: colors.ink, fontWeight: typography.strongWeight },
});

type CellViewProps = {
  readonly id: string;
  readonly at: ScenePosition;
  readonly row: number;
  readonly column: number;
  readonly rows: number;
  readonly columns: number;
  readonly cell: SceneCellInput;
  readonly size: SceneCellSizeName;
  readonly name: string;
  readonly format: ValueFormat;
  readonly palette: HeatmapPalette | undefined;
  readonly domain: NumericDomain;
  readonly isHighlighted: boolean;
  readonly isShown: boolean;
  readonly emphasis: MarkEmphasis | undefined;
};

function CellView({
  id,
  at,
  row,
  column,
  rows,
  columns,
  cell,
  size,
  name,
  format,
  palette,
  domain,
  isHighlighted,
  isShown,
  emphasis,
}: CellViewProps): ReactNode {
  const box = sceneCellSizes[size];

  const object = useSceneObject({
    id,
    kind: 'cell',
    frame: { x: at[0], y: at[1], offset: cellOffset({ row, column, rows, columns, size }), ...box },
    isFloating: true,
    values: { value: cell.value ?? 0 },
    label: cell.label ?? name,
    isShown,
    emphasis,
  });

  const eased = object.values.value;

  const text =
    cell.text ?? (cell.value === undefined ? '' : formatValue({ value: eased, locale: object.scene.locale, format }));

  const scaled = cellFill({ value: cell.value === undefined ? undefined : eased, palette, domain });
  const toneColor = cell.tone === undefined ? undefined : chartToneColors[cell.tone];

  const tint =
    toneColor === undefined ? undefined : `color-mix(in srgb, ${toneColor} ${TONE_TINT}%, ${colors.surface})`;

  const fill = cell.isMuted === true ? undefined : (scaled ?? tint);
  const ink = cell.isMuted === true ? sceneContextColor : toneColor;

  return (
    <ChartMark
      value={id}
      render={<div role="img" aria-label={cell.label ?? name} data-scene-cell={id} />}
      {...stylex.props(
        styles.cell(fill, Math.max(0, Math.min(1, object.values.opacity)) * object.strength),
        ink !== undefined && styles.ink(ink),
        isHighlighted && styles.highlighted,
        !object.isVisible && styles.gone,
        ...sceneOutlines(object),
      )}
    >
      <span aria-hidden>{text}</span>
    </ChartMark>
  );
}

/** The estimated width of a caption, with the label kernel's clearance. */
function textWidth(text: string): number {
  const box = labelBox({ x: 0, y: 0, anchor: 'start', text });

  return box.right - box.left;
}

/** The width of the row label column: the estimated width of the longest label, or 0 without labels. */
function rowLabelWidth(rowLabels: ReadonlyArray<string> | undefined): number {
  return Math.ceil(Math.max(0, ...(rowLabels ?? []).map(textWidth)));
}

/** The lines words take when they wrap at `width`, with a word wider than that on a line of its own. */
function lineCount(words: ReadonlyArray<string>, width: number): number {
  if (words.length === 0) {
    return 0;
  }

  const overflow = words.findIndex((_, index) => index > 0 && textWidth(words.slice(0, index + 1).join(' ')) > width);

  return overflow === -1 ? 1 : 1 + lineCount(words.slice(overflow), width);
}

/**
 * The room the column labels take outside the grid. Above it is the most lines any label wraps to. At either end it is
 * how far the first or last label's widest word overhangs its column.
 */
function columnLabelRoom({
  columnLabels,
  width,
}: {
  readonly columnLabels: ReadonlyArray<string> | undefined;
  readonly width: number;
}): { readonly top: number; readonly left: number; readonly right: number } {
  if (columnLabels === undefined || columnLabels.length === 0) {
    return { top: 0, left: 0, right: 0 };
  }

  const words = columnLabels.map((text) => text.split(/\s+/u).filter((word) => word.length > 0));

  function overhang(index: number): number {
    const widest = Math.max(0, ...(words[index] ?? []).map(textWidth));

    return Math.ceil(Math.max(0, (widest - width) * HALF));
  }

  const lines = Math.max(1, ...words.map((list) => lineCount(list, width)));

  return { top: lines * LABEL_LINE + COLUMN_LABEL_GAP, left: overhang(0), right: overhang(words.length - 1) };
}

function problemOf({
  grid,
  props,
  labels,
}: {
  readonly grid: ReadonlyArray<ReadonlyArray<SceneCellInput>>;
  readonly props: SceneCellsProps;
  readonly labels: SceneCellsLabels;
}): string | undefined {
  const { id, rowLabels, columnLabels } = props;
  const columns = grid[0]?.length ?? 0;

  if (grid.length === 0 || columns === 0) {
    return fillLabel(labels.noCells, { id });
  }

  if (grid.some((row) => row.length !== columns)) {
    return fillLabel(labels.ragged, { id });
  }

  if (rowLabels !== undefined && rowLabels.length !== grid.length) {
    return fillLabel(labels.rowLabelCount, { id, count: String(grid.length), labels: String(rowLabels.length) });
  }

  return columnLabels !== undefined && columnLabels.length !== columns
    ? fillLabel(labels.columnLabelCount, { id, count: String(columns), labels: String(columnLabels.length) })
    : undefined;
}

/**
 * A vector, a weight matrix or an embedding row drawn as a grid of numbered cells. Each cell is its own object with the
 * id `${id}.${row}.${column}`, so wires and callouts can point at it. Its number counts to a new value and its color
 * eases when `values` change, with the meaning of the matrix charts.
 */
export function SceneCells(props: SceneCellsProps): ReactNode {
  const { id, at, values, cells, direction = 'row', format = DEFAULT_FORMAT, palette, domain } = props;

  const { size = 'medium', rowLabels, columnLabels, highlight, label, emphasis, isShown = true } = props;
  const labels = { ...sceneCellsLabels, ...props.labels };
  const grid = cellGrid({ values, cells, direction });
  const rows = grid.length;
  const columns = grid[0]?.length ?? 0;
  const extent = cellsExtent({ rows, columns, size });
  const problem = problemOf({ grid, props, labels });
  const labelWidth = rowLabelWidth(rowLabels);
  const rowRoom = rowLabels === undefined ? 0 : labelWidth + LABEL_GAP;
  const columnRoom = columnLabelRoom({ columnLabels, width: sceneCellSizes[size].width });

  const object = useSceneObject({
    id,
    kind: 'cells',
    frame: {
      x: at[0],
      y: at[1],
      width: extent.width,
      height: extent.height,
      outset: { left: Math.max(rowRoom, columnRoom.left), right: columnRoom.right, top: columnRoom.top },
    },
    values: {},
    label,
    isShown,
    emphasis,
    problem,
  });

  if (!object.scene.isInScene) {
    return <SceneOutside part="SceneCells" />;
  }

  if (problem !== undefined) {
    return null;
  }

  const { rect = { left: 0, top: 0, right: 0, bottom: 0 } } = object;
  const box = sceneCellSizes[size];
  const scale = cellsDomain({ grid, palette, domain });
  const columnEntries = (columnLabels ?? []).map((text, index) => ({ key: `${id}.column.${index}`, index, text }));
  const rowEntries = (rowLabels ?? []).map((text, index) => ({ key: `${id}.row.${index}`, index, text }));
  const isOneRow = rows === 1;
  const isOneColumn = columns === 1;

  return (
    <div
      aria-hidden={isShown ? undefined : true}
      inert={!isShown}
      data-scene-cells={id}
      {...stylex.props(
        !object.isVisible && styles.gone,
        styles.grid,
        styles.place(`translate(${rect.left}px, ${rect.top}px)`, Math.max(0, Math.min(1, object.values.opacity))),
        styles.box(extent.width, extent.height),
        styles.tracks(`repeat(${columns}, ${box.width}px)`, `${box.height}px`, cellGap),
      )}
    >
      {object.isInspected || object.isCursor ? <span {...stylex.props(styles.ring, ...sceneOutlines(object))} /> : null}
      {columnEntries.map((entry) => (
        <span
          key={entry.key}
          aria-hidden
          {...stylex.props(
            styles.label,
            styles.columnLabel(entry.index * (box.width + cellGap), box.width, extent.height + COLUMN_LABEL_GAP),
            highlight?.column === entry.index && styles.strong,
          )}
        >
          <span {...stylex.props(styles.columnText)}>{entry.text}</span>
        </span>
      ))}
      {rowEntries.map((entry) => (
        <span
          key={entry.key}
          aria-hidden
          {...stylex.props(
            styles.label,
            styles.rowLabel(entry.index * (box.height + cellGap), box.height, labelWidth),
            highlight?.row === entry.index && styles.strong,
          )}
        >
          {entry.text}
        </span>
      ))}
      {grid.flatMap((gridRow, row) =>
        gridRow.map((cell, column) => {
          const cellId = cell.id ?? `${id}.${row}.${column}`;
          const rowName = rowLabels?.[row] ?? fillLabel(labels.rowName, { index: String(row + 1) });
          const columnName = columnLabels?.[column] ?? fillLabel(labels.columnName, { index: String(column + 1) });

          const shown =
            cell.text ??
            (cell.value === undefined ? '' : formatValue({ value: cell.value, locale: object.scene.locale, format }));

          const template = isOneRow ? labels.inRow : labels.cell;

          const sentence = fillLabel(isOneColumn && !isOneRow ? labels.inColumn : template, {
            row: rowName,
            column: columnName,
            value: shown,
          });

          const isRowHit = highlight?.row === undefined || highlight.row === row;
          const isColumnHit = highlight?.column === undefined || highlight.column === column;
          const isDeclared = highlight !== undefined && (highlight.row !== undefined || highlight.column !== undefined);

          return (
            <CellView
              key={cellId}
              id={cellId}
              at={at}
              row={row}
              column={column}
              rows={rows}
              columns={columns}
              cell={cell}
              size={size}
              name={sentence}
              format={format}
              palette={palette}
              domain={scale}
              isHighlighted={isDeclared && isRowHit && isColumnHit}
              isShown={isShown}
              emphasis={emphasis}
            />
          );
        }),
      )}
    </div>
  );
}
