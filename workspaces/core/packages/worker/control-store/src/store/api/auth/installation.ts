import { randomUUID } from 'node:crypto';
import type { StoreContext } from '../../context.ts';

export type InstallationWorkspace = {
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly dailyCapMicros: number;
};

type PrincipalRow = { readonly principal_id: string };
const LOOKUP = 'SELECT principal_id FROM mechane.managed_installations WHERE workspace_id=$1';

export async function resolveInstallationPrincipal(
  context: StoreContext,
  workspace: InstallationWorkspace,
): Promise<string> {
  const { workspaceId, workspaceName, dailyCapMicros } = workspace;
  const found = await context.client.query<PrincipalRow>(LOOKUP, [workspaceId]);
  const existing = found.rows[0];

  if (existing !== undefined) {
    return existing.principal_id;
  }

  return await context.atomic(async ({ client }) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 2))', [workspaceId]);

    const lookup = await client.query<PrincipalRow>(LOOKUP, [workspaceId]);
    const row = lookup.rows[0];

    if (row !== undefined) {
      return row.principal_id;
    }

    const principalId = randomUUID();

    await client.query("INSERT INTO mechane.principals(id, name) VALUES ($1, 'Managed Agents server')", [principalId]);
    await client.query(
      `INSERT INTO mechane.workspaces(id,name,creator_id,daily_cap_micros)
       VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING`,
      [workspaceId, workspaceName, principalId, dailyCapMicros],
    );
    await client.query('INSERT INTO mechane.managed_installations(workspace_id,principal_id) VALUES ($1,$2)', [
      workspaceId,
      principalId,
    ]);

    return principalId;
  });
}
