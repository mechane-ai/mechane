import type { SourceFence } from '@mechane/sandbox-store';
import type { SourceFenceReport } from '@mechane/sandbox-wire';

type SourceReportInput = { readonly fence: SourceFence };

/** Public progress omits guest identity and the private machine-preparation journal. */
export function sourceReport({ fence }: SourceReportInput): SourceFenceReport {
  const { sourceId, generation, phase, expiresAt, reason } = fence;

  return { sourceId, generation, phase, expiresAt, reason };
}
