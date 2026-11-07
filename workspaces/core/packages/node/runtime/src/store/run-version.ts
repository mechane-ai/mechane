import type { StoreClient } from './context.ts';

type AdvanceRunVersion = { readonly client: StoreClient; readonly runId: string };

export async function advanceRunVersion({ client, runId }: AdvanceRunVersion): Promise<void> {
  await client.query('UPDATE mechane.runs SET version=version+1 WHERE id=$1', [runId]);
}
