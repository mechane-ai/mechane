import { randomUUID } from 'node:crypto';
import type { StoreContext } from '../../context.ts';
import { resolveInstallationPrincipal } from './installation.ts';
import type { InstallationWorkspace } from './installation.ts';

type Identity = InstallationWorkspace & {
  readonly issuer: string;
  readonly name: string;
  readonly subjectClaim: string;
  readonly subject: string;
};

type SubjectRow = { readonly principal_id: string };

const LOOKUP = `SELECT principal_id FROM mechane.managed_oidc_identities
  WHERE workspace_id=$1 AND issuer_url=$2 AND issuer_name=$3 AND subject_claim=$4 AND subject_value=$5`;

export function createManagedOidcStore(context: StoreContext) {
  return {
    async resolveManagedOidcPrincipal(input: Identity): Promise<string> {
      const key = [input.workspaceId, input.issuer, input.name, input.subjectClaim, input.subject];
      const existing = await context.client.query<SubjectRow>(LOOKUP, key);
      const previous = existing.rows[0];

      if (previous !== undefined) {
        return previous.principal_id;
      }

      await resolveInstallationPrincipal(context, input);

      return await context.atomic(async ({ client }) => {
        const keyText = JSON.stringify(key);

        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 1))', [keyText]);

        const lookup = await client.query<SubjectRow>(LOOKUP, key);
        const row = lookup.rows[0];

        if (row !== undefined) {
          return row.principal_id;
        }

        const principalId = randomUUID();

        await client.query('INSERT INTO mechane.principals(id, name) VALUES ($1, $2)', [principalId, input.name]);
        await client.query(
          `INSERT INTO mechane.managed_oidc_identities
            (workspace_id, issuer_url, issuer_name, subject_claim, subject_value, principal_id)
            VALUES($1,$2,$3,$4,$5,$6)`,
          [...key, principalId],
        );

        return principalId;
      });
    },
  };
}
