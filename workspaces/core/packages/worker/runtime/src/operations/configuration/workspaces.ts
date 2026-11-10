import { catalog, InstallationAdministratorRequired, RequestInvalid, WorkspaceNotFound } from '@mechane/protocol';
import { RecordId } from '@mechane/records';
import { requireAuthenticated, validatedOperation } from '../validated-operation.ts';
import { memberWire, policyWire, workspaceWire } from './presentation.ts';
import type { ConfigurationOperationsInput } from './types.ts';

export function createWorkspaceOperations({
  store,
  configuration,
  isInstallationAdministrator,
}: ConfigurationOperationsInput) {
  async function requireAdministrator(principalId: string): Promise<void> {
    if (!(await isInstallationAdministrator(principalId))) {
      throw new InstallationAdministratorRequired({});
    }
  }

  return {
    listWorkspaces: validatedOperation({
      operation: catalog.listWorkspaces,
      run: async ({ caller }) => {
        const actor = requireAuthenticated(caller);
        const workspaces = await store.listWorkspaces(actor.principalId);

        return { workspaces: workspaces.map(workspaceWire) };
      },
    }),
    createWorkspace: validatedOperation({
      operation: catalog.createWorkspace,
      run: async ({ input, caller }) => {
        const actor = requireAuthenticated(caller);

        await requireAdministrator(actor.principalId);

        const workspace = await store.createWorkspace({
          ...input,
          principalId: actor.principalId,
          credentialId: actor.keyId,
          dailyAllowanceMicros: configuration.maxDailyAllowanceMicros,
        });

        return workspaceWire(workspace);
      },
    }),
    listWorkspaceMembers: validatedOperation({
      operation: catalog.listWorkspaceMembers,
      run: async ({ input, caller }) => {
        const actor = requireAuthenticated(caller);
        const members = await store.listWorkspaceMembers({ ...input, principalId: actor.principalId });

        return { members: members.map(memberWire) };
      },
    }),
    setWorkspaceMember: validatedOperation({
      operation: catalog.setWorkspaceMember,
      run: async ({ input, caller }) => {
        const actor = requireAuthenticated(caller);

        const member = await store.changeWorkspaceMember({
          workspaceId: input.workspaceId,
          principalId: actor.principalId,
          credentialId: actor.keyId,
          memberPrincipalId: input.principalId,
          role: input.role,
        });

        if (member === null) {
          throw new Error('member grant returned no membership');
        }

        return memberWire(member);
      },
    }),
    removeWorkspaceMember: validatedOperation({
      operation: catalog.removeWorkspaceMember,
      run: async ({ input, caller }) => {
        const actor = requireAuthenticated(caller);

        await store.changeWorkspaceMember({
          workspaceId: input.workspaceId,
          principalId: actor.principalId,
          credentialId: actor.keyId,
          memberPrincipalId: input.principalId,
          role: null,
        });

        return { principal_id: input.principalId };
      },
    }),
    showWorkspacePolicy: validatedOperation({
      operation: catalog.showWorkspacePolicy,
      run: async ({ input, caller }) => {
        const actor = requireAuthenticated(caller);

        await requireAdministrator(actor.principalId);

        const policy = await store.showWorkspacePolicy(input.workspaceId);

        return policyWire(policy);
      },
    }),
    setWorkspacePolicy: validatedOperation({
      operation: catalog.setWorkspacePolicy,
      run: async ({ input, caller }) => {
        const actor = requireAuthenticated(caller);

        await requireAdministrator(actor.principalId);

        if (
          input.policy.dailyAllowanceMicros > configuration.maxDailyAllowanceMicros ||
          input.policy.machines > configuration.maxMachines
        ) {
          throw new RequestInvalid({ reason: 'workspace policy exceeds installation limits' });
        }

        const policy = await store.setWorkspacePolicy({
          workspaceId: input.workspaceId,
          principalId: actor.principalId,
          credentialId: actor.keyId,
          policy: input.policy,
          isCreateOnly: input.isCreateOnly ?? false,
        });

        return policyWire(policy);
      },
    }),
    showAllowance: validatedOperation({
      operation: catalog.showAllowance,
      run: async ({ input, caller }) => {
        const actor = requireAuthenticated(caller);

        await store.authorizeConfigurationWorkspace({
          ...input,
          principalId: actor.principalId,
          isOwnerRequired: false,
        });

        const allowance = await store.showAllowance({ workspaceId: input.workspaceId });

        if (allowance === null) {
          throw new WorkspaceNotFound({ workspaceId: RecordId.make(input.workspaceId) });
        }

        return {
          day: allowance.date,
          daily_allowance_micros: allowance.capMicros,
          committed_micros: allowance.spentMicros + allowance.reservedMicros,
        };
      },
    }),
  };
}
