import { DispatchStatus, TurnStatus, UnansweredReason } from '@mechane/protocol';
import { createAccount, createMech, readTrace, requireFixtures, sendInboxAndWait } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function unfundedInputNeverReachesModel({ stack }: ScenarioInput): Promise<void> {
  const account = await createAccount({ stack });
  const marker = `budget-refusal-${randomUUID()}`;
  const mech = await createMech({ stack, account, name: marker, dailyCapMicros: 1 });
  const fixtures = requireFixtures(stack);

  fixtures.model.configure({ marker, replies: [{ text: 'This request must not be sent' }] });

  const input = { stack, account, mechId: mech.id };
  const turn = await sendInboxAndWait({ ...input, text: marker });

  if (turn.status !== TurnStatus.Unanswered) {
    throw new Error('The unfunded input completed without a budget refusal');
  }

  assert.equal(turn.reason, UnansweredReason.AllowanceExhausted);
  assert.equal(fixtures.model.readCalls({ marker }).length, 0);

  const trace = await readTrace({ ...input, turnId: turn.id });

  assert.deepEqual(
    trace.dispatches.map((dispatch) => dispatch.status),
    [DispatchStatus.Refused],
  );
}
