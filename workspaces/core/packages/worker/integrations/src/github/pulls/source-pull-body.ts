import type { SourceId } from '@mechane/records';

type SourcePullBodyInput = { readonly sourceId: SourceId; readonly body: string };

/** Retains a stable source marker for a retried draft-pull publication. */
export function sourcePullBody({ sourceId, body }: SourcePullBodyInput): string {
  return `${body}\n\n<!-- mechane-source:${sourceId} -->`;
}
