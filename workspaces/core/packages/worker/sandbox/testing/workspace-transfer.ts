import { HttpHeader, HttpMethod, HttpStatusCode, MachineId, RecordId } from '@mechane/records';
import { WorkspaceStep } from '@mechane/sandbox-wire';
import { Option, Schema } from 'effect';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorkspaceTransferPhase } from '../src/errors.ts';
import type { GuestConnection, GuestTransport } from '../src/types.ts';
import { observeWorkspaceTransfer } from '../src/workspace/observe-workspace-transfer.ts';
import { workspaceRequest } from '../src/workspace/workspace-request.ts';

const machineId = MachineId.make('149414e8-3722-41df-ad64-4a5f584225c3');
const generation = RecordId.make('46c5b3bd-1cab-4350-a020-6a393a8ac3c7');
const PART_INDEX = 7;
const PRIVATE_TEXT = 'fixture-private-command-output-and-credential';
const RAY = '0123456789abcdef-SJC';
const FAILURE_REASON = String(new Error(PRIVATE_TEXT));

const identity = { machineId, generation, step: WorkspaceStep.Part, part: Option.some(PART_INDEX) } as const;

const request = {
  ...identity,
  lease: Option.none<number>(),
  init: { method: HttpMethod.Put, body: PRIVATE_TEXT, headers: { [HttpHeader.Authorization]: PRIVATE_TEXT } },
} as const;

function guestConnection({ fetch }: GuestTransport): GuestConnection {
  return {
    fetch,
    health: async () => false,
    startup: async () => Option.none(),
    execute: async () => {
      throw new Error('The transfer fixture does not execute commands');
    },
  };
}

function recordedFailure({ lines }: { readonly lines: ReadonlyArray<unknown> }): Readonly<Record<string, unknown>> {
  assert.equal(lines.length, 1);

  const line = Schema.decodeUnknownSync(Schema.String)(lines[0]);
  const record = Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.Unknown))(JSON.parse(line));
  const { elapsedMs, ...metadata } = record;

  assert.equal(typeof elapsedMs, 'number');

  return metadata;
}

async function transferResponse({ response }: { readonly response: Response }): Promise<Response> {
  const guest = guestConnection({ fetch: async () => response });

  return await workspaceRequest({ ...request, guest });
}

async function rejectedFetch(): Promise<Response> {
  const guest = guestConnection({
    fetch: async () => {
      throw new Error(PRIVATE_TEXT);
    },
  });

  return await workspaceRequest({ ...request, guest });
}

const metadata = {
  event: 'sandbox.workspace_transfer_failed',
  machineId,
  generation,
  step: WorkspaceStep.Part,
  part: PART_INDEX,
} as const;

const cases = [
  {
    name: 'a failed transfer fetch reports its boundary without private transport text',
    run: rejectedFetch,
    failure: { _tag: 'WorkspaceTransferFailed', reason: FAILURE_REASON },
    diagnostic: { phase: 'fetch' },
  },
  {
    name: 'a rejected transfer reports its status and validated ray without its headers or body',
    run: async () => {
      const response = new Response(PRIVATE_TEXT, {
        status: HttpStatusCode.Unavailable,
        headers: {
          [HttpHeader.CloudflareRay]: RAY,
          [HttpHeader.Authorization]: PRIVATE_TEXT,
          [HttpHeader.Location]: PRIVATE_TEXT,
        },
      });

      return await transferResponse({ response });
    },
    failure: { _tag: 'WorkspaceTransferFailed', reason: PRIVATE_TEXT },
    diagnostic: { phase: 'http', status: HttpStatusCode.Unavailable, cloudflareRay: RAY },
  },
  {
    name: 'a malformed correlation header is omitted from transfer diagnostics',
    run: async () => {
      const response = new Response(PRIVATE_TEXT, {
        status: HttpStatusCode.Unavailable,
        headers: { [HttpHeader.CloudflareRay]: `${RAY} ${PRIVATE_TEXT}` },
      });

      return await transferResponse({ response });
    },
    failure: { _tag: 'WorkspaceTransferFailed', reason: PRIVATE_TEXT },
    diagnostic: { phase: 'http', status: HttpStatusCode.Unavailable },
  },
  {
    name: 'a failed rejection body reports body work rather than an HTTP rejection',
    run: async () => {
      const body = new ReadableStream({ start: (controller) => controller.error(new Error(PRIVATE_TEXT)) });
      const response = new Response(body, { status: HttpStatusCode.Unavailable });

      return await transferResponse({ response });
    },
    failure: { _tag: 'WorkspaceTransferFailed', reason: FAILURE_REASON },
    diagnostic: { phase: 'body', status: HttpStatusCode.Unavailable },
  },
  {
    name: 'metadata decode failures report the response without private schema input',
    run: async () => {
      const response = new Response(PRIVATE_TEXT);
      const codec = Schema.fromJsonString(Schema.Int);

      return await observeWorkspaceTransfer({
        ...identity,
        phase: WorkspaceTransferPhase.ResponseBody,
        failurePhase: 'decode',
        response: Option.some(response),
        run: async () => Schema.decodeUnknownSync(codec)(await response.text()),
      });
    },
    failure: { _tag: 'WorkspaceTransferFailed' },
    diagnostic: { phase: 'decode', status: HttpStatusCode.Ok },
  },
] as const;

for (const fixture of cases) {
  void test(fixture.name, { timeout: 5000 }, async (context) => {
    const lines: Array<unknown> = [];

    context.mock.method(console, 'error', (line: unknown) => lines.push(line));

    await assert.rejects(fixture.run(), fixture.failure);

    assert.deepEqual(recordedFailure({ lines }), { ...metadata, ...fixture.diagnostic });
  });
}

void test('a diagnostic sink failure cannot replace the transfer failure', { timeout: 5000 }, async (context) => {
  context.mock.method(console, 'error', () => {
    throw new Error('fixture diagnostic sink is unavailable');
  });

  await assert.rejects(rejectedFetch(), { _tag: 'WorkspaceTransferFailed', reason: FAILURE_REASON });
});
