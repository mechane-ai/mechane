import { ConsoleMessagePage, EventPage } from '@mechane/protocol';
import { HttpHeader } from '@mechane/records';
import type { LocalStack } from '@mechane/stack';
import { Schema } from 'effect';
import type { Account } from './auth/types.ts';

type HistoricalMech = { readonly stack: LocalStack; readonly account: Account; readonly mechId: string };

const READ_DEADLINE_MS = 30_000;

function historicalRecordPath({
  workspaceId,
  mechId,
  resource,
}: {
  readonly workspaceId: string;
  readonly mechId: string;
  readonly resource: 'conversation' | 'events';
}): string {
  return `/api/operator/workspaces/${encodeURIComponent(workspaceId)}/mechs/${encodeURIComponent(mechId)}/${resource}`;
}

export async function readConsoleMessages(mech: HistoricalMech): Promise<ConsoleMessagePage> {
  return await readHistoricalRecord(mech, 'conversation', ConsoleMessagePage);
}

export async function readEvents(mech: HistoricalMech): Promise<EventPage> {
  return await readHistoricalRecord(mech, 'events', EventPage);
}

async function readHistoricalRecord<Output extends Schema.Codec<unknown, unknown>>(
  { stack, account, mechId }: HistoricalMech,
  resource: 'conversation' | 'events',
  schema: Output,
): Promise<Output['Type']> {
  const path = historicalRecordPath({ workspaceId: account.workspaceId, mechId, resource });

  const response = await fetch(new URL(path, stack.origin), {
    headers: { [HttpHeader.Authorization]: `Bearer ${account.token}` },
    signal: AbortSignal.timeout(READ_DEADLINE_MS),
  });

  if (!response.ok) {
    throw new Error(`Reading ${path} returned ${response.status}`);
  }

  return Schema.decodeUnknownSync(schema)(await response.json());
}
