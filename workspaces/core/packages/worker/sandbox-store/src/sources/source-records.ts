import type { SourceId } from '@mechane/records';
import { SourceFencePhase } from '@mechane/sandbox-wire';
import { decodeFirst } from '@mechane/store';
import type { RecordsInput, SqlCall } from '@mechane/store';
import { Option, Schema } from 'effect';
import { SourceFence } from './schemas.ts';

const SourceFenceJson = Schema.fromJsonString(SourceFence);
const SourceFenceRow = Schema.Struct({ record: SourceFenceJson });
const readRecord: (row: typeof SourceFenceRow.Type) => SourceFence = (row) => row.record;

const TERMINAL_PHASES: ReadonlySet<SourceFencePhase> = new Set([SourceFencePhase.Ready, SourceFencePhase.Failed]);

type SourceFenceIdentity = { readonly sourceId: SourceId };
type SaveSourceFenceInput = { readonly fence: SourceFence };

/** Keeps the active credential fence durable across Worker restarts. */
export function sourceRecords({ sql }: RecordsInput) {
  return {
    sourceFence: (input: SourceFenceIdentity): Option.Option<SourceFence> => sourceFence({ sql, ...input }),
    activeSourceFence: (): Option.Option<SourceFence> => activeSourceFence({ sql }),
    saveSourceFence: (input: SaveSourceFenceInput): void => saveSourceFence({ sql, ...input }),
  };
}

function sourceFence({ sql, sourceId }: SqlCall<SourceFenceIdentity>): Option.Option<SourceFence> {
  const cursor = sql.exec('SELECT record FROM source_fences WHERE id = ?', sourceId);

  const decoded = decodeFirst({ cursor, schema: SourceFenceRow });

  return Option.map(decoded, readRecord);
}

function activeSourceFence({ sql }: RecordsInput): Option.Option<SourceFence> {
  const cursor = sql.exec('SELECT record FROM source_fences WHERE active = 1');

  const decoded = decodeFirst({ cursor, schema: SourceFenceRow });

  return Option.map(decoded, readRecord);
}

function saveSourceFence({ sql, fence }: SqlCall<SaveSourceFenceInput>): void {
  const record = Schema.encodeSync(SourceFenceJson)(fence);
  const isActive = !TERMINAL_PHASES.has(fence.phase);
  const active = Number(isActive);

  sql.exec(
    'INSERT INTO source_fences (id, active, record) VALUES (?, ?, ?) ON CONFLICT (id) DO UPDATE SET active = excluded.active, record = excluded.record',
    fence.sourceId,
    active,
    record,
  );
}
