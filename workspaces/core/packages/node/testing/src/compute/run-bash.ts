import type { LocalStack } from '@mechane/stack';
import { randomUUID } from 'node:crypto';
import type { Account } from '../auth/types.ts';
import { requireFixtures } from '../fixtures.ts';
import { sendInbox, waitForTurn } from '../mechs.ts';
import { readBashResult } from './read-bash-result.ts';

type BashInput = {
  readonly stack: LocalStack;
  readonly account: Account;
  readonly mechId: string;
  readonly command: string;
};

export async function runBash({ stack, account, mechId, command }: BashInput) {
  const marker = `shell-${randomUUID()}`;
  const toolCallId = randomUUID();
  const model = requireFixtures(stack).model;

  model.configure({
    marker,
    replies: [
      { tools: [{ id: toolCallId, name: 'bash', input: { command } }] },
      { text: 'The command result was observed' },
    ],
  });

  const sent = await sendInbox({ stack, account, mechId, text: marker });
  const result = await readBashResult({ model, marker, toolCallId });
  const turn = await waitForTurn({ stack, account, mechId, inboxItemId: sent.id });

  return { result, turn };
}
