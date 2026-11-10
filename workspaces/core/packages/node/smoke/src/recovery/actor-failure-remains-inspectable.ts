import { Event, EventType, TurnStatus, UnansweredReason } from '@mechane/protocol';
import type { Trace } from '@mechane/protocol';
import { HttpStatusCode } from '@mechane/records';
import type { ModelFixture } from '@mechane/stack';
import {
  createAccount,
  createMech,
  readConsoleMessages,
  readEvents,
  readTrace,
  requireFixtures,
  sendNotificationAndWait,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const GENERATION_ID = 'gen-1794259874-AbCdEfGhIjKlMnOpQrStUvWx';
const PROVIDER_FAILURE_ATTEMPTS = 3;

export async function actorFailureRemainsInspectable({ stack }: ScenarioInput): Promise<void> {
  const fixtures = requireFixtures(stack);
  const account = await createAccount({ stack });
  const mech = await createMech({ stack, account, name: `failed-provider-${randomUUID()}` });
  const owner = { stack, account, mechId: mech.id };
  const errorCanary = `private-provider-error-${randomUUID()}`;
  const metadataCanary = `provider-metadata-${randomUUID()}`;
  const canaries = [fixtures.model.apiKey, errorCanary, metadataCanary];

  const streamError = {
    code: HttpStatusCode.TooManyRequests,
    type: 'rate_limit_error',
    param: 'model',
    message: `${fixtures.model.apiKey} ${errorCanary}`,
    metadata: { raw: `${fixtures.model.apiKey} ${errorCanary}`, unexpected_detail: metadataCanary },
  };

  const replies = [
    { status: HttpStatusCode.BadRequest },
    { status: HttpStatusCode.Unavailable },
    { streamError, streamResponseId: GENERATION_ID },
    { streamError },
    { streamError: { ...streamError, type: metadataCanary, param: metadataCanary }, streamResponseId: metadataCanary },
  ];

  for (const reply of replies) {
    const marker = `failed-provider-${randomUUID()}`;

    fixtures.model.configure({ marker, replies: Array.from({ length: PROVIDER_FAILURE_ATTEMPTS }, () => reply) });

    const failed = await sendNotificationAndWait({ ...owner, text: marker });

    if (failed.status !== TurnStatus.Failed) {
      throw new Error('The failed model request has no terminal activation');
    }

    assert.equal(failed.reason, UnansweredReason.Faulted);

    const address = { ...owner, turnId: failed.id };
    const trace = await readTrace(address);
    const events = await readEvents(owner);
    const calls = fixtures.model.readCalls({ marker });

    assert.ok(calls.length > 0);

    if (reply.status === HttpStatusCode.Unavailable) {
      assert.ok(calls.length > 1, 'The transient provider failure did not exercise native retries');
    }

    assert.equal(trace.dispatches.length, calls.length, 'A provider attempt has no durable spend reservation');
    assert.equal(new Set(trace.dispatches.map((dispatch) => dispatch.id)).size, calls.length);

    assertProviderDiagnostic({ trace, reply });

    const failure = events.events.find(
      (event) => Schema.is(Event)(event) && event.type === EventType.ActivationFailed && event.turnId === failed.id,
    );

    assert.ok(Schema.is(Event)(failure) && failure.type === EventType.ActivationFailed);
    assert.ok(failure.reason.length > 0, 'The provider failure has no inspectable diagnostic');

    const [storage, log] = await Promise.all([stack.dumpStorage(), readFile(stack.serverLog, 'utf8')]);
    const surfaces = [storage, log, JSON.stringify({ trace, events }), JSON.stringify(calls.map((call) => call.body))];

    assertFailureCanariesAbsent({ canaries, surfaces });

    await stack.restart({ signal: 'SIGKILL' });

    assert.deepEqual(await readTrace(address), trace);
    assert.deepEqual(await readEvents(owner), events);
    assert.equal(
      fixtures.model.readCalls({ marker }).length,
      calls.length,
      'Failure inspection repeated a paid request',
    );

    const conversation = await readConsoleMessages(owner);

    assert.equal(conversation.messages.filter((message) => message.role === 'assistant').length, 0);
  }
}

type ModelReply = Parameters<ModelFixture['configure']>[0]['replies'][number];
type ProviderDiagnosticInput = { readonly trace: Trace; readonly reply: ModelReply };

function assertProviderDiagnostic({ trace, reply }: ProviderDiagnosticInput): void {
  const diagnosticMarker = '\nMechane provider diagnostic: ';
  const notice = trace.evidenceNotices?.find((candidate) => candidate.includes(diagnosticMarker));

  assert.ok(notice !== undefined, 'The terminal trace lost the safe provider diagnostic');

  const diagnostic = Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.Unknown))(
    JSON.parse(notice.slice(notice.indexOf(diagnosticMarker) + diagnosticMarker.length)),
  );

  assert.equal(diagnostic['attempt_id'], trace.dispatches.at(-1)?.id);
  assert.equal(typeof diagnostic['generation_task_id'], 'number');
  assert.equal(diagnostic['http_status'], reply.status ?? HttpStatusCode.Ok);

  let category = 'http_error';

  if (reply.status === undefined) {
    category = 'stream_error';
  }

  assert.equal(diagnostic['category'], category);
  assert.equal(diagnostic['provider_code'], reply.status ?? HttpStatusCode.TooManyRequests);

  if (reply.streamError?.type === 'rate_limit_error') {
    assert.equal(diagnostic['provider_type'], 'rate_limit_error');
    assert.equal(diagnostic['parameter'], 'model');
  } else {
    assert.equal(diagnostic['provider_type'], undefined);
    assert.equal(diagnostic['parameter'], undefined);
  }

  if (reply.streamResponseId === GENERATION_ID) {
    assert.equal(diagnostic['generation_id'], GENERATION_ID);
  } else {
    assert.equal(
      diagnostic['generation_id'],
      undefined,
      'A provider generation ID came from another request or private text',
    );
  }
}

type CanaryInspection = { readonly canaries: ReadonlyArray<string>; readonly surfaces: ReadonlyArray<string> };

function assertFailureCanariesAbsent({ canaries, surfaces }: CanaryInspection): void {
  const representations = canaries.flatMap((canary) => [
    canary,
    Buffer.from(canary).toString('hex'),
    Buffer.from(canary).toString('base64'),
  ]);

  const isRetained = surfaces.some((surface) =>
    representations.some((representation) => surface.includes(representation)),
  );

  assert.equal(isRetained, false, 'Provider failure handling retained credentials or private error fields');
}
