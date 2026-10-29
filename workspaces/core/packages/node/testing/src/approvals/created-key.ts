import { KeyMetadata } from '@mechane/protocol';
import type { Stack } from '@mechane/stack';
import { Effect, Schema } from 'effect';
import { join } from 'node:path';
import { readPrivateFile } from '../sentinels/read-private-file.ts';
import type { Account, CreatedKey, ScenarioFailure } from '../types.ts';
import { approvedRun } from './approved-run.ts';

/** The part of `mechane key create`'s result a scenario reads: the new key. */
const KeyCreated = Schema.Struct({ key: KeyMetadata });

type KeyCreated = typeof KeyCreated.Type;

/** A named key to create, and the keys presented to its approval before a browser's. */
type CreatedKeyInput = {
  readonly stack: Stack;
  readonly account: Account;
  readonly name: string;
  readonly presentedKeys: ReadonlyArray<string>;
};

/**
 * Creates a named key through an approval, after posting that approval with each of `presentedKeys` as a client without
 * a browser session would. It answers with the key and the token its output file holds. The browser's approval that
 * follows fails unless the approval is still pending, so no presented key approved anything.
 */
export const createdKey = Effect.fn('createdKey')(function* ({
  stack,
  account,
  name,
  presentedKeys,
}: CreatedKeyInput): Effect.fn.Return<CreatedKey, ScenarioFailure> {
  const keyFile = join(account.configurationRoot, `${name}.key`);
  const args = ['key', 'create', '--name', name, '--key-file', keyFile];
  const { result, output } = yield* approvedRun({ stack, args, account, result: KeyCreated, presentedKeys });
  const { text, isPrivate } = yield* readPrivateFile({ path: keyFile });

  return { key: result.key, token: text.trim(), isPrivate, output };
});
