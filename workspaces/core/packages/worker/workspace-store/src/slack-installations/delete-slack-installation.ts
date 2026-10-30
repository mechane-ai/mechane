import type { SqlCall } from '@mechane/store';
import type { SlackInstallationIdInput } from './types.ts';

/** Deleting connection metadata leaves its independently managed credential references intact. */
export function deleteSlackInstallation({ sql, connectionId }: SqlCall<SlackInstallationIdInput>): void {
  sql.exec('DELETE FROM slack_installations WHERE id = ?', connectionId);
}
