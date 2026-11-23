import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';

const AUTOMATIC_TONES: ReadonlyArray<ChartTone> = ['series1', 'series2', 'series3', 'series4', 'series5', 'series6'];

type Tones = ReadonlyMap<string, ChartTone>;

const ScopedTones = createContext<Tones | undefined>(undefined);

/** The automatic tone of the nth thing in a figure. The six series hues repeat past the sixth. */
export function automaticTone(index: number): ChartTone {
  return AUTOMATIC_TONES[index % AUTOMATIC_TONES.length] ?? 'series1';
}

/**
 * One tone per id, in supplied order. A pinned id keeps its tone and takes no automatic slot, so a remainder group in
 * neutral never shifts the hues of the named things after it.
 */
export function assignTones(
  ids: ReadonlyArray<string>,
  pinned: Readonly<Record<string, ChartTone>> = {},
): ReadonlyMap<string, ChartTone> {
  const automatic = ids.filter((id) => pinned[id] === undefined);

  return new Map(ids.map((id) => [id, pinned[id] ?? automaticTone(automatic.indexOf(id))]));
}

export type ToneScopeProps = {
  /** Every thing the figures inside draw, such as models or runs, in the order their hues are assigned. */
  readonly ids: ReadonlyArray<string>;
  /** Tones the application pins by id. */
  readonly tones?: Readonly<Record<string, ChartTone>> | undefined;
  readonly children: ReactNode;
};

/**
 * Gives each thing one hue in every figure inside. A model that is blue in a curve is blue in the bar chart and the
 * table beside it, whatever order each figure lists its series in.
 */
export function ToneScope({ ids, tones, children }: ToneScopeProps): ReactNode {
  return <ScopedTones value={assignTones(ids, tones)}>{children}</ScopedTones>;
}

export type ToneInput = {
  readonly id: string;
  /** The tone the caller set on this record. It wins over the scope. */
  readonly tone?: ChartTone | undefined;
  /** The record's place among its figure's own records, used when no scope names it. */
  readonly index: number;
};

/** Resolves a record's tone: its own, then the enclosing scope's, then its place in the figure. */
export function useTones(): (input: ToneInput) => ChartTone {
  const scoped = useContext(ScopedTones);

  return ({ id, tone, index }) => tone ?? scoped?.get(id) ?? automaticTone(index);
}

/** The tone the enclosing scope gives `id`, or undefined when none names it. For prose and marks outside a figure. */
export function useScopedTone(id: string): ChartTone | undefined {
  return useContext(ScopedTones)?.get(id);
}
