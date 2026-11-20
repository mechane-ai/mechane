import Anthropic from '@anthropic-ai/sdk';
import { capturePromise } from '@mechane/utilities';
import { decodeWorkSecretToken } from '@mechane/worker-agent';
import { Duration, Option, Result, Schema } from 'effect';
import { once } from 'node:events';
import { startComputerRelay } from './computer-relay.ts';
import type { RunInstalledCommand } from './installed-bash.ts';
import { MANAGED_WORK_ACCEPTED, ManagedWorkerProcessInput } from './launch.ts';
import { leaseTransport } from './lease-transport.ts';
import { installedSessionTools } from './session-tools.ts';

type ProcessEntry = { readonly signal: AbortSignal; readonly runCommand: RunInstalledCommand };

export async function runManagedWorker({ signal, runCommand }: ProcessEntry): Promise<void> {
  const received: ReadonlyArray<unknown> = await once(process, 'message', { signal });
  const { claim, shell } = await Schema.decodeUnknownPromise(ManagedWorkerProcessInput)(received[0]);
  const token = decodeWorkSecretToken(claim.workSecret);
  const lifetime = new AbortController();
  const sessionSignal = AbortSignal.any([signal, lifetime.signal]);
  const { apiOrigin, environmentId, sessionId, workId, workSecret } = claim;
  const transport = leaseTransport({ origin: apiOrigin, environmentId, workId, sessionId, signal: sessionSignal });
  const client = new Anthropic({ authToken: token, baseURL: apiOrigin, logLevel: 'off', fetch: transport });
  const workdir = process.cwd();
  const computer = await startComputerRelay({ apiOrigin, sessionId, token, transport, signal: sessionSignal });

  const workspace = installedSessionTools({
    origin: apiOrigin,
    sessionId,
    token,
    shell,
    transport,
    computer,
    runCommand,
    signal: sessionSignal,
    workdir,
  });

  async function handleClaim(): Promise<void> {
    const idleDuration = Option.fromNullishOr(claim.maxIdle);

    const worker = Option.match(idleDuration, {
      onNone: () => client.beta.environments.work.worker({ workdir, tools: workspace.tools }),
      onSome: (duration) => {
        const maxIdleMs = Duration.toMillis(duration);

        return client.beta.environments.work.worker({ workdir, tools: workspace.tools, maxIdleMs });
      },
    });

    sessionSignal.throwIfAborted();

    if (typeof process.send === 'function') {
      process.send(MANAGED_WORK_ACCEPTED);
      process.disconnect();
    }

    await worker.handleItem({ workId, sessionId, environmentId, workSecret, signal: sessionSignal });
  }

  const promise = handleClaim();
  const handled = await capturePromise({ promise });

  lifetime.abort();

  const closing = [computer.close(), workspace.close()];

  await Promise.all(closing);
  Result.getOrThrow(handled);
}
