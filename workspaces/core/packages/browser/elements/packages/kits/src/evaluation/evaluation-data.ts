import { useChartLinkControl } from '../../../charts/src/index.ts';
import type { ChartTone, ValueFormat } from '../../../charts/src/index.ts';

/** A model as every evaluation component names it. One id per model keeps its hue and linked highlight everywhere. */
export type EvaluationModel = {
  readonly id: string;
  /** The name a reader sees: "Atlas 13B". */
  readonly label: string;
  /** One short line under the name, such as the checkpoint or the release date. */
  readonly detail?: string | undefined;
  /** Pins the model's hue. Absent takes the next series hue in the order the models are listed. */
  readonly tone?: ChartTone | undefined;
};

/** An estimate with the bounds the application computed around it, such as a 95% confidence interval. */
export type ScoreInterval = { readonly value: number; readonly low: number; readonly high: number };

/** One measured score: a number, an estimate with its interval, or null where it was not measured. */
export type ScoreValue = number | ScoreInterval | null;

/** True for an estimate that carries its interval. */
export function isScoreInterval(value: ScoreValue | ReadonlyArray<number | null>) {
  return typeof value === 'object' && value !== null && 'value' in value;
}

/** The first id that appears twice, or undefined when every id is unique. */
export function repeatedId(ids: ReadonlyArray<string>): string | undefined {
  return ids.find((id, index) => ids.indexOf(id) !== index);
}

/** A value format that always writes its sign, so a gain and a loss never read alike. */
export function signedFormat(format: ValueFormat): ValueFormat {
  return typeof format === 'function' ? format : { signDisplay: 'exceptZero', ...format };
}

/**
 * Points the enclosing chart link at the table row a mouse or the keyboard rests on, so the linked figures mark the
 * same record. Leaving the table clears the link only while it still holds one of this table's rows. Outside a link it
 * does nothing.
 */
export function useLinkedRows(ids: ReadonlyArray<string>): (id: string | undefined) => void {
  const control = useChartLinkControl();

  return (id) => {
    if (control === undefined) {
      return;
    }

    if (id !== undefined) {
      control.inspect(id, { reason: 'item-hover' });

      return;
    }

    if (control.inspected !== null && ids.includes(control.inspected)) {
      control.inspect(null, { reason: 'item-hover' });
    }
  };
}
