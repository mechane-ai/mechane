import { bearerAuthorization } from '@mechane/protocol';
import { HttpHeader, HttpMethod, HttpStatusCode, MachineId, MediaType } from '@mechane/records';
import { GuestScope, HostMachine, HostMachineStart, HostMachineStatus } from '@mechane/sandbox-wire';
import { waitFor } from '@mechane/utilities';
import { DateTime, Duration, Option, Redacted, Result, Schema } from 'effect';
import { ANSWER_SLACK } from '../constants.ts';
import type { GuestConnection, MachineProvider } from '../types.ts';
import { LauncherStep } from './constants.ts';
import { LauncherRefused } from './errors.ts';
import { loopbackGuest } from './loopback-guest.ts';
import { machineStartupTimeout } from './machine-startup-timeout.ts';
import { machineUrl } from './machine-url.ts';
import type { HostMachineInput, HostProviderInput } from './types.ts';

const LauncherReport = Schema.Struct({
  status: Schema.Literal(HttpStatusCode.Ok),
  body: Schema.fromJsonString(HostMachine),
});

type LauncherReport = typeof LauncherReport.Type;
const StartJson = Schema.fromJsonString(HostMachineStart);
const STOP_POLL = Duration.millis(25);
const REPORT_STEPS = { [HttpMethod.Put]: LauncherStep.Start, [HttpMethod.Get]: LauncherStep.Inspect } as const;
type HostReportInput = HostMachineInput & { readonly method: keyof typeof REPORT_STEPS };

type LauncherFailureInput = {
  readonly url: URL;
  readonly step: LauncherStep;
  readonly status: number;
  readonly reason: string;
};

/** Local guest processes: reads never start one, and stops return only after the guest has exited. */
export function hostProvider({
  launcherOrigin,
  launcherKey,
  additionalTools,
  isBrowserSandboxDisabled,
  trustedCertificatesPem,
}: HostProviderInput): MachineProvider {
  const start: MachineProvider['start'] = async ({ machineId }) => {
    await hostMachine({
      launcherOrigin,
      launcherKey,
      additionalTools,
      isBrowserSandboxDisabled,
      trustedCertificatesPem,
      machineId,
      method: HttpMethod.Put,
    });
  };

  const connect: MachineProvider['connect'] = async ({ machineId }) => {
    const machine = await hostMachine({
      launcherOrigin,
      launcherKey,
      additionalTools,
      isBrowserSandboxDisabled,
      trustedCertificatesPem,
      machineId,
      method: HttpMethod.Get,
    });

    switch (machine.state) {
      case HostMachineStatus.Starting:
      case HostMachineStatus.Exited:
        return Option.none<GuestConnection>();
      case HostMachineStatus.Running: {
        const guest = loopbackGuest({ launcherOrigin, port: machine.port });

        return Option.some(guest);
      }
    }
  };

  const stop: MachineProvider['stop'] = async ({ machineId }) => {
    const url = machineUrl({ launcherOrigin, machineId });
    const now = DateTime.nowUnsafe();
    const deadline = DateTime.addDuration(now, ANSWER_SLACK);
    const token = Redacted.value(launcherKey);
    const authorization = bearerAuthorization({ token });
    const timeoutMs = Duration.toMillis(ANSWER_SLACK);
    const signal = AbortSignal.timeout(timeoutMs);

    const response = await fetch(url, {
      method: HttpMethod.Delete,
      headers: { [HttpHeader.Authorization]: authorization },
      signal,
    });

    if (response.status !== HttpStatusCode.NoContent) {
      launcherFailure({ url, step: LauncherStep.Stop, status: response.status, reason: 'launcher refused stop' });
    }

    let checkedAt = DateTime.nowUnsafe();

    while (DateTime.isLessThan(checkedAt, deadline)) {
      const machine = await hostMachine({
        launcherOrigin,
        launcherKey,
        additionalTools,
        isBrowserSandboxDisabled,
        trustedCertificatesPem,
        machineId,
        method: HttpMethod.Get,
      });

      if (machine.state === HostMachineStatus.Exited) {
        return;
      }

      await waitFor({ span: STOP_POLL });

      checkedAt = DateTime.nowUnsafe();
    }

    launcherFailure({ url, step: LauncherStep.Stop, status: response.status, reason: 'machine stop is not confirmed' });
  };

  const startupTimeout: MachineProvider['startupTimeout'] = () => machineStartupTimeout({ tools: additionalTools });

  const isAbsent: MachineProvider['isAbsent'] = async ({ machineId }) => {
    const machine = await hostMachine({
      launcherOrigin,
      launcherKey,
      additionalTools,
      isBrowserSandboxDisabled,
      trustedCertificatesPem,
      machineId,
      method: HttpMethod.Get,
    });

    return machine.state === HostMachineStatus.Exited;
  };

  return { start, connect, stop, startupTimeout, isAbsent };
}

/** PUT starts one identity once; GET observes it without allocating. The launcher returns only a machine report. */
async function hostMachine({
  launcherOrigin,
  launcherKey,
  additionalTools,
  isBrowserSandboxDisabled,
  trustedCertificatesPem,
  machineId,
  method,
}: HostReportInput): Promise<HostMachine> {
  const url = machineUrl({ launcherOrigin, machineId });
  const token = Redacted.value(launcherKey);
  const authorization = bearerAuthorization({ token });
  const timeoutMs = Duration.toMillis(ANSWER_SLACK);
  const signal = AbortSignal.timeout(timeoutMs);
  let start = Option.none<string>();

  if (method === HttpMethod.Put) {
    const browserCertificateFile = Option.none();

    const identity = MachineId.make(machineId);

    const encoded = Schema.encodeSync(StartJson)({
      environment: {
        machineId: identity,
        scope: GuestScope.Process,
        additionalTools,
        isBrowserSandboxDisabled,
        browserCertificateFile,
        trustedCertificatesPem,
      },
    });

    start = Option.some(encoded);
  }

  const body = Option.getOrNull(start);

  const response = await fetch(url, {
    method,
    headers: { [HttpHeader.Authorization]: authorization, [HttpHeader.ContentType]: MediaType.Json },
    body,
    signal,
  });

  const text = await response.text();
  const report = Schema.decodeUnknownResult(LauncherReport)({ status: response.status, body: text });

  if (Result.isFailure(report)) {
    launcherFailure({ url, step: REPORT_STEPS[method], status: response.status, reason: report.failure.message });
  }

  return report.success.body;
}

function launcherFailure({ url, step, status, reason }: LauncherFailureInput): never {
  const cause = new LauncherRefused({ url, step, status, reason });
  const failure = Result.fail(cause);

  return Result.getOrThrow(failure);
}
