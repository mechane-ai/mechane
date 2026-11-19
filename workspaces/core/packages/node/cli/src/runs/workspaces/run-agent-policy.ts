import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { ManagedAgentPolicy } from '@mechane/protocol';
import { Effect } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';

type PolicyInput = { readonly policy: ManagedAgentPolicy };

function policyLines({ policy }: PolicyInput): ReadonlyArray<string> {
  return [
    `Agent ${policy.agentId}`,
    `Creator ${policy.creatorPrincipalId}`,
    `Daily cap ${policy.dailyCapMicros} micro-dollars`,
  ];
}

/** Read the agent's effective cap and stable creator from the selected workspace. */
export const runAgentPolicyShow = Effect.fn('runAgentPolicyShow')(function* ({
  call,
  origin,
  credentials,
  selectedWorkspaceId,
  input,
}: RunInput<'agent-policy show'>): Effect.fn.Return<CommandResult<'agent-policy show'>, RunFailure> {
  const policy = yield* withWorkspace({
    call,
    origin,
    credentials,
    selectedWorkspaceId,
    use: ({ token, workspaceId }) =>
      call({ name: 'showManagedAgentPolicy', credential: token, input: { ...input, workspaceId } }),
  });

  return { lines: policyLines({ policy }), result: policy };
});

/** Apply an owner-selected agent cap and show the persisted value. */
export const runAgentPolicySet = Effect.fn('runAgentPolicySet')(function* ({
  call,
  origin,
  credentials,
  selectedWorkspaceId,
  input,
}: RunInput<'agent-policy set'>): Effect.fn.Return<CommandResult<'agent-policy set'>, RunFailure> {
  const policy = yield* withWorkspace({
    call,
    origin,
    credentials,
    selectedWorkspaceId,
    use: ({ token, workspaceId }) =>
      call({ name: 'configureManagedAgentPolicy', credential: token, input: { ...input, workspaceId } }),
  });

  return { lines: policyLines({ policy }), result: policy };
});
