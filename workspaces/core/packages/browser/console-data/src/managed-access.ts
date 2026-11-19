import { deleteRows } from './collections.ts';
import type { CanonicalTables, CanonicalWriter } from './collections.ts';
import { decodeReadRequest } from './requests.ts';
import type { ReadReceipt, ReadRequest } from './requests.ts';

type RemovedResource = ReadRequest<'agent' | 'session'>;

/** A denied resource invalidates its detail, its descendants and only pages that disclosed it. */
export function containsRemovedResource(
  candidate: ReadRequest,
  removed: RemovedResource,
  receipt?: ReadReceipt,
): boolean {
  if (removed.kind === 'agent') {
    if ('agentId' in candidate && candidate.agentId === removed.agentId) {
      return true;
    }

    return candidate.kind === 'agents' && (receipt === undefined || receipt.keys.includes(removed.agentId));
  }

  if ('sessionId' in candidate && candidate.agentId === removed.agentId && candidate.sessionId === removed.sessionId) {
    return true;
  }

  if (candidate.kind !== 'sessions' || candidate.agentId !== removed.agentId) {
    return false;
  }

  return receipt === undefined || receipt.keys.includes(removed.sessionId);
}

export async function purgeManagedResource({
  removed,
  tables,
  writeRows,
  signal,
}: {
  readonly removed: RemovedResource;
  readonly tables: CanonicalTables;
  readonly writeRows: CanonicalWriter;
  readonly signal: AbortSignal;
}) {
  const { reads, managedAgents, managedSessions, managedThreads, sessionEvidence } = tables;

  await writeRows({
    signal,
    collections: [reads, managedAgents, managedSessions, managedThreads, sessionEvidence],
    write: () => {
      const sessionKeys = [...managedSessions.values()]
        .filter(
          ({ value }) =>
            value.agentId === removed.agentId && (removed.kind === 'agent' || value.id === removed.sessionId),
        )
        .map(({ key }) => key);

      const sessionIds = new Set(sessionKeys);

      if (removed.kind === 'agent') {
        deleteRows(managedAgents, [removed.agentId]);
      } else if (
        managedSessions.get(removed.sessionId)?.value.agentId === removed.agentId ||
        !managedSessions.has(removed.sessionId)
      ) {
        sessionIds.add(removed.sessionId);
      }

      deleteRows(managedSessions, sessionKeys);

      const evidence = [...sessionEvidence.values()].filter(
        (row) => row.agentId === removed.agentId && (removed.kind === 'agent' || row.sessionId === removed.sessionId),
      );

      deleteRows(
        sessionEvidence,
        evidence.map((row) => row.key),
      );
      deleteRows(
        managedThreads,
        [...managedThreads.values()].filter(({ value }) => sessionIds.has(value.sessionId)).map(({ key }) => key),
      );
      deleteRows(
        reads,
        [...reads.values()]
          .filter((receipt) => containsRemovedResource(decodeReadRequest(receipt.id), removed, receipt))
          .map((receipt) => receipt.id),
      );
    },
  });
}
