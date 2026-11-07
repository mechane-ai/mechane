import { TurnStatus } from '@mechane/protocol';
import type { LocalStack } from '@mechane/stack';
import assert from 'node:assert/strict';
import type { Account } from '../auth/types.ts';
import { requireFixtures } from '../fixtures.ts';
import { waitForTurn } from '../mechs.ts';
import { readBashResult } from './read-bash-result.ts';

type WaitForBashCompletionInput = {
  readonly stack: LocalStack;
  readonly account: Account;
  readonly mechId: string;
  readonly inboxItemId: string;
  readonly marker: string;
  readonly toolCallId: string;
  readonly timeoutMs?: number;
};

export async function waitForBashCompletion(input: WaitForBashCompletionInput) {
  const model = requireFixtures(input.stack).model;
  const result = await readBashResult({ ...input, model });
  const turn = await waitForTurn(input);

  assert.equal(turn.status, TurnStatus.Answered);
  assert.equal(result.status, 'completed');
  assert.equal(result.exitCode, 0);

  return { result, turn };
}
