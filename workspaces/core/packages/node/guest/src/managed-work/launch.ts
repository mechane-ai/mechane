import { GuestScope, INSTALLED_WORKSPACE_PATH, ManagedWorkerClaim } from '@mechane/sandbox-wire';
import { Duration, Option, Schema } from 'effect';
import { fork } from 'node:child_process';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { shellEnvironment } from '../executions/shell-environment.ts';
import { guestCommand } from '../load-guest-settings.ts';
import type { GuestSettings } from '../types.ts';

export const MANAGED_WORK_ARGUMENT = 'managed-work';
export const MANAGED_WORK_ACCEPTED = 'accepted';

export const ManagedWorkerProcessInput = Schema.Struct({
  claim: ManagedWorkerClaim,
  shell: Schema.Record(Schema.NonEmptyString, Schema.String),
});

const ADMISSION_TIMEOUT = Duration.seconds(10);
const QUIESCE_WAIT = Duration.seconds(1);
const FORCE_EXIT = Duration.seconds(30);

type WorkProcess = {
  readonly digest: string;
  readonly admission: Promise<boolean>;
  readonly isRunning: () => boolean;
  readonly isStopping: () => boolean;
  readonly quiesce: () => Promise<boolean>;
};

type LauncherInput = { readonly settings: GuestSettings; readonly isFrozen: () => boolean };
type LaunchInput = { readonly claim: ManagedWorkerClaim };
type FingerprintInput = { readonly digest: string };
type ChildInput = LaunchInput & FingerprintInput & { readonly settings: GuestSettings; readonly entry: string };

export type ManagedWorkLauncher = {
  readonly start: (input: LaunchInput) => Promise<boolean>;
  readonly quiesce: () => Promise<boolean>;
  readonly isRunning: () => boolean;
  readonly observed: (input: FingerprintInput) => Promise<boolean>;
};

function launchChild({ claim, settings, entry, digest }: ChildInput): WorkProcess {
  const request = { environment: Option.none() };
  const shell = shellEnvironment({ settings, request });

  const child = fork(entry, [MANAGED_WORK_ARGUMENT], {
    cwd: INSTALLED_WORKSPACE_PATH,
    env: shell,
    stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
    execArgv: [],
  });

  const admission = Promise.withResolvers<boolean>();
  const finished = Promise.withResolvers<void>();
  let isRunning = true;
  let isStopping = false;

  function rejectAdmission(): void {
    admission.resolve(false);
    child.kill('SIGKILL');
  }

  const admissionMs = Duration.toMillis(ADMISSION_TIMEOUT);
  const timeout = setTimeout(rejectAdmission, admissionMs).unref();

  child.once('message', (message) => {
    clearTimeout(timeout);

    if (message === MANAGED_WORK_ACCEPTED) {
      admission.resolve(true);
    } else {
      rejectAdmission();
    }
  });
  child.once('close', () => {
    clearTimeout(timeout);

    isRunning = false;

    admission.resolve(false);
    finished.resolve();
  });
  child.once('error', rejectAdmission);
  child.send({ claim, shell }, (error) => {
    const failure = Option.fromNullishOr(error);

    if (Option.isSome(failure)) {
      rejectAdmission();
    }
  });

  async function quiesce(): Promise<boolean> {
    if (!isRunning) {
      return true;
    }

    if (!isStopping) {
      isStopping = true;

      child.kill('SIGTERM');

      const graceMs = Duration.toMillis(FORCE_EXIT);
      const deadline = setTimeout(() => child.kill('SIGKILL'), graceMs).unref();

      child.once('close', () => clearTimeout(deadline));
    }

    const waitMs = Duration.toMillis(QUIESCE_WAIT);
    const wait = delay(waitMs, undefined, { ref: false });

    await Promise.race([finished.promise, wait]);

    return !isRunning;
  }

  return { digest, admission: admission.promise, isRunning: () => isRunning, isStopping: () => isStopping, quiesce };
}

export function createManagedWorkLauncher({ settings, isFrozen }: LauncherInput): ManagedWorkLauncher {
  let held = Option.none<WorkProcess>();

  async function start({ claim }: LaunchInput): Promise<boolean> {
    if (settings.scope !== GuestScope.Container || isFrozen()) {
      return false;
    }

    const digest = createHash('sha256').update(claim.workSecret).digest('hex');

    if (Option.isSome(held)) {
      if (held.value.digest === digest) {
        return await held.value.admission;
      }

      if (held.value.isRunning()) {
        return false;
      }
    }

    if (Option.isNone(guestCommand.entry)) {
      return false;
    }

    const child = launchChild({ claim, settings, entry: guestCommand.entry.value, digest });
    held = Option.some(child);

    return await child.admission;
  }

  async function quiesce(): Promise<boolean> {
    if (Option.isNone(held)) {
      return true;
    }

    return await held.value.quiesce();
  }

  async function observed({ digest }: FingerprintInput): Promise<boolean> {
    if (Option.isNone(held) || held.value.digest !== digest) {
      return false;
    }

    const current = held.value;

    if (!current.isRunning() || current.isStopping()) {
      return false;
    }

    const admitted = await current.admission;

    return admitted && current.isRunning() && !current.isStopping();
  }

  return { start, quiesce, observed, isRunning: () => Option.isSome(held) && held.value.isRunning() };
}
