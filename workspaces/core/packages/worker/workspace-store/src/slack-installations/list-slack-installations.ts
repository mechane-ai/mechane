import type { SlackInstallation } from '@mechane/protocol';
import { decodeRows } from '@mechane/store';
import type { RecordsInput } from '@mechane/store';
import { SlackInstallationRow } from './schemas.ts';

/** Connection listings contain credential references, never Slack tokens or signing secrets. */
export function listSlackInstallations({ sql }: RecordsInput): ReadonlyArray<SlackInstallation> {
  const cursor = sql.exec('SELECT installation FROM slack_installations ORDER BY id');
  const rows = decodeRows({ cursor, schema: SlackInstallationRow });

  return rows.map(({ installation }) => installation);
}
