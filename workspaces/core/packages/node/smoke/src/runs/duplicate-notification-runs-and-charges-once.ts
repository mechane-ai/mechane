import {
  Allowance,
  Dispatch,
  DispatchStatus,
  NotificationReceipt,
  SettlementBasis,
  TurnStatus,
} from '@mechane/protocol';
import { HttpHeader, HttpMethod, MediaType } from '@mechane/records';
import {
  createAccount,
  createMech,
  notificationPath,
  readConsoleMessages,
  readTrace,
  readTurns,
  requireFixtures,
  runCli,
  sendNotification,
  waitForTurn,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const EXPECTED_CHARGE_MICROS = 60;
const REQUEST_DEADLINE_MS = 15_000;

type AliasInput = Parameters<typeof sendNotification>[0] & { readonly notificationId: string };

export async function duplicateNotificationRunsAndChargesOnce({ stack }: ScenarioInput): Promise<void> {
  const account = await createAccount({ stack });
  const marker = `deduplicated-${randomUUID()}`;
  const mech = await createMech({ stack, account, name: marker });
  const fixtures = requireFixtures(stack);

  fixtures.model.configure({ marker, replies: [{ text: marker, promptTokens: 20, completionTokens: 10 }] });

  const before = await runCli({
    stack,
    account,
    args: ['allowance', 'show', '--workspace', account.workspaceId],
    schema: Allowance,
  });

  const notificationId = randomUUID();
  const input = { stack, account, mechId: mech.id, text: marker, notificationId };
  const [first, repeated] = await Promise.all([sendNotification(input), sendUppercaseAlias(input)]);

  assert.equal(first.id, repeated.id);
  assert.deepEqual({ ...first, wasCreated: false }, { ...repeated, wasCreated: false });
  assert.equal([first, repeated].filter((receipt) => receipt.wasCreated).length, 1);

  const turn = await waitForTurn(input);

  assert.equal(turn.status, TurnStatus.Completed);

  const replayed = await sendUppercaseAlias(input);

  assert.deepEqual(replayed, { ...first, wasCreated: false });

  const trace = await readTrace({ ...input, turnId: turn.id });
  const turns = await readTurns(input);
  const dispatch = trace.dispatches[0];

  assert.equal(turns.filter((candidate) => candidate.notificationIds.some((id) => id === notificationId)).length, 1);
  assert.equal(fixtures.model.readCalls({ marker }).length, 1);
  assert.equal(trace.dispatches.length, 1);
  assert.ok(Schema.is(Dispatch)(dispatch));

  if (dispatch.status !== DispatchStatus.Settled || dispatch.basis !== SettlementBasis.Usage) {
    throw new Error('The completed model request has no usage settlement');
  }

  assert.equal(dispatch.settledMicros, EXPECTED_CHARGE_MICROS);

  const conversation = await readConsoleMessages(input);

  assert.equal(conversation.messages.filter((message) => message.role === 'assistant').length, 0);

  const after = await runCli({
    stack,
    account,
    args: ['allowance', 'show', '--workspace', account.workspaceId],
    schema: Allowance,
  });

  assert.equal(after.committedMicros - before.committedMicros, EXPECTED_CHARGE_MICROS);
}

async function sendUppercaseAlias({
  stack,
  account,
  mechId,
  text,
  notificationId,
}: AliasInput): Promise<NotificationReceipt> {
  const path = notificationPath({
    workspaceId: account.workspaceId.toUpperCase(),
    mechId: mechId.toUpperCase(),
    notificationId: notificationId.toUpperCase(),
  });

  const response = await fetch(new URL(path, stack.origin), {
    method: HttpMethod.Post,
    headers: { [HttpHeader.Authorization]: `Bearer ${account.token}`, [HttpHeader.ContentType]: MediaType.Json },
    body: JSON.stringify({ text, source: { name: 'cli', eventId: notificationId } }),
    signal: AbortSignal.timeout(REQUEST_DEADLINE_MS),
  });

  assert.ok(response.ok, `The uppercase notification alias returned ${response.status}`);

  return Schema.decodeUnknownSync(NotificationReceipt)(await response.json());
}
