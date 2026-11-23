import type { ReactNode } from 'react';
import { hasUniqueIds } from '../chart-input.ts';
import type { ValueFormat } from '../figure/figure-format.ts';
import { MatrixFigure } from './matrix-figure.tsx';
import { denseProblem, denseValue, visibleText } from './matrix-presets.ts';
import type { MatrixPresetProps } from './matrix-presets.ts';
import { matrixCellId } from './matrix-types.ts';
import type { MatrixCell, MatrixCellValuesProps } from './matrix-types.ts';

/** A token on one side of the attention pattern: its exact text and its position in the full sequence. */
export type AttentionToken = { readonly id: string; readonly index: number; readonly text: string };

export type AttentionMatrixProps = MatrixPresetProps &
  MatrixCellValuesProps & {
    /** The tokens that attend, down the rows. Each destination reads information from the sources. */
    readonly destinations: ReadonlyArray<AttentionToken>;
    /** The tokens attended to, across the columns: the tokens a destination reads information from. */
    readonly sources: ReadonlyArray<AttentionToken>;
    /**
     * Weights in [0, 1] as a model computes them: one line per destination (the token that attends), one weight per
     * source (the token attended to), in the supplied orders. Null marks a weight that was not recorded.
     */
    readonly weights: ReadonlyArray<ReadonlyArray<number | null>>;
    /**
     * `causal` draws each pair whose source comes after its destination as masked, since a token cannot attend to a
     * later one: hollow, never zero. Its weight must be null. Absent means none.
     */
    readonly mask?: 'none' | 'causal' | undefined;
    /** What the weight is: "Attention weight, layer 3 head 2". */
    readonly valueLabel?: string | undefined;
    /** How a weight is written. Absent writes two decimals. */
    readonly valueFormat?: ValueFormat | undefined;
  };

/** The largest number of tokens on each side. */
export const attentionMatrixLimits = { tokens: 64 } as const;

const WHITESPACE_KEY = '␣ space · ⏎ newline · ⇥ tab';
const weightFormat = { minimumFractionDigits: 2, maximumFractionDigits: 2 } as const;

function tokenName(token: AttentionToken): string {
  return `${token.index} ${JSON.stringify(token.text)}`;
}

function attentionProblem({
  sources,
  destinations,
  weights,
  mask,
}: Pick<AttentionMatrixProps, 'sources' | 'destinations' | 'weights'> & { readonly mask: 'none' | 'causal' }):
  | string
  | undefined {
  const tokens = [...sources, ...destinations];

  if (tokens.some((token) => !Number.isSafeInteger(token.index) || token.index < 0)) {
    return 'Token positions must be whole numbers of zero or more.';
  }

  const hasDistinctPositions = [sources, destinations].every(
    (side) => new Set(side.map((token) => token.index)).size === side.length && hasUniqueIds(side),
  );

  if (!hasDistinctPositions) {
    return 'Tokens on each side must have unique identifiers and positions.';
  }

  const values = weights.flat();

  if (values.some((value) => value !== null && !(value >= 0 && value <= 1))) {
    return 'Attention weights must lie between 0 and 1. Use null for a weight that was not recorded.';
  }

  const hasMaskedValue =
    mask === 'causal' &&
    destinations.some((destination, row) =>
      sources.some((source, column) => source.index > destination.index && denseValue(weights, row, column) !== null),
    );

  return hasMaskedValue
    ? 'A pair under the causal mask must have a null weight, so masked never reads as zero.'
    : undefined;
}

/**
 * One attention head's pattern: each row is a destination, the token that attends, and each column a source, the token
 * attended to. Weights in [0, 1] show as lightness of one hue, token text stays exact with whitespace drawn visibly,
 * and inspecting a cell names both tokens with their positions. A causal mask draws masked pairs hollow, apart from a
 * weight of zero, and attention weights alone are not a causal explanation.
 */
export function AttentionMatrix(props: AttentionMatrixProps): ReactNode {
  const {
    sources,
    destinations,
    weights,
    mask = 'none',
    valueLabel = 'Attention weight',
    valueFormat = weightFormat,
    emptyLabel = 'No tokens were supplied.',
    ...figure
  } = props;

  const rows = destinations.map((token) => ({ id: token.id, label: visibleText(token.text) }));
  const columns = sources.map((token) => ({ id: token.id, label: visibleText(token.text) }));
  const sourceOf = new Map(sources.map((token) => [token.id, token]));
  const destinationOf = new Map(destinations.map((token) => [token.id, token]));

  const problem =
    denseProblem({ rows, columns, values: weights, noun: 'tokens', limit: attentionMatrixLimits.tokens }) ??
    attentionProblem({ sources, destinations, weights, mask });

  const cells = destinations.flatMap((destination, row) =>
    sources.map((source, column): MatrixCell => {
      const value = denseValue(weights, row, column);
      const coordinate = { id: matrixCellId(destination.id, source.id), rowId: destination.id, columnId: source.id };

      if (mask === 'causal' && source.index > destination.index) {
        return { ...coordinate, kind: 'masked', reason: 'Causal mask: the source comes after the destination' };
      }

      return value === null
        ? { ...coordinate, kind: 'missing', reason: 'Not recorded' }
        : { ...coordinate, kind: 'value', value };
    }),
  );

  function cellLabel(row: { readonly id: string }, column: { readonly id: string }): string {
    const destination = destinationOf.get(row.id);
    const source = sourceOf.get(column.id);

    return source === undefined || destination === undefined
      ? `${row.id} → ${column.id}`
      : `Destination ${tokenName(destination)} attends to source ${tokenName(source)}`;
  }

  return (
    <MatrixFigure
      {...figure}
      emptyLabel={emptyLabel}
      problem={problem}
      rows={rows}
      columns={columns}
      cells={cells}
      domain={[0, 1]}
      palette="sequential"
      valueFormat={valueFormat}
      valueLabel={valueLabel}
      variant="values"
      rowTitle="Destination"
      columnTitle="Source"
      rowNoun="destination"
      columnNoun="source"
      axisFont="mono"
      cellLabel={cellLabel}
      notes={[...sources, ...destinations].some((token) => /\s/u.test(token.text)) ? [WHITESPACE_KEY] : []}
    />
  );
}
