import {
  ConnectionLimitReached,
  ConnectionNotFound,
  CONNECTIONS_PER_WORKSPACE,
  ToolGrantInvalid,
} from '@mechane/protocol';
import type { RemoteToolPolicy } from '@mechane/protocol';
import { ConnectionId } from '@mechane/records';
import type { StoreContext } from '../../context.ts';
import { recordConfigurationChange } from './audit.ts';
import { lockWorkspaceAuthority, requireCredentialReferences, requireWorkspaceMech } from './authority.ts';
import type { ConnectionConfiguration, ConnectionRecord, ToolGrantRecord, WorkspaceActor } from './types.ts';

type ConnectionRow = {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly secret_reference: string | null;
  readonly allowed_tools: ReadonlyArray<string>;
  readonly policy: RemoteToolPolicy;
  readonly created_at: string;
  readonly updated_at: string;
};

type ConnectionSelection = { readonly workspaceId: string; readonly connectionId: string };

type ConnectionWrite = WorkspaceActor & {
  readonly connectionId: string;
  readonly configuration: ConnectionConfiguration;
  readonly isCreation: boolean;
};

type ConnectionDelete = WorkspaceActor & { readonly connectionId: string };
type GrantSelection = { readonly workspaceId: string; readonly mechId: string };

type GrantWrite = WorkspaceActor & {
  readonly mechId: string;
  readonly connectionId: string;
  readonly tools: ReadonlyArray<string> | null;
};

type GrantRow = { readonly mech_id: string; readonly connection_id: string; readonly tools: ReadonlyArray<string> };

export function createConnectionRecords(context: StoreContext) {
  return {
    async listConnections(actor: WorkspaceActor): Promise<ReadonlyArray<ConnectionRecord>> {
      return await context.atomic(async (transaction) => {
        await lockWorkspaceAuthority({ context: transaction, ...actor, isOwnerRequired: true });

        const result = await transaction.client.query<ConnectionRow>(
          'SELECT id,name,url,secret_reference,allowed_tools,policy,created_at,updated_at FROM mechane.mcp_connections WHERE workspace_id = $1 ORDER BY created_at,id',
          [actor.workspaceId],
        );

        return result.rows.map(connectionRecord);
      });
    },
    async getMcpConnection(input: ConnectionSelection): Promise<ConnectionRecord | null> {
      return await readConnection(context, input);
    },
    async saveConnection(input: ConnectionWrite): Promise<ConnectionRecord> {
      return await context.atomic(async (transaction) => {
        await lockWorkspaceAuthority({ context: transaction, ...input, isOwnerRequired: true });

        const existing = await readConnection(transaction, input);

        if (!input.isCreation && existing === null) {
          throw new ConnectionNotFound({ connectionId: ConnectionId.make(input.connectionId) });
        }

        if (input.isCreation) {
          const connections = await transaction.client.query(
            'SELECT id FROM mechane.mcp_connections WHERE workspace_id = $1',
            [input.workspaceId],
          );

          if (connections.rows.length >= CONNECTIONS_PER_WORKSPACE) {
            throw new ConnectionLimitReached({});
          }
        }

        const references = [];

        if (input.configuration.secretReference !== null) {
          references.push(input.configuration.secretReference);
        }

        await requireCredentialReferences({ context: transaction, workspaceId: input.workspaceId, references });

        const result = await transaction.client.query<ConnectionRow>(
          `INSERT INTO mechane.mcp_connections(id,workspace_id,name,url,secret_reference,allowed_tools,policy)
           VALUES($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT(id) DO UPDATE SET name = EXCLUDED.name,url = EXCLUDED.url,secret_reference = EXCLUDED.secret_reference,
             allowed_tools = EXCLUDED.allowed_tools,policy = EXCLUDED.policy,updated_at = now()
           WHERE mechane.mcp_connections.workspace_id = EXCLUDED.workspace_id
           RETURNING id,name,url,secret_reference,allowed_tools,policy,created_at,updated_at`,
          [
            input.connectionId,
            input.workspaceId,
            input.configuration.name,
            input.configuration.url,
            input.configuration.secretReference,
            input.configuration.allowedTools,
            input.configuration.policy,
          ],
        );

        await transaction.client.query(
          `UPDATE mechane.mcp_grants
           SET tools = ARRAY(SELECT tool FROM unnest(tools) tool WHERE tool = ANY($3::text[]))
           WHERE workspace_id = $1 AND connection_id = $2`,
          [input.workspaceId, input.connectionId, input.configuration.allowedTools],
        );

        const saved = result.rows[0];

        if (saved === undefined) {
          throw new ConnectionNotFound({ connectionId: ConnectionId.make(input.connectionId) });
        }

        await recordConfigurationChange({
          context: transaction,
          ...input,
          action: 'connection.saved',
          targetId: input.connectionId,
          recipients: { connectionId: input.connectionId },
        });

        return connectionRecord(saved);
      });
    },
    async deleteConnection(input: ConnectionDelete): Promise<void> {
      await context.atomic(async (transaction) => {
        await lockWorkspaceAuthority({ context: transaction, ...input, isOwnerRequired: true });
        await recordConfigurationChange({
          context: transaction,
          ...input,
          action: 'connection.deleted',
          targetId: input.connectionId,
          recipients: { connectionId: input.connectionId },
        });
        await transaction.client.query(
          'DELETE FROM mechane.mcp_grants WHERE workspace_id = $1 AND connection_id = $2',
          [input.workspaceId, input.connectionId],
        );
        await transaction.client.query('DELETE FROM mechane.mcp_connections WHERE workspace_id = $1 AND id = $2', [
          input.workspaceId,
          input.connectionId,
        ]);
      });
    },
    async listMcpGrants(input: GrantSelection): Promise<ReadonlyArray<ToolGrantRecord>> {
      return await readMcpGrants(context, input);
    },
    async listToolGrants(input: WorkspaceActor & GrantSelection): Promise<ReadonlyArray<ToolGrantRecord>> {
      return await context.atomic(async (transaction) => {
        await lockWorkspaceAuthority({ context: transaction, ...input, isOwnerRequired: true });
        await requireWorkspaceMech({ context: transaction, ...input });

        return await readMcpGrants(transaction, input);
      });
    },
    async saveToolGrant(input: GrantWrite): Promise<ToolGrantRecord> {
      return await context.atomic(async (transaction) => {
        await lockWorkspaceAuthority({ context: transaction, ...input, isOwnerRequired: true });
        await requireWorkspaceMech({ context: transaction, ...input });

        if (input.tools === null) {
          await transaction.client.query(
            'DELETE FROM mechane.mcp_grants WHERE workspace_id = $1 AND mech_id = $2 AND connection_id = $3',
            [input.workspaceId, input.mechId, input.connectionId],
          );
          await recordConfigurationChange({
            context: transaction,
            ...input,
            action: 'connection.tools-revoked',
            targetId: input.mechId,
            recipients: { mechId: input.mechId },
          });

          return { mechId: input.mechId, connectionId: input.connectionId, tools: [] };
        }

        const connection = await readConnection(transaction, input);

        if (connection === null) {
          throw new ConnectionNotFound({ connectionId: ConnectionId.make(input.connectionId) });
        }

        if (input.tools.some((tool) => !connection.allowedTools.includes(tool))) {
          throw new ToolGrantInvalid({ connectionId: ConnectionId.make(input.connectionId) });
        }

        await transaction.client.query(
          `INSERT INTO mechane.mcp_grants(workspace_id,mech_id,connection_id,tools) VALUES($1,$2,$3,$4)
           ON CONFLICT(mech_id,connection_id) DO UPDATE SET tools = EXCLUDED.tools`,
          [input.workspaceId, input.mechId, input.connectionId, input.tools],
        );
        await recordConfigurationChange({
          context: transaction,
          ...input,
          action: 'connection.tools-granted',
          targetId: input.mechId,
          recipients: { mechId: input.mechId },
        });

        return { mechId: input.mechId, connectionId: input.connectionId, tools: input.tools };
      });
    },
  };
}

async function readConnection(context: StoreContext, input: ConnectionSelection): Promise<ConnectionRecord | null> {
  const result = await context.client.query<ConnectionRow>(
    'SELECT id,name,url,secret_reference,allowed_tools,policy,created_at,updated_at FROM mechane.mcp_connections WHERE workspace_id = $1 AND id = $2',
    [input.workspaceId, input.connectionId],
  );

  const row = result.rows[0];

  if (row === undefined) {
    return null;
  }

  return connectionRecord(row);
}

function connectionRecord(row: ConnectionRow): ConnectionRecord {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    secretReference: row.secret_reference,
    allowedTools: row.allowed_tools,
    policy: row.policy,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function grantRecord(row: GrantRow): ToolGrantRecord {
  return { mechId: row.mech_id, connectionId: row.connection_id, tools: row.tools };
}

async function readMcpGrants(context: StoreContext, input: GrantSelection): Promise<ReadonlyArray<ToolGrantRecord>> {
  const result = await context.client.query<GrantRow>(
    'SELECT mech_id,connection_id,tools FROM mechane.mcp_grants WHERE workspace_id = $1 AND mech_id = $2 ORDER BY connection_id',
    [input.workspaceId, input.mechId],
  );

  return result.rows.map(grantRecord);
}
