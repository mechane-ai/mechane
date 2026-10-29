import { SandboxMaintenanceFailed } from '@mechane/cli-kernel';
import type { RunFailure } from '@mechane/cli-kernel';
import { SandboxAction, SandboxPhase } from '@mechane/protocol';
import { DateTime, Duration, Effect, Equal, Option } from 'effect';
import { Buffer } from 'node:buffer';
import type { SandboxCallInput } from './types.ts';

const DOWNLOAD_TIMEOUT = Duration.minutes(2);
const DOWNLOAD_POLL = Duration.millis(500);

/** A suspended export may need several polls to become readable again. */
export const downloadPart = Effect.fn('downloadPart')(function* ({
  call,
  token,
  workspaceId,
  mechId,
  request,
}: SandboxCallInput): Effect.fn.Return<Buffer, RunFailure> {
  const now = DateTime.nowUnsafe();
  const deadline = DateTime.addDuration(now, DOWNLOAD_TIMEOUT);

  for (let observedAt = now; DateTime.isLessThan(observedAt, deadline); observedAt = DateTime.nowUnsafe()) {
    const report = yield* call({
      name: 'manageSandbox',
      credential: token,
      input: { ...request, action: SandboxAction.Download, workspaceId, mechId },
    });

    if (!Equal.equals(report.operationId, request.operationId) || report.phase !== SandboxPhase.Done) {
      return yield* new SandboxMaintenanceFailed({
        reason: 'the export is no longer available; inspect the current sandbox operation',
      });
    }

    if (Option.isSome(report.base64)) {
      return Buffer.from(report.base64.value, 'base64');
    }

    yield* Effect.sleep(DOWNLOAD_POLL);
  }

  return yield* new SandboxMaintenanceFailed({ reason: `archive part ${request.part} did not become readable` });
});
