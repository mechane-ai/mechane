import { Allowance, Dispatch, DispatchStatus, SettlementBasis, TurnStatus } from '@mechane/protocol';
import {
  createAccount,
  createMech,
  readTrace,
  readTurns,
  requireFixtures,
  runCli,
  sendInbox,
  waitForTurn,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const EXPECTED_CHARGE_MICROS = 60;

export async function duplicateInputRunsAndChargesOnce({ stack }: ScenarioInput): Promise<void> {
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

  const inboxItemId = randomUUID();
  const input = { stack, account, mechId: mech.id, text: marker, inboxItemId };
  const [first, repeated] = await Promise.all([sendInbox(input), sendInbox(input)]);

  assert.equal(first.id, repeated.id);

  const turn = await waitForTurn(input);

  assert.equal(turn.status, TurnStatus.Answered);

  await sendInbox(input);

  const trace = await readTrace({ ...input, turnId: turn.id });
  const turns = await readTurns(input);
  const dispatch = trace.dispatches[0];

  assert.equal(turns.filter((candidate) => candidate.inboxItemIds.some((id) => id === inboxItemId)).length, 1);
  assert.equal(fixtures.model.readCalls({ marker }).length, 1);
  assert.equal(trace.dispatches.length, 1);
  assert.ok(Schema.is(Dispatch)(dispatch));

  if (dispatch.status !== DispatchStatus.Settled || dispatch.basis !== SettlementBasis.Usage) {
    throw new Error('The completed model request has no usage settlement');
  }

  assert.equal(dispatch.settledMicros, EXPECTED_CHARGE_MICROS);

  const after = await runCli({
    stack,
    account,
    args: ['allowance', 'show', '--workspace', account.workspaceId],
    schema: Allowance,
  });

  assert.equal(after.committedMicros - before.committedMicros, EXPECTED_CHARGE_MICROS);
}
