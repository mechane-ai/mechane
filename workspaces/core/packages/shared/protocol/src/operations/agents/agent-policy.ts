import { HttpMethod, ManagedAgentId, Micros, PrincipalId, wireStruct, WorkspaceId } from '@mechane/records';
import { RequestInvalid, ServiceUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';

/** The managed agent, its creator and its effective daily model budget in micro-dollars. */
export const ManagedAgentPolicy = wireStruct({
  fields: { agentId: ManagedAgentId, creatorPrincipalId: PrincipalId, dailyCapMicros: Micros },
});

export type ManagedAgentPolicy = typeof ManagedAgentPolicy.Type;

const policyOperation = {
  access: Access.Owner,
  path: '/api/operator/workspaces/:workspace_id/agents/:agent_id/policy',
  params: wireStruct({ fields: { workspaceId: WorkspaceId, agentId: ManagedAgentId } }),
  query: NoFields,
  output: ManagedAgentPolicy,
  errors: [RequestInvalid, ServiceUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired],
} as const;

/** Installation operators control agent spending independently of the upstream SDK session API. */
export const AGENT_POLICY_OPERATIONS = {
  showManagedAgentPolicy: { ...policyOperation, method: HttpMethod.Get, body: NoFields },
  configureManagedAgentPolicy: {
    ...policyOperation,
    method: HttpMethod.Put,
    body: wireStruct({ fields: { dailyCapMicros: Micros } }),
  },
} as const satisfies Readonly<Record<string, Operation>>;
