import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import type { FigureProps, ValueFormat } from '../../../charts/src/index.ts';
import { quoteToken, TokenGrid, tokenGridCellId } from '../../../charts/src/text/index.ts';
import type { TokenGridCell, TokenGridColumn } from '../../../charts/src/text/index.ts';
import { CurveChart } from '../../../charts/src/trend/index.ts';
import type { InterpretabilityChangeDetails } from './features.ts';
import { kitStyles } from './kit-styles.ts';

/** One layer the lens reads the residual stream at, from the first layer down to the last. */
export type LensLayer = {
  readonly id: string;
  readonly label: string;
  /** The layer's number, the horizontal position of its point in the curve. */
  readonly depth: number;
};

/** The probability of one chosen token at one position, read at each layer in `layers` order. */
export type LensTrack = {
  readonly id: string;
  /** The prompt position, a column id. */
  readonly columnId: string;
  readonly token: string;
  /** One value per layer, in layer order. Null where it was not read. */
  readonly probabilities: ReadonlyArray<number | null>;
};

/** The words around the lens. Each has an English default. */
export type LogitLensLabels = {
  readonly probability: string;
  readonly layer: string;
  readonly curveTitle: string;
  readonly curveDescription: string;
  readonly noPosition: string;
};

export type LogitLensProps = Pick<
  FigureProps,
  'title' | 'description' | 'locale' | 'status' | 'coverage' | 'source' | 'transforms'
> & {
  /** The prompt's tokens, one column each. */
  readonly columns: ReadonlyArray<TokenGridColumn>;
  readonly layers: ReadonlyArray<LensLayer>;
  /** The top prediction at each layer and position, with its probability. */
  readonly cells: ReadonlyArray<TokenGridCell>;
  /** The tokens to follow through the layers, for any positions the application chose. */
  readonly tracks?: ReadonlyArray<LensTrack> | undefined;
  /** How probabilities are written. Absent writes a percent. */
  readonly valueFormat?: ValueFormat | undefined;
  /** The cell in focus, as `tokenGridCellId(layerId, columnId)`. Its position's tracks are drawn as curves. */
  readonly selected?: string | null | undefined;
  readonly onSelectedChange?: ((id: string, details: InterpretabilityChangeDetails) => void) | undefined;
  readonly labels?: Partial<LogitLensLabels> | undefined;
};

const percent = { style: 'percent', maximumFractionDigits: 0 } as const;

const defaultLabels: LogitLensLabels = {
  probability: 'Probability',
  layer: 'Layer',
  curveTitle: 'Probability by layer at',
  curveDescription: 'How the chosen next tokens gain or lose probability as the layers add to the residual stream.',
  noPosition: 'Select a cell to follow its position through the layers.',
};

/**
 * A logit lens, as interpretability write-ups show one: the model's top next-token guess at every layer and prompt
 * position, shaded by its probability. It shows a reader where in depth the answer forms. Selecting a cell draws, for
 * that position, how the chosen tokens' probabilities change from layer to layer, while the application decodes every
 * layer and supplies the cells and tracks.
 */
export function LogitLens({
  columns,
  layers,
  cells,
  tracks = [],
  valueFormat = percent,
  selected = null,
  onSelectedChange,
  labels: given,
  ...figure
}: LogitLensProps): ReactNode {
  const labels = { ...defaultLabels, ...given };
  const position = columns.find((column) => layers.some((layer) => tokenGridCellId(layer.id, column.id) === selected));
  const shown = position === undefined ? [] : tracks.filter((track) => track.columnId === position.id);
  const depths = layers.map((layer) => layer.depth);

  return (
    <div {...stylex.props(kitStyles.stack)}>
      <TokenGrid
        {...figure}
        columns={columns}
        rows={layers}
        cells={cells}
        domain={[0, 1]}
        palette="sequential"
        valueLabel={labels.probability}
        valueFormat={valueFormat}
        selected={selected}
        onSelectedChange={(id, details) => onSelectedChange?.(id, { reason: 'press', event: details.event })}
      />
      {position === undefined ? (
        <p {...stylex.props(kitStyles.muted)}>{labels.noPosition}</p>
      ) : (
        <CurveChart
          title={`${labels.curveTitle} ${quoteToken(position.token)}`}
          description={labels.curveDescription}
          locale={figure.locale}
          status={figure.status}
          height="compact"
          x={{
            label: labels.layer,
            domain: [Math.min(...depths), Math.max(...depths)],
            format: { maximumFractionDigits: 0 },
          }}
          y={{ label: labels.probability, domain: [0, 1], format: valueFormat }}
          labels="legend"
          series={shown.map((track) => ({
            id: track.id,
            label: quoteToken(track.token),
            points: layers.map((layer, index) => ({ x: layer.depth, y: track.probabilities[index] ?? null })),
          }))}
        />
      )}
    </div>
  );
}
