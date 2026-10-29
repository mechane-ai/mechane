import type { StatementSpan } from '../types.ts';

type WithinInput = { readonly spans: ReadonlyArray<StatementSpan>; readonly offset: number };

/** Whether an offset falls inside one of the spans, each from its start up to its end. */
export function isWithin({ spans, offset }: WithinInput): boolean {
  return spans.some(({ start, end }) => start <= offset && offset < end);
}
