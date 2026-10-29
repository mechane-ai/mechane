import { DroneStatus, TurnStatus } from '@mechane/protocol';
import { DroneId, TurnId, wireStruct } from '@mechane/records';
import { decodeFirst, decodeOne } from '@mechane/store';
import type { RecordsInput, SqlCall } from '@mechane/store';
import { Option, Schema } from 'effect';
import { DispatchWork, MechRow } from '../schemas.ts';
import type {
  CreateMechInput,
  DefinitionRevisionInput,
  DispatchSessionInput,
  DispatchTarget,
  MechRecords,
} from '../types.ts';
import { definitionRecords } from './definition-records.ts';

/** Where a dispatch counts: the mech's workspace, id and daily cap, and the drone and the turn that run. */
const DispatchTargetRow = wireStruct({
  fields: {
    workspaceId: Schema.String,
    mechId: Schema.String,
    dailyCapMicros: Schema.Int,
    /** Absent when no running drone binds the dispatch's session. */
    droneId: Schema.OptionFromNullOr(DroneId),
    /** Absent while no turn runs. */
    turnId: Schema.OptionFromNullOr(TurnId),
  },
});

type DispatchTargetRow = typeof DispatchTargetRow.Type;

/** The record functions of the one mech an object holds, from its creation on. */
export function mechRecords({ sql }: RecordsInput): MechRecords {
  return {
    createMech: (input) => createMech({ sql, ...input }),
    mech: () => mech({ sql }),
    updateMech: (input) => updateMech({ sql, ...input }),
    activateDefinition: (input) => activateDefinition({ sql, ...input }),
    pendingMechIndex: () => pendingMechIndex({ sql }),
    markMechIndexed: (input) => markMechIndexed({ sql, ...input }),
    ...definitionRecords({ sql }),
    dispatchTarget: (input) => dispatchTarget({ sql, ...input }),
  };
}

function createMech({ sql, mech: created }: SqlCall<CreateMechInput>): void {
  const row = Schema.encodeSync(MechRow)(created);

  sql.exec(
    'INSERT INTO mech (id, workspace_id, name, model, instructions, creator_id, created_at_ms, daily_cap_micros, forked_from, revision, active_revision, status, updated_at_ms, updater_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    row.id,
    row.workspace_id,
    row.name,
    row.model,
    row.instructions,
    row.creator_id,
    row.created_at_ms,
    row.daily_cap_micros,
    row.forked_from,
    row.revision,
    row.active_revision,
    row.status,
    row.updated_at_ms,
    row.updater_id,
  );

  recordRevision({ sql, mech: created });
}

function mech({ sql }: RecordsInput): Option.Option<MechRow> {
  const cursor = sql.exec(
    'SELECT id, workspace_id, name, model, instructions, creator_id, created_at_ms, daily_cap_micros, forked_from, revision, active_revision, status, updated_at_ms, updater_id FROM mech',
  );

  return decodeFirst({ cursor, schema: MechRow });
}

function updateMech({ sql, mech: updated }: SqlCall<CreateMechInput>): void {
  const row = Schema.encodeSync(MechRow)(updated);

  sql.exec(
    'UPDATE mech SET name = ?, model = ?, instructions = ?, daily_cap_micros = ?, revision = ?, status = ?, updated_at_ms = ?, updater_id = ? WHERE id = ?',
    row.name,
    row.model,
    row.instructions,
    row.daily_cap_micros,
    row.revision,
    row.status,
    row.updated_at_ms,
    row.updater_id,
    row.id,
  );

  recordRevision({ sql, mech: updated });
}

function activateDefinition({ sql, revision }: SqlCall<DefinitionRevisionInput>): void {
  sql.exec('UPDATE mech SET active_revision = ?', revision);
}

function pendingMechIndex({ sql }: RecordsInput): Option.Option<MechRow> {
  const cursor = sql.exec(
    'SELECT id, workspace_id, name, model, instructions, creator_id, created_at_ms, daily_cap_micros, forked_from, revision, active_revision, status, updated_at_ms, updater_id FROM mech WHERE revision > indexed_revision',
  );

  return decodeFirst({ cursor, schema: MechRow });
}

function markMechIndexed({ sql, revision }: SqlCall<DefinitionRevisionInput>): void {
  sql.exec('UPDATE mech SET indexed_revision = MAX(indexed_revision, ?)', revision);
}

function recordRevision({ sql, mech: revision }: SqlCall<CreateMechInput>): void {
  const row = Schema.encodeSync(MechRow)(revision);

  sql.exec(
    'INSERT INTO mech_revisions (revision, name, model, instructions, daily_cap_micros, status, updated_at_ms, updater_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    row.revision,
    row.name,
    row.model,
    row.instructions,
    row.daily_cap_micros,
    row.status,
    row.updated_at_ms,
    row.updater_id,
  );
}

/**
 * A drone's dispatch counts against the running drone bound to its conversation's session, and every other dispatch
 * against the running turn. The schema holds at most one running turn, so with no drone found exactly one turn runs.
 */
function dispatchTarget({ sql, sessionId }: SqlCall<DispatchSessionInput>): DispatchTarget {
  const cursor = sql.exec(
    'SELECT mech.workspace_id, mech.id AS mech_id, mech_revisions.daily_cap_micros, drones.id AS drone_id, turns.id AS turn_id FROM mech JOIN mech_revisions ON mech_revisions.revision = mech.active_revision LEFT JOIN drones ON drones.pi_session_id = ? AND drones.status = ? LEFT JOIN turns ON turns.status = ?',
    sessionId,
    DroneStatus.Running,
    TurnStatus.Running,
  );

  const { droneId, turnId, ...target } = decodeOne({ cursor, schema: DispatchTargetRow });
  // With no running drone of the session, the running turn dispatches: only a turn or a drone dispatches, and the
  // schema holds at most one running turn.
  const turnWork: () => DispatchWork = () => DispatchWork.cases.Turn.make({ id: Option.getOrThrow(turnId) });
  const work = Option.match(droneId, { onSome: (id) => DispatchWork.cases.Drone.make({ id }), onNone: turnWork });

  return { ...target, work };
}
