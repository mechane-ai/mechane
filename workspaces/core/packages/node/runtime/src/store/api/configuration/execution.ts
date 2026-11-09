import { RequestInvalid } from '@mechane/protocol';
import { Record } from 'effect';
import type { ExecutionAccess } from '../../../domain.ts';
import type { StoreContext } from '../../context.ts';
import { recordConfigurationChange } from './audit.ts';
import { lockWorkspaceAuthority, requireCredentialReferences, requireWorkspaceMech } from './authority.ts';
import type { ExecutionAccessInput } from './types.ts';

export function createExecutionConfigurationRecords(context: StoreContext) {
  return {
    async configureExecutionAccess(input: ExecutionAccessInput): Promise<ExecutionAccess | null> {
      return await context.atomic(async (transaction) => {
        await lockWorkspaceAuthority({ context: transaction, ...input, isOwnerRequired: true });
        await requireWorkspaceMech({ context: transaction, ...input });

        if (input.access === null) {
          await transaction.client.query(
            'DELETE FROM mechane.execution_access WHERE workspace_id = $1 AND mech_id = $2',
            [input.workspaceId, input.mechId],
          );
        } else {
          const references = executionCredentialReferences(input.access);

          await requireCredentialReferences({ context: transaction, workspaceId: input.workspaceId, references });
          await transaction.client.query(
            `INSERT INTO mechane.execution_access(workspace_id,mech_id,access,updated_by) VALUES($1,$2,$3,$4)
             ON CONFLICT(mech_id) DO UPDATE SET access = EXCLUDED.access,updated_by = EXCLUDED.updated_by,updated_at = now()
             WHERE mechane.execution_access.workspace_id = EXCLUDED.workspace_id`,
            [input.workspaceId, input.mechId, input.access, input.principalId],
          );
        }

        await recordConfigurationChange({
          context: transaction,
          ...input,
          action: 'execution-access.changed',
          targetId: input.mechId,
        });

        return input.access;
      });
    },
  };
}

function executionCredentialReferences(access: ExecutionAccess): ReadonlyArray<string> {
  const references = Record.values(access.secrets);

  if (Record.keys(access.variables).some((name) => Object.hasOwn(access.secrets, name))) {
    throw new RequestInvalid({ reason: 'an execution variable cannot also name a secret' });
  }

  return references;
}
