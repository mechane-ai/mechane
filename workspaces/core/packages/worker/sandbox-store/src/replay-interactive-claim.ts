import type { ModelToolCallId } from '@mechane/records';
import type { SandboxRunId } from '@mechane/sandbox-wire';
import { Result } from 'effect';

type InteractiveIdentity = { readonly runId: SandboxRunId; readonly toolCallId: ModelToolCallId };

type ReplayInput<Claim extends InteractiveIdentity> = InteractiveIdentity & {
  readonly existing: Claim;
  readonly isSamePayload: boolean;
  readonly mismatch: Error;
};

/** Replaying an action requires its original native identity as well as its unchanged payload. */
export function replayInteractiveClaim<Claim extends InteractiveIdentity>({
  existing,
  runId,
  toolCallId,
  isSamePayload,
  mismatch,
}: ReplayInput<Claim>): Claim {
  if (existing.runId !== runId || existing.toolCallId !== toolCallId || !isSamePayload) {
    const failed = Result.fail(mismatch);

    return Result.getOrThrow(failed);
  }

  return existing;
}
