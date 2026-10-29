import { SourceFencePhase } from '@mechane/sandbox-wire';
import type { SourceFenceReport } from '@mechane/sandbox-wire';
import { Option } from 'effect';
import { sourceReport } from './source-report.ts';
import type { SourceFinalizeInput } from './types.ts';

type FailSourceInput = Pick<SourceFinalizeInput, 'store' | 'fence'> & { readonly reason: string };

/** Records failure after the caller has handled any machine or credential lease that must remain protected. */
export function failSource({ store, fence, reason }: FailSourceInput): SourceFenceReport {
  const failed = { ...fence, phase: SourceFencePhase.Failed, reason: Option.some(reason) };

  store.saveSourceFence({ fence: failed });

  return sourceReport({ fence: failed });
}
