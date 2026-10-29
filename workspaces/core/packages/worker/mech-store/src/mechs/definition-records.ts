import type { MechRevisionPage } from '@mechane/protocol';
import { decodeOne, decodeRows } from '@mechane/store';
import type { RecordsInput, SqlCall } from '@mechane/store';
import { MechRevisionRow } from '../definition.schemas.ts';
import type { MechRecords, RevisionsAfterInput } from '../types.ts';

const REVISIONS_PER_PAGE = 100;

/** Reads the definition pinned for running work and pages the immutable history after an exclusive revision cursor. */
export function definitionRecords({ sql }: RecordsInput): Pick<MechRecords, 'activeDefinition' | 'mechRevisions'> {
  return {
    activeDefinition: () => activeDefinition({ sql }),
    mechRevisions: (input) => mechRevisions({ sql, ...input }),
  };
}

function activeDefinition({ sql }: RecordsInput): MechRevisionRow {
  const cursor = sql.exec(
    'SELECT mech_revisions.revision, mech_revisions.name, mech_revisions.model, mech_revisions.instructions, mech_revisions.daily_cap_micros, mech_revisions.status, mech_revisions.updated_at_ms, mech_revisions.updater_id FROM mech_revisions JOIN mech ON mech.active_revision = mech_revisions.revision',
  );

  return decodeOne({ cursor, schema: MechRevisionRow });
}

function mechRevisions({ sql, after }: SqlCall<RevisionsAfterInput>): MechRevisionPage {
  const cursor = sql.exec(
    'SELECT revision, name, model, instructions, daily_cap_micros, status, updated_at_ms, updater_id FROM mech_revisions WHERE revision > ? ORDER BY revision LIMIT ?',
    after,
    REVISIONS_PER_PAGE + 1,
  );

  const revisions = decodeRows({ cursor, schema: MechRevisionRow });

  return { revisions: revisions.slice(0, REVISIONS_PER_PAGE), hasMore: revisions.length > REVISIONS_PER_PAGE };
}
