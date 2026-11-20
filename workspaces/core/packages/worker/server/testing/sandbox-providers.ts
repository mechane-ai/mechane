import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import { createModalSandboxProvider } from '@mechane/sandbox-modal';
import type { SandboxLeaseSpecification } from '@mechane/sandbox-provider';
import { createTensorlakeSandboxProvider } from '@mechane/sandbox-tensorlake';
import { Option } from 'effect';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { test } from 'node:test';
import { promisify } from 'node:util';

const SNAPSHOT_COMPLETE_POLL_COUNT = 2;
const TEST_CPU_CORES = 4;
const TEST_MEMORY_MEGABYTES = 8192;
const RESUME_GENERATION = 2;

type FixtureReply = { readonly status?: number; readonly body?: unknown };

type FixtureRouteInput = {
  readonly method: string;
  readonly path: string;
  readonly authorization: string | undefined;
  readonly body: unknown;
};

type FixtureResponder = (input: FixtureRouteInput) => FixtureReply;

type FixtureServer = { readonly origin: string; readonly close: () => Promise<void> };

function baseLease(overrides: Partial<SandboxLeaseSpecification> = {}): SandboxLeaseSpecification {
  return {
    workspaceId: 'ws_1',
    environmentId: 'env_1',
    sessionId: 'sesn_1',
    generation: 1,
    workId: 'work_1',
    workSecret: 'secret_1',
    apiOrigin: 'https://mechane.example',
    image: 'mechane-guest:latest',
    existingSandboxId: null,
    snapshotId: null,
    ...overrides,
  };
}

async function readRequestBody(request: IncomingMessage): Promise<unknown> {
  const parts: Array<string> = [];

  request.setEncoding('utf8');

  for await (const chunk of request) {
    parts.push(String(chunk));
  }

  const raw = parts.join('');

  if (raw.length === 0) {
    return null;
  }

  return JSON.parse(raw);
}

async function startFixtureServer(respond: FixtureResponder): Promise<FixtureServer> {
  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    async function serve(): Promise<void> {
      const body = await readRequestBody(request);

      const reply = respond({
        method: request.method ?? HttpMethod.Get,
        path: request.url ?? '/',
        authorization: request.headers.authorization,
        body,
      });

      const status = reply.status ?? HttpStatusCode.Ok;

      if (reply.body !== undefined) {
        response.writeHead(status, { [HttpHeader.ContentType]: MediaType.Json });
        response.end(JSON.stringify(reply.body));

        return;
      }

      response.writeHead(status);
      response.end();
    }

    void serve();
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const bound = Option.fromNullishOr(server.address());

  assert.ok(Option.isSome(bound) && typeof bound.value === 'object');

  const closeServer = promisify(server.close.bind(server));

  return {
    origin: `http://127.0.0.1:${bound.value.port}`,
    close: async (): Promise<void> => {
      await closeServer();
    },
  };
}

void test('tensorlake sandbox provider creates, snapshots, suspends, resumes, and destroys over HTTPS', async (context) => {
  const seenRequests: Array<{ readonly method: string; readonly path: string }> = [];
  const state = { snapshotPolls: 0 };

  const fixture = await startFixtureServer(({ method, path, authorization }) => {
    assert.equal(authorization, 'Bearer tl-secret-key');
    seenRequests.push({ method, path });

    if (method === HttpMethod.Post && path === '/sandboxes') {
      return { body: { sandbox_id: 'sbx_tl_1', status: 'running', sandbox_url: 'https://sbx.tensorlake.ai' } };
    }

    if (method === HttpMethod.Post && path === '/sandboxes/sbx_tl_1/snapshot') {
      return { body: { snapshot_id: 'snap_tl_1', status: 'creating' } };
    }

    if (method === HttpMethod.Get && path === '/snapshots/snap_tl_1') {
      state.snapshotPolls += 1;

      const snapshotStatus: string = (() => {
        if (state.snapshotPolls >= SNAPSHOT_COMPLETE_POLL_COUNT) {
          return 'completed';
        }

        return 'creating';
      })();

      return { body: { snapshot_id: 'snap_tl_1', status: snapshotStatus, created_at: '2026-11-20T00:00:00Z' } };
    }

    if (method === HttpMethod.Post && path === '/sandboxes/sbx_tl_1/suspend') {
      return { status: HttpStatusCode.Accepted, body: { status: 'suspended' } };
    }

    if (method === HttpMethod.Post && path === '/sandboxes/sbx_tl_1/resume') {
      return { body: { sandbox_id: 'sbx_tl_1', status: 'running' } };
    }

    if (method === HttpMethod.Get && path === '/sandboxes/sbx_tl_1') {
      return { body: { sandbox_id: 'sbx_tl_1', status: 'running' } };
    }

    if (method === HttpMethod.Delete && path === '/sandboxes/sbx_tl_1') {
      return { status: HttpStatusCode.NoContent };
    }

    return { status: HttpStatusCode.NotFound, body: { error: 'not found' } };
  });

  context.after(fixture.close);

  const provider = createTensorlakeSandboxProvider({ apiKey: 'tl-secret-key', baseUrl: fixture.origin });
  const createLease = baseLease({ cpuCores: TEST_CPU_CORES, memoryMegabytes: TEST_MEMORY_MEGABYTES });
  const created = await provider.startOrResume(createLease);

  assert.equal(created.sandboxId, 'sbx_tl_1');
  assert.equal(created.status, 'running');

  const stopped = await provider.stop({ sandboxId: created.sandboxId, shouldSnapshot: true });

  assert.equal(stopped.snapshotId, 'snap_tl_1');
  assert.equal(state.snapshotPolls, SNAPSHOT_COMPLETE_POLL_COUNT);

  const resumeLease = baseLease({
    generation: RESUME_GENERATION,
    existingSandboxId: 'sbx_tl_1',
    snapshotId: stopped.snapshotId,
  });

  const resumed = await provider.startOrResume(resumeLease);

  assert.equal(resumed.sandboxId, 'sbx_tl_1');

  const activeStatus = await provider.status({ sandboxId: 'sbx_tl_1' });
  const missingStatus = await provider.status({ sandboxId: 'sbx_missing' });

  assert.equal(activeStatus.status, 'running');
  assert.equal(missingStatus.status, 'stopped');

  await provider.destroy({ sandboxId: 'sbx_tl_1' });

  const sawDestroy = seenRequests.some(
    (entry) => entry.method === HttpMethod.Delete && entry.path === '/sandboxes/sbx_tl_1',
  );

  assert.ok(sawDestroy);
});

void test('modal sandbox provider starts from snapshot, snapshots, stops, and destroys over HTTPS', async (context) => {
  const seenStarts: Array<unknown> = [];

  const fixture = await startFixtureServer(({ method, path, authorization, body }) => {
    assert.equal(authorization, 'Bearer modal-bridge-token');

    if (method === HttpMethod.Post && path === '/v1/sandboxes/start-or-resume') {
      seenStarts.push(body);

      return { body: { sandbox_id: 'sb_modal_42', status: 'running' } };
    }

    if (method === HttpMethod.Post && path === '/v1/sandboxes/sb_modal_42/snapshot') {
      return { body: { snapshot_id: 'im-modal-snap-1', created_at: '2026-11-20T00:00:00Z' } };
    }

    if (method === HttpMethod.Post && path === '/v1/sandboxes/sb_modal_42/stop') {
      return { body: { snapshot_id: 'im-modal-snap-2' } };
    }

    if (method === HttpMethod.Get && path === '/v1/sandboxes/sb_modal_42') {
      return { body: { sandbox_id: 'sb_modal_42', status: 'running' } };
    }

    if (method === HttpMethod.Delete && path === '/v1/sandboxes/sb_modal_42') {
      return { body: { deleted: true } };
    }

    return { status: HttpStatusCode.NotFound, body: { detail: 'not found' } };
  });

  context.after(fixture.close);

  const provider = createModalSandboxProvider({
    baseUrl: fixture.origin,
    bearerToken: 'modal-bridge-token',
    appName: 'mechane-test',
  });

  const startLease = baseLease({ sessionId: 'sesn_9', snapshotId: 'im-modal-prev' });
  const handle = await provider.startOrResume(startLease);

  assert.equal(handle.sandboxId, 'sb_modal_42');
  assert.equal(seenStarts.length, 1);

  const capturedSnapshot = await provider.snapshot({ sandboxId: 'sb_modal_42' });

  assert.equal(capturedSnapshot.snapshotId, 'im-modal-snap-1');

  const stopped = await provider.stop({ sandboxId: 'sb_modal_42', shouldSnapshot: true });
  const missingStatus = await provider.status({ sandboxId: 'sb_missing' });

  assert.equal(stopped.snapshotId, 'im-modal-snap-2');
  assert.equal(missingStatus.status, 'stopped');

  await provider.destroy({ sandboxId: 'sb_modal_42' });
});
