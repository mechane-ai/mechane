import { bearerAuthorization } from '@mechane/protocol';
import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import { GuestScope, HostMachine, HostMachineStart, HostMachineStatus } from '@mechane/sandbox-wire';
import { Duration, Option, Redacted, Result, Schema } from 'effect';
import { ANSWER_SLACK } from '../constants.ts';
import type { GuestConnection, MachineProvider } from '../types.ts';
import { LauncherStep } from './constants.ts';
import { LauncherRefused } from './errors.ts';
import { loopbackGuest } from './loopback-guest.ts';
import { machineUrl } from './machine-url.ts';
import { stopHostMachine } from './stop-host-machine.ts';
import type { HostMachineInput, HostProviderInput } from './types.ts';

/** What the host launcher answers a machine's start: the machine's report, and no other status. */
const LauncherReport = Schema.Struct({
  status: Schema.Literal(HttpStatusCode.Ok),
  body: Schema.fromJsonString(HostMachine),
});

type LauncherReport = typeof LauncherReport.Type;

/**
 * Machines as processes of a local stack's host launcher, which starts a machine id once and reports it on every later
 * start, so a start also reads it. A refusal fails the call with `LauncherRefused`, since only a misconfigured stack
 * refuses. It is not isolation: a machine runs as the person who started the stack.
 */
export function hostProvider({ launcherOrigin, launcherKey }: HostProviderInput): MachineProvider {
  const start: MachineProvider['start'] = async ({ machineId }) => {
    Result.getOrThrow(await hostMachine({ launcherOrigin, launcherKey, machineId }));
  };

  const connect: MachineProvider['connect'] = async ({ machineId }) => {
    const machine = Result.getOrThrow(await hostMachine({ launcherOrigin, launcherKey, machineId }));

    switch (machine.state) {
      case HostMachineStatus.Starting:
      case HostMachineStatus.Exited:
        return Option.none<GuestConnection>();
      case HostMachineStatus.Running:
        return Option.some(loopbackGuest({ launcherOrigin, port: machine.port }));
    }
  };

  const stop: MachineProvider['stop'] = async ({ machineId }) => {
    Result.getOrThrow(await stopHostMachine({ launcherOrigin, launcherKey, machineId }));
  };

  return { start, connect, stop, suspend: Option.none(), manage: Option.none() };
}

/** Starts the machine with the variables a container gets, and reports it; a repeat starts nothing. */
async function hostMachine({
  launcherOrigin,
  launcherKey,
  machineId,
}: HostMachineInput): Promise<Result.Result<HostMachine, LauncherRefused>> {
  const url = machineUrl({ launcherOrigin, machineId });

  const response = await fetch(url, {
    method: HttpMethod.Put,
    headers: {
      [HttpHeader.Authorization]: bearerAuthorization({ token: Redacted.value(launcherKey) }),
      [HttpHeader.ContentType]: MediaType.Json,
    },
    // The machine's id is a UUID this object drew, so encoding the start cannot fail.
    body: Schema.encodeSync(Schema.fromJsonString(HostMachineStart))({
      environment: { machineId, scope: GuestScope.Process },
    }),
    signal: AbortSignal.timeout(Duration.toMillis(ANSWER_SLACK)),
  });

  const report = Schema.decodeUnknownResult(LauncherReport)({ status: response.status, body: await response.text() });

  if (Result.isFailure(report)) {
    const reason = report.failure.message;
    const refused = new LauncherRefused({ url, step: LauncherStep.Start, status: response.status, reason });

    return Result.fail(refused);
  }

  return Result.succeed(report.success.body);
}
