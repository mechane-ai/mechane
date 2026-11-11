import { Array, Result } from 'effect';
import { reconcileCheckpointPart } from './reconcile-checkpoint-part.ts';
import type { ArchivedCheckpointInput } from './types.ts';

type ReconcileStoredCheckpointInput = ArchivedCheckpointInput & { readonly parts: ReadonlyArray<number> };

/** Reuses immutable parts after interruption without advancing the batch's durable cursor. */
export async function reconcileStoredCheckpoint({
  parts,
  ...input
}: ReconcileStoredCheckpointInput): Promise<ReadonlyArray<number>> {
  const pending = parts.map((part) => reconcileCheckpointPart({ ...input, part }));
  const settled = await Promise.allSettled(pending);
  const reconciled = Array.zip(parts, settled);

  for (const result of settled) {
    if ('reason' in result) {
      const failure = Result.fail(result.reason);

      Result.getOrThrow(failure);
    }
  }

  const missing = reconciled.filter(([, result]) => 'value' in result && !result.value);

  return missing.map(([part]) => part);
}
