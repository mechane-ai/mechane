import { RemoteConnection } from '@mechane/protocol';
import { Option, Result, Schema } from 'effect';
import { readGrantedConnection } from './read-granted-connection.ts';
import type { RunGrantedToolInput } from './types.ts';

type AuthorizeGrantedToolInput = Omit<RunGrantedToolInput, 'signal'>;

/** Rejects changed connection configuration or a removed tool immediately before remote dispatch. */
export async function authorizeGrantedTool({
  settings,
  workspaceId,
  mechId,
  granted,
  invocation,
}: AuthorizeGrantedToolInput): Promise<boolean> {
  const { connection } = granted;
  const reading = await readGrantedConnection({ settings, workspaceId, mechId, connectionId: connection.id });

  if (Result.isFailure(reading) || Option.isNone(reading.success)) {
    return false;
  }

  const current = reading.success.value;
  const previousEncoded = Schema.encodeSync(RemoteConnection)(connection);
  const currentEncoded = Schema.encodeSync(RemoteConnection)(current.connection);
  const previousConfiguration = JSON.stringify(previousEncoded);
  const currentConfiguration = JSON.stringify(currentEncoded);

  if (previousConfiguration !== currentConfiguration) {
    return false;
  }

  return Option.match(invocation, {
    onNone: () => true,
    onSome: ({ toolName }) => current.grant.tools.includes(toolName),
  });
}
