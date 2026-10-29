import { SlackBindingResult } from '@mechane/protocol';
import { decodeFirst } from '@mechane/store';
import type { SqlCall } from '@mechane/store';
import { Option, Schema } from 'effect';
import { SerializedSlackBinding, SlackBindingRow } from './schemas.ts';
import type { ConfigureSlackBindingInput } from './types.ts';

/** Refuses audience changes before updating the binding switches in the workspace transaction. */
export function configureSlackBinding({ sql, binding }: SqlCall<ConfigureSlackBindingInput>): SlackBindingResult {
  const conflicts = sql.exec(
    'SELECT binding FROM slack_bindings WHERE (id = ? AND (connection_id != ? OR team_id != ? OR channel_id != ? OR mech_id != ?)) OR (id != ? AND ((connection_id = ? AND team_id = ? AND channel_id = ?) OR mech_id = ?)) LIMIT 1',
    binding.id,
    binding.connectionId,
    binding.teamId,
    binding.channelId,
    binding.mechId,
    binding.id,
    binding.connectionId,
    binding.teamId,
    binding.channelId,
    binding.mechId,
  );

  const conflict = decodeFirst({ cursor: conflicts, schema: SlackBindingRow });

  if (Option.isSome(conflict)) {
    return SlackBindingResult.cases.Conflicting.make({});
  }

  const serialized = Schema.encodeSync(SerializedSlackBinding)(binding);

  sql.exec(
    'INSERT INTO slack_bindings (id, connection_id, team_id, channel_id, mech_id, binding) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET binding = excluded.binding',
    binding.id,
    binding.connectionId,
    binding.teamId,
    binding.channelId,
    binding.mechId,
    serialized,
  );

  return SlackBindingResult.cases.Configured.make({ binding });
}
