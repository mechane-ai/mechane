import { z } from 'zod';
import type { SlackInstallation } from '../../domain.ts';
import type { StoreContext } from '../context.ts';

const InstallationRow = z.object({
  id: z.string(),
  workspaceId: z.string(),
  teamId: z.string(),
  botUserId: z.string(),
  botTokenReference: z.string(),
  signingSecretReference: z.string(),
  historyTokenReference: z.string().nullable(),
  apiOrigin: z.string(),
  updatedAt: z.coerce.date().transform((value) => value.toISOString()),
});

type InstallationQuery = { readonly installationId: string; readonly workspaceId?: string };
type ListInstallations = { readonly workspaceId: string };

export type InstallationStore = {
  readonly getSlackInstallation: (input: InstallationQuery) => Promise<SlackInstallation | null>;
  readonly listSlackInstallations: (input: ListInstallations) => Promise<ReadonlyArray<SlackInstallation>>;
};

export function createInstallationStore(context: StoreContext): InstallationStore {
  return {
    async getSlackInstallation({ installationId, workspaceId }: InstallationQuery): Promise<SlackInstallation | null> {
      const result = await context.client.query(
        `SELECT id, workspace_id AS "workspaceId", team_id AS "teamId", bot_user_id AS "botUserId",
  bot_token_reference AS "botTokenReference", signing_secret_reference AS "signingSecretReference",
  history_token_reference AS "historyTokenReference", api_origin AS "apiOrigin", updated_at AS "updatedAt" FROM mechane.slack_installations
        WHERE id = $1 AND deleted_at IS NULL AND ($2::uuid IS NULL OR workspace_id = $2)`,
        [installationId, workspaceId ?? null],
      );

      if (result.rowCount === 0) {
        return null;
      }

      return InstallationRow.parse(result.rows[0]);
    },
    async listSlackInstallations({ workspaceId }: ListInstallations): Promise<ReadonlyArray<SlackInstallation>> {
      const result = await context.client.query(
        `SELECT id, workspace_id AS "workspaceId", team_id AS "teamId", bot_user_id AS "botUserId",
  bot_token_reference AS "botTokenReference", signing_secret_reference AS "signingSecretReference",
  history_token_reference AS "historyTokenReference", api_origin AS "apiOrigin", updated_at AS "updatedAt" FROM mechane.slack_installations
        WHERE workspace_id = $1 AND deleted_at IS NULL ORDER BY id`,
        [workspaceId],
      );

      return z.array(InstallationRow).parse(result.rows);
    },
  };
}
