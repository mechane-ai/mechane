import type { StoreContext } from '../context.ts';

const RETENTION_DAYS = 30;
// Anthropic documents a recent-version floor without stating its size. Mechane keeps five for every live memory.
const LIVE_HISTORY_ROWS = 5;
const PRUNE_MAX_ROWS = 100;

export async function pruneMemoryVersions(context: StoreContext): Promise<number> {
  const { rowCount } = await context.client.query(
    `WITH expired AS (
       SELECT version.memory_store_id,version.id
       FROM mechane.managed_memory_versions version
       LEFT JOIN mechane.managed_memories live
         ON (live.memory_store_id,live.id)=(version.memory_store_id,version.memory_id)
       WHERE version.created_at < statement_timestamp()-make_interval(days=>$1)
         AND (live.id IS NULL OR (
           live.version_id<>version.id AND EXISTS (
             SELECT 1 FROM mechane.managed_memory_versions newer
             WHERE (newer.memory_store_id,newer.memory_id)=(version.memory_store_id,version.memory_id)
               AND (newer.created_at,newer.id)>(version.created_at,version.id)
             ORDER BY newer.created_at DESC,newer.id DESC OFFSET $2 LIMIT 1
           )
         ))
       ORDER BY version.created_at,version.memory_store_id,version.id
       LIMIT $3 FOR UPDATE OF version SKIP LOCKED
     )
     DELETE FROM mechane.managed_memory_versions version USING expired
     WHERE (version.memory_store_id,version.id)=(expired.memory_store_id,expired.id)`,
    [RETENTION_DAYS, LIVE_HISTORY_ROWS - 1, PRUNE_MAX_ROWS],
  );

  return rowCount ?? 0;
}
