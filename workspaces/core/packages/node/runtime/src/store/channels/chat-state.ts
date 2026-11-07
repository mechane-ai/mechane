import { createPostgresState } from '@chat-adapter/state-pg';
import type { Logger } from 'chat';
import { Redacted } from 'effect';
import { Pool } from 'pg';

type ChatStateInput = {
  readonly databaseUrl: Redacted.Redacted;
  readonly installationId: string;
  readonly logger: Logger;
};

export function openChatState({ databaseUrl, installationId, logger }: ChatStateInput) {
  const pool = new Pool({ connectionString: Redacted.value(databaseUrl), max: 1, options: '-c search_path=chat' });

  const state = createPostgresState({
    client: pool,
    keyPrefix: `mechane:${installationId}`,
    autoCreateSchema: false,
    logger,
  });

  return { state, close: async () => await pool.end() };
}
