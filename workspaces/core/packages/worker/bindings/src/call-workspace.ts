import { DurableObjectClass } from '@mechane/protocol';
import type { ObjectUnavailable, ServiceFreeCodec } from '@mechane/protocol';
import type { WorkspaceRpc } from '@mechane/rpc';
import { workspaceStub } from '@mechane/rpc';
import { Effect } from 'effect';
import { callObject } from './call-object.ts';
import type { WorkerSettings } from './types.ts';

type WorkspaceCallInput = { readonly workspace: DurableObjectStub<WorkspaceRpc> };

type CallWorkspaceInput<S> = {
  readonly settings: WorkerSettings;
  readonly workspaceId: string;
  readonly call: (input: WorkspaceCallInput) => Promise<unknown>;
  readonly answer: S;
};

/** Calls a workspace's object by RPC and decodes its plain answer. */
export const callWorkspace = Effect.fn('callWorkspace')(function* <S extends ServiceFreeCodec>({
  settings,
  workspaceId,
  call,
  answer,
}: CallWorkspaceInput<S>): Effect.fn.Return<S['Type'], ObjectUnavailable> {
  const workspace = workspaceStub({ bindings: settings, workspaceId });

  return yield* callObject({ objectClass: DurableObjectClass.Workspace, call: () => call({ workspace }), answer });
});
