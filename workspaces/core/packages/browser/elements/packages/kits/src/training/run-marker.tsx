import type { ReactNode } from 'react';
import { ChartSeriesMarker, useScopedTone } from '../../../charts/src/index.ts';

/** The hue marker of a run: the same line mark its curves are drawn with. It needs the run's tone scope around it. */
export function RunMarker({ id }: { readonly id: string }): ReactNode {
  return <ChartSeriesMarker tone={useScopedTone(id) ?? 'neutral'} shape="line" />;
}
