import { writeDiagnostic } from '@mechane/program';
import { SANDBOX_OWNERS_PATH, SandboxOwnerPage, SandboxOwnerQuery } from '@mechane/protocol';
import { HttpHeader, HttpMethod, HttpStatusCode } from '@mechane/records';
import { sandboxStopPath, SandboxStopPhase, sandboxStopReadPath, SandboxStopReceipt } from '@mechane/sandbox-wire';
import type { SandboxCapacityIdentity } from '@mechane/sandbox-wire';
import { Option, Schema } from 'effect';
import { setTimeout as delay } from 'node:timers/promises';
import type { LocalSandbox } from '../types.ts';

const STATUS_INTERVAL_MS = 250;

type DrainInput = {
  readonly origin: URL;
  readonly sandbox: LocalSandbox;
  readonly deadlineMs: number;
  readonly report: (details: Readonly<Record<string, unknown>>) => Promise<void>;
};

type RequestInput = DrainInput & { readonly url: URL; readonly method: string };
type DrainOwnerInput = DrainInput & { readonly owner: SandboxCapacityIdentity };

export async function drainSandboxes(input: DrainInput): Promise<void> {
  writeDiagnostic({ program: 'stack', line: 'Inspecting local environment owners before shutdown' });

  const completed = new Set<string>();

  async function drainUnfinished(owner: SandboxCapacityIdentity): Promise<void> {
    const identity = JSON.stringify(owner);

    if (completed.has(identity)) {
      return;
    }

    await drainOwner({ ...input, owner });

    completed.add(identity);
  }

  async function drainBatch(owners: ReadonlyArray<SandboxCapacityIdentity>): Promise<void> {
    for (const owner of owners) {
      await drainUnfinished(owner);
    }
  }

  do {
    const owners = await readOwners(input);

    if (owners.length === 0) {
      return;
    }

    await drainBatch(owners);

    await delay(STATUS_INTERVAL_MS);
  } while (Date.now() < input.deadlineMs);

  throw new Error('The local environments did not drain before the shutdown deadline; their hosts remain available');
}

async function readOwners(input: DrainInput): Promise<ReadonlyArray<SandboxCapacityIdentity>> {
  const owners: Array<SandboxCapacityIdentity> = [];
  const cursor: { afterMechId: typeof SandboxOwnerPage.Type.nextAfterMechId } = { afterMechId: null };

  do {
    const query = Schema.encodeSync(SandboxOwnerQuery)({ afterMechId: Option.fromNullishOr(cursor.afterMechId) });
    const parameters = new URLSearchParams(query);
    const url = new URL(SANDBOX_OWNERS_PATH, input.origin);

    url.search = parameters.toString();

    const body = await requestJson({ ...input, url, method: HttpMethod.Get });
    const page = Schema.decodeUnknownSync(SandboxOwnerPage)(body);

    owners.push(...page.owners);

    if (!page.hasMore) {
      return owners;
    }

    if (page.nextAfterMechId === null || page.nextAfterMechId === cursor.afterMechId) {
      throw new Error('The local sandbox owner page did not advance; its hosts remain available');
    }

    cursor.afterMechId = page.nextAfterMechId;
  } while (Date.now() < input.deadlineMs);

  throw new Error('The local sandbox owner inspection exceeded the shutdown deadline; its hosts remain available');
}

async function drainOwner(input: DrainOwnerInput): Promise<void> {
  const path = sandboxStopPath(input.owner);
  const url = new URL(path, input.sandbox.origin);
  const body = await requestJson({ ...input, url, method: HttpMethod.Post });
  const initial = Schema.decodeUnknownSync(SandboxStopReceipt)(body);
  const observationPath = sandboxStopReadPath({ ...input.owner, operationId: initial.operationId });
  const observationUrl = new URL(observationPath, input.sandbox.origin);
  const state = { receipt: initial, previousPhase: '' };

  do {
    const receipt = state.receipt;

    if (receipt.phase !== state.previousPhase) {
      const encoded = Schema.encodeSync(SandboxStopReceipt)(receipt);

      writeDiagnostic({ program: 'stack', line: `Environment ${input.owner.mechId}: ${receipt.phase}` });

      await input.report({ phase: 'draining', owner: input.owner, stop: encoded });

      state.previousPhase = receipt.phase;
    }

    if (receipt.phase === SandboxStopPhase.Completed) {
      return;
    }

    if (receipt.phase === SandboxStopPhase.Failed) {
      throw new Error(`Environment stop ${receipt.operationId} failed; recovery action: ${receipt.recoveryAction}`);
    }

    await delay(STATUS_INTERVAL_MS);

    const observed = await requestJson({ ...input, url: observationUrl, method: HttpMethod.Get });

    state.receipt = Schema.decodeUnknownSync(SandboxStopReceipt)(observed);
  } while (Date.now() < input.deadlineMs);

  throw new Error(`Environment stop ${initial.operationId} exceeded the shutdown deadline; its host remains available`);
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
