import { HttpStatusCode } from '@mechane/records';
import { Miniflare, fetch as workerFetch, Response as WorkerResponse } from 'miniflare';
import type { Request as WorkerRequest } from 'miniflare';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SandboxProcessStart } from './process-messages.ts';

const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['127.0.0.1', 'localhost', '[::1]']);
const OUTBOUND_FETCH_FIELD = 'handler';

export async function createSandboxRuntime(input: typeof SandboxProcessStart.Type): Promise<Miniflare> {
  const contents = await readFile(input.workerEntry, 'utf8');

  return new Miniflare({
    host: '127.0.0.1',
    port: 0,
    cf: false,
    telemetry: { enabled: false },
    resourcePersistencePath: join(input.directory, 'storage'),
    workers: [
      {
        config: {
          name: 'mechane-sandbox-fixture',
          compatibilityDate: '2026-10-28',
          compatibilityFlags: ['nodejs_compat'],
          manifest: { mainModule: 'worker.js', modules: { 'worker.js': { type: 'esm', contents } } },
          env: {
            SANDBOXES: { type: 'durable-object', worker: 'mechane-sandbox-fixture', exportName: 'SandboxObject' },
            WORKSPACE_FILES: { type: 'r2', name: 'mechane-workspace-files' },
            MECHANE_SANDBOX_PROVIDER: { type: 'text', value: 'host' },
            MECHANE_HOST_LAUNCHER_ORIGIN: { type: 'text', value: input.launcherOrigin },
            MECHANE_HOST_LAUNCHER_KEY: { type: 'text', value: input.bearer },
            MECHANE_SANDBOX_SERVICE_KEY: { type: 'text', value: input.bearer },
            MECHANE_RUNTIME_ORIGIN: { type: 'text', value: input.runtimeOrigin },
            MECHANE_RUNTIME_TRANSPORT: { type: 'text', value: 'null' },
          },
          exports: { SandboxObject: { type: 'durable-object', storage: 'sqlite' } },
        },
        dev: { outboundService: { type: 'fetcher', [OUTBOUND_FETCH_FIELD]: fetchLoopback } },
      },
    ],
  });
}

async function fetchLoopback(request: WorkerRequest): Promise<WorkerResponse> {
  const url = new URL(request.url);

  if (url.protocol !== 'http:' || !LOOPBACK_HOSTS.has(url.hostname)) {
    return new WorkerResponse(null, { status: HttpStatusCode.Forbidden });
  }

  return await workerFetch(request, { redirect: 'manual' });
}
