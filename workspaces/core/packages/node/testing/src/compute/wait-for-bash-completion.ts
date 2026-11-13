import { TurnStatus } from '@mechane/protocol';
import type { LocalStack } from '@mechane/stack';
import { Option } from 'effect';
import assert from 'node:assert/strict';
import type { Account } from '../auth/types.ts';
import { requireFixtures } from '../fixtures.ts';
import { readTrace, waitForTurn } from '../mechs.ts';
import { readBashResult } from './read-bash-result.ts';

type WaitForBashCompletionInput = {
  readonly stack: LocalStack;
  readonly account: Account;
  readonly mechId: string;
  readonly notificationId: string;
  readonly marker: string;
  readonly toolCallId: string;
  readonly timeoutMs?: number;
};

export async function waitForBashCompletion(input: WaitForBashCompletionInput) {
  const model = requireFixtures(input.stack).model;
  const result = await readBashResult({ ...input, model });
  const turn = await waitForTurn(input);

  const trace = await readTrace({ ...input, turnId: turn.id });
  const tool = trace.toolCalls?.find((call) => call.id === input.toolCallId);

  assert.ok(tool?.inspection !== undefined);

  const receipt = Option.getOrThrow(tool.inspection.result);

  assert.equal(turn.status, TurnStatus.Completed);
  assert.equal(receipt.status, 'completed');
  assert.equal(Option.getOrThrow(receipt.exitCode), 0);

  return { result, turn };
}
