import { SlackInstallationResult } from '@mechane/protocol';
import type { SqlCall } from '@mechane/store';
import { Option, Schema } from 'effect';
import { readSlackInstallation } from './read-slack-installation.ts';
import { SerializedSlackInstallation } from './schemas.ts';
import type { SaveSlackInstallationInput } from './types.ts';

/** Create-only imports accept an identical connection but refuse to replace different saved metadata. */
export function saveSlackInstallation({
  sql,
  installation,
  isCreateOnly,
}: SqlCall<SaveSlackInstallationInput>): SlackInstallationResult {
  const serialized = Schema.encodeSync(SerializedSlackInstallation)(installation);
  const current = readSlackInstallation({ sql, connectionId: installation.id });

  if (isCreateOnly && Option.isSome(current)) {
    const existing = Schema.encodeSync(SerializedSlackInstallation)(current.value);

    if (existing !== serialized) {
      return SlackInstallationResult.cases.Conflicting.make({});
    }

    return SlackInstallationResult.cases.Configured.make({ installation: current.value });
  }

  sql.exec(
    'INSERT INTO slack_installations (id, installation) VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET installation = excluded.installation',
    installation.id,
    serialized,
  );

  return SlackInstallationResult.cases.Configured.make({ installation });
}
