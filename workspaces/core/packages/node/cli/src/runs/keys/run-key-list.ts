import type { CommandResult, Credential, PageCursor, RunFailure, RunInput } from '@mechane/cli-kernel';
import { withCredential } from '@mechane/cli-login';
import type { ClientFailure } from '@mechane/client';
import type { KeyList, KeyMetadata } from '@mechane/protocol';
import { Effect } from 'effect';
import { readPages } from '../read-pages.ts';
import { keyLine } from './key-line.ts';

/** Lists the keys of the account the CLI's key signs in as. */
export const runKeyList = Effect.fn('runKeyList')(function* ({
  call,
  origin,
  credentials,
}: RunInput<'key list'>): Effect.fn.Return<CommandResult<'key list'>, RunFailure> {
  const keys: (credential: Credential) => Effect.Effect<KeyList, ClientFailure> = ({ token }) =>
    readPages({
      key: 'keys',
      read: ({ after }: PageCursor<KeyMetadata['id']>) =>
        call({ name: 'listKeys', input: { after }, credential: token }),
    });

  const list = yield* withCredential({ origin, credentials, use: keys });

  return { lines: list.keys.map((key) => keyLine({ key })), result: list };
});
