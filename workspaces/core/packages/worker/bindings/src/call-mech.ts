import { DurableObjectClass } from '@mechane/protocol';
import type { ObjectUnavailable, ServiceFreeCodec } from '@mechane/protocol';
import type { MechRpc } from '@mechane/rpc';
import { mechStub } from '@mechane/rpc';
import { Effect } from 'effect';
import { callObject } from './call-object.ts';
import type { WorkerSettings } from './types.ts';

type MechCallInput = { readonly mech: DurableObjectStub<MechRpc> };

type CallMechInput<S> = {
  readonly settings: WorkerSettings;
  readonly workspaceId: string;
  readonly mechId: string;
  readonly call: (input: MechCallInput) => Promise<unknown>;
  readonly answer: S;
};

/** Calls a mech's object by RPC and decodes its plain answer; a mech of another workspace is another, empty object. */
export const callMech = Effect.fn('callMech')(function* <S extends ServiceFreeCodec>({
  settings,
  workspaceId,
  mechId,
  call,
  answer,
}: CallMechInput<S>): Effect.fn.Return<S['Type'], ObjectUnavailable> {
  const mech = mechStub({ bindings: settings, workspaceId, mechId });

  return yield* callObject({ objectClass: DurableObjectClass.Mech, call: () => call({ mech }), answer });
});
