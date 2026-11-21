import { writeDiagnostic } from '@mechane/program';
import { HttpHeader, HttpMethod, HttpStatusCode } from '@mechane/records';
import { InstalledDrainReport, SANDBOX_INSTALLED_DRAIN_PATH } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import { setTimeout as delay } from 'node:timers/promises';
import type { LocalSandbox } from '../types.ts';

const STATUS_INTERVAL_MS = 250;

type DrainInput = {
  readonly origin: URL;
  readonly sandbox: LocalSandbox;
  readonly deadlineMs: number;
  readonly report: (details: Readonly<Record<string, unknown>>) => Promise<void>;
};

type RequestInput = DrainInput & {
  readonly url: URL;
  readonly method: string;
  readonly canSkipUnavailable?: () => Promise<boolean>;
};

export class InstalledDrainFailedError extends Error {
  readonly allocation: InstalledDrainReport['pending'][number];

  constructor(allocation: InstalledDrainReport['pending'][number]) {
    const reason = allocation.reason ?? 'Inspect the session computer for the retained file checkpoint';

    super(`Installed session ${allocation.sessionId} could not save its workspace: ${reason}`);

    this.name = 'InstalledDrainFailedError';
    this.allocation = allocation;
  }
}

export async function drainSandboxes(input: DrainInput): Promise<void> {
  writeDiagnostic({ program: 'stack', line: 'Inspecting local environment owners before shutdown' });

  let lastInstalledReport = '';

  do {
    const installed = await readInstalledDrain(input);
    const receipt = JSON.stringify(installed);

    if (installed.pending.length > 0 && receipt !== lastInstalledReport) {
      await input.report({ phase: 'draining', installed });

      lastInstalledReport = receipt;
    }

    const failed = installed.pending.find((allocation) => allocation.phase === 'failed');

    if (failed !== undefined) {
      throw new InstalledDrainFailedError(failed);
    }

    if (installed.pending.length === 0 && !installed.hasMore) {
      return;
    }

    await delay(STATUS_INTERVAL_MS);
  } while (Date.now() < input.deadlineMs);

  throw new Error('The local environments did not drain before the shutdown deadline; their hosts remain available');
}

async function readInstalledDrain(input: DrainInput): Promise<InstalledDrainReport> {
  const url = new URL(SANDBOX_INSTALLED_DRAIN_PATH, input.origin);

  const body = await requestJson({
    ...input,
    url,
    method: HttpMethod.Post,
    canSkipUnavailable: async () => !(await input.sandbox.hasContainers()),
  });

  if (body === undefined) {
    return { pending: [], hasMore: false };
  }

  return Schema.decodeUnknownSync(InstalledDrainReport)(body);
}

async function requestJson(input: RequestInput): Promise<unknown> {
  const headers = { [HttpHeader.Authorization]: `Bearer ${input.sandbox.bearer}` };

  do {
    const remainingMs = Math.max(1, input.deadlineMs - Date.now());

    const response = await fetch(input.url, {
      method: input.method,
      headers,
      signal: AbortSignal.timeout(remainingMs),
    }).catch(() => undefined);

    if (response === undefined || response.status === HttpStatusCode.Unavailable) {
      await response?.body?.cancel();

      if ((await input.canSkipUnavailable?.()) === true) {
        return undefined;
      }

      await delay(STATUS_INTERVAL_MS);
    } else {
      if (!response.ok) {
        await response.body?.cancel();

        throw new Error(`The local shutdown request failed at ${input.url.pathname} (${response.status})`);
      }

      return await response.json();
    }
  } while (Date.now() < input.deadlineMs);

  throw new Error('The local shutdown deadline expired; environment hosts remain available');
}
