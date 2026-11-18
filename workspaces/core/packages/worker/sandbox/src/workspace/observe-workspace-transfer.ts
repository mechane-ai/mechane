import type { RecordId } from '@mechane/records';
import type { WorkspaceStep } from '@mechane/sandbox-wire';
import { capturePromise } from '@mechane/utilities';
import { Duration, Option, Result, Schema } from 'effect';
import { WorkspaceTransferFailed } from '../errors.ts';
import { writeWorkspaceTransferFailure } from '../output/write-sandbox-diagnostic.ts';
import type { WorkspaceTransferFailurePhase } from '../output/write-sandbox-diagnostic.ts';
import type { MachineIdInput } from '../types.ts';

type WorkspaceTransferInput<Value> = {
  readonly machineId: MachineIdInput['machineId'];
  readonly generation: RecordId;
  readonly step: WorkspaceStep;
  readonly part: Option.Option<number>;
  readonly phase: NonNullable<WorkspaceTransferFailed['observation']>['phase'];
  readonly failurePhase: WorkspaceTransferFailurePhase;
  readonly response: Option.Option<Response>;
  readonly run: () => Promise<Value>;
};

type WorkspaceTransferObservation = NonNullable<WorkspaceTransferFailed['observation']>;

/** A response body can fail after headers arrive, so its timing must survive the original request wrapper. */
export async function observeWorkspaceTransfer<Value>({
  machineId,
  generation,
  step,
  part,
  phase,
  failurePhase,
  response,
  run,
}: WorkspaceTransferInput<Value>): Promise<Value> {
  const started = performance.now();
  const invoke: typeof run = async () => await run();
  const promise = invoke();
  const result = await capturePromise({ promise });

  const observed = Result.mapError(result, (cause) => {
    const finished = performance.now();
    const elapsedMs = Math.round(finished - started);
    const elapsed = Duration.millis(elapsedMs);

    writeWorkspaceTransferFailure({ machineId, generation, step, part, phase: failurePhase, response, elapsed });

    const reason: string = (() => {
      if (Schema.is(WorkspaceTransferFailed)(cause)) {
        return cause.reason;
      }

      return String(cause);
    })();

    const observation: WorkspaceTransferObservation = (() => {
      if (Option.isNone(part)) {
        return { phase, elapsed };
      }

      return { phase, elapsed, part: part.value };
    })();

    return new WorkspaceTransferFailed({ generation, step, reason, observation });
  });

  return Result.getOrThrow(observed);
}
