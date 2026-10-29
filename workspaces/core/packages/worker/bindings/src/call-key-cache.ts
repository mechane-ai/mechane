import { DurableObjectClass } from '@mechane/protocol';
import type { ObjectUnavailable, ServiceFreeCodec } from '@mechane/protocol';
import type { KeyCacheRpc } from '@mechane/rpc';
import { keyCacheStub } from '@mechane/rpc';
import { Effect } from 'effect';
import { callObject } from './call-object.ts';
import type { WorkerSettings } from './types.ts';

type KeyCacheCallInput = { readonly keyCache: DurableObjectStub<KeyCacheRpc> };

type CallKeyCacheInput<S> = {
  readonly settings: WorkerSettings;
  readonly tokenHash: string;
  readonly call: (input: KeyCacheCallInput) => Promise<unknown>;
  readonly answer: S;
};

/** Calls the key cache shard of a token's hash by RPC and decodes its plain answer. */
export const callKeyCache = Effect.fn('callKeyCache')(function* <S extends ServiceFreeCodec>({
  settings,
  tokenHash,
  call,
  answer,
}: CallKeyCacheInput<S>): Effect.fn.Return<S['Type'], ObjectUnavailable> {
  const keyCache = keyCacheStub({ bindings: settings, tokenHash });

  return yield* callObject({ objectClass: DurableObjectClass.KeyCache, call: () => call({ keyCache }), answer });
});
