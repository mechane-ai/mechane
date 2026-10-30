import type { SlackInstallation } from '@mechane/protocol';
import { decodeFirst } from '@mechane/store';
import type { SqlCall } from '@mechane/store';
import { Option } from 'effect';
import { SlackInstallationRow } from './schemas.ts';
import type { SlackInstallationIdInput } from './types.ts';

/** A missing connection stays absent so consumers can distinguish removal from a failed lookup. */
export function readSlackInstallation({
  sql,
  connectionId,
}: SqlCall<SlackInstallationIdInput>): Option.Option<SlackInstallation> {
  const cursor = sql.exec('SELECT installation FROM slack_installations WHERE id = ?', connectionId);
  const row = decodeFirst({ cursor, schema: SlackInstallationRow });

  return Option.map(row, ({ installation }) => installation);
}
