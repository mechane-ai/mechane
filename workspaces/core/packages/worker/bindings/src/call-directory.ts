import { DurableObjectClass } from '@mechane/protocol';
import type { ObjectUnavailable, ServiceFreeCodec } from '@mechane/protocol';
import type { DirectoryRpc } from '@mechane/rpc';
import { directoryStub } from '@mechane/rpc';
import { Effect } from 'effect';
import { callObject } from './call-object.ts';
import type { WorkerSettings } from './types.ts';

type DirectoryCallInput = { readonly directory: DurableObjectStub<DirectoryRpc> };

type CallDirectoryInput<S> = {
  readonly settings: WorkerSettings;
  readonly call: (input: DirectoryCallInput) => Promise<unknown>;
  readonly answer: S;
};

/** Calls the deployment's one directory object by RPC and decodes its plain answer. */
export const callDirectory = Effect.fn('callDirectory')(function* <S extends ServiceFreeCodec>({
  settings,
  call,
  answer,
}: CallDirectoryInput<S>): Effect.fn.Return<S['Type'], ObjectUnavailable> {
  const directory = directoryStub({ bindings: settings });

  return yield* callObject({ objectClass: DurableObjectClass.Directory, call: () => call({ directory }), answer });
});
