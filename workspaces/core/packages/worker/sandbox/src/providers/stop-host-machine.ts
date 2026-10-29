import { bearerAuthorization } from '@mechane/protocol';
import { HttpHeader, HttpMethod, HttpStatusCode } from '@mechane/records';
import { Duration, Redacted, Result, Schema } from 'effect';
import { ANSWER_SLACK } from '../constants.ts';
import { LauncherStep } from './constants.ts';
import { LauncherRefused } from './errors.ts';
import { machineUrl } from './machine-url.ts';
import type { HostMachineInput } from './types.ts';

/** What the host launcher answers a machine's stop. */
const LauncherStop = Schema.Struct({ status: Schema.Literal(HttpStatusCode.NoContent) });

type LauncherStop = typeof LauncherStop.Type;

/** Asks the host launcher to stop the machine, which it does once; any other answer than its success is a refusal. */
export async function stopHostMachine({
  launcherOrigin,
  launcherKey,
  machineId,
}: HostMachineInput): Promise<Result.Result<LauncherStop, LauncherRefused>> {
  const url = machineUrl({ launcherOrigin, machineId });

  const response = await fetch(url, {
    method: HttpMethod.Delete,
    headers: { [HttpHeader.Authorization]: bearerAuthorization({ token: Redacted.value(launcherKey) }) },
    signal: AbortSignal.timeout(Duration.toMillis(ANSWER_SLACK)),
  });

  const stopped = Schema.decodeUnknownResult(LauncherStop)({ status: response.status });

  if (Result.isFailure(stopped)) {
    const reason = stopped.failure.message;
    const refused = new LauncherRefused({ url, step: LauncherStep.Stop, status: response.status, reason });

    return Result.fail(refused);
  }

  return Result.succeed(stopped.success);
}
