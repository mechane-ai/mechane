import {
  Allowance,
  EvidenceArtifact,
  ListedEvent,
  Mech,
  MechSummary,
  ProcessObservation,
  SandboxReport,
  Trace,
  Turn,
} from '@mechane/protocol';
import { MechId, wireStruct } from '@mechane/records';
import { Schema } from 'effect';

function recordSchema<Value extends Schema.Top>(value: Value) {
  return Schema.Struct({ key: Schema.String, value: Schema.toEncoded(value) });
}

function mechRecordSchema<Value extends Schema.Top>(value: Value) {
  return Schema.Struct({ key: Schema.String, mechId: Schema.toEncoded(MechId), value: Schema.toEncoded(value) });
}

/** The wire fields fetched by showMech that list summaries cannot replace. */
export const MechDefinition = wireStruct({
  fields: {
    revision: Mech.to.fields.revision,
    instructions: Mech.to.fields.instructions,
    dailyCapMicros: Mech.to.fields.dailyCapMicros,
    activeRevision: Mech.to.fields.activeRevision,
    updatedAt: Mech.to.fields.updatedAt,
    updaterId: Mech.to.fields.updaterId,
  },
});

export type MechDefinition = typeof MechDefinition.Type;

/** The showTurn evidence stored separately from its shared canonical turn. */
export const TraceEvidence = wireStruct({
  fields: {
    /** Null identifies an unknown run variant without an orderable native version. */
    version: Schema.NullOr(Schema.Int.check(Schema.isGreaterThan(0))),
    dispatches: Trace.to.fields.dispatches,
    replyExcerpt: Trace.to.fields.replyExcerpt,
    toolCalls: Trace.to.fields.toolCalls,
    evidenceNotices: Trace.to.fields.evidenceNotices,
  },
});

export type TraceEvidence = typeof TraceEvidence.Type;

/** A workspace-unique mech identity with its encoded current summary. */
export const MechSummaryRow = recordSchema(MechSummary);
export type MechSummaryRow = typeof MechSummaryRow.Type;
/** Definition fields whose revision must match the summary before detail renders. */
export const MechDefinitionRow = recordSchema(MechDefinition);
export type MechDefinitionRow = typeof MechDefinitionRow.Type;
/** A turn keyed by mech and turn IDs, including unknown protocol variants. */
export const TurnRow = mechRecordSchema(Trace.to.fields.turn);
export type TurnRow = typeof TurnRow.Type;
/** An event keyed by mech and sequence, shared across recent and turn reads. */
export const EventRow = mechRecordSchema(ListedEvent);
export type EventRow = typeof EventRow.Type;
/** Encoded trace evidence sharing a key with its separately stored turn. */
export const TraceEvidenceRow = mechRecordSchema(TraceEvidence);
export type TraceEvidenceRow = typeof TraceEvidenceRow.Type;
/** Capture metadata keyed by the admitted mech and durable artifact identity. */
export const EvidenceArtifactRow = mechRecordSchema(EvidenceArtifact);
export type EvidenceArtifactRow = typeof EvidenceArtifactRow.Type;
/** One passive environment snapshot includes its saved files and bounded process summaries. */
export const EnvironmentReportRow = mechRecordSchema(SandboxReport);
export type EnvironmentReportRow = typeof EnvironmentReportRow.Type;
/** Bounded logs fetched only for an explicitly opened process handle. */
export const EnvironmentProcessDetailsRow = mechRecordSchema(ProcessObservation);
export type EnvironmentProcessDetailsRow = typeof EnvironmentProcessDetailsRow.Type;
/** The workspace allowance with protocol money values preserved in wire form. */
export const AllowanceRow = recordSchema(Allowance);
export type AllowanceRow = typeof AllowanceRow.Type;

/** Validates native stored values synchronously and restores the owning protocol representation. */
export function restoreRecord<Value, Encoded>(schema: Schema.Codec<Value, Encoded>, value: unknown): Value {
  // Native collection callbacks reject invalid stored rows before queries can render them.
  // ast-grep-ignore: defect-sites
  return Schema.decodeUnknownSync(schema)(value);
}

/** Keeps copied history IDs and event sequences distinct between forked mechs. */
export function recordKey(mechId: string, identifier: string | number): string {
  return JSON.stringify([mechId, identifier]);
}

/** Restores summary dates and optional fork metadata for view consumers. */
export function decodeMechSummary(row: MechSummaryRow): MechSummary {
  return restoreRecord(MechSummary, row.value);
}

/** Assembles the view model after the caller confirms both rows share a revision. */
export function decodeMech(summary: MechSummaryRow, definition: MechDefinitionRow): Mech {
  const identity = decodeMechSummary(summary);
  const fields = restoreRecord(MechDefinition, definition.value);

  return { ...identity, ...fields };
}

/** Restores known turn dates while preserving unknown protocol variants. */
export function decodeTurn(row: TurnRow): Trace['turn'] {
  return restoreRecord(Trace.to.fields.turn, row.value);
}

/** Restores the event protocol value without discarding unknown event fields. */
export function decodeEvent(row: EventRow): ListedEvent {
  return restoreRecord(ListedEvent, row.value);
}

/** Unknown turn variants remain readable without inventing a version. */
export function turnVersion(turn: Trace['turn']): number | null {
  return Schema.is(Turn)(turn) ? turn.version : null;
}

/** A trace is complete only when its evidence belongs to the canonical run snapshot. */
export function decodeTrace(turn: TurnRow, evidence: TraceEvidenceRow): Trace | undefined {
  const { version, ...fields } = restoreRecord(TraceEvidence, evidence.value);
  const decoded = decodeTurn(turn);

  return turnVersion(decoded) === version ? { ...fields, turn: decoded } : undefined;
}

/** Restores capture status and observed provenance from its canonical row. */
export function decodeEvidenceArtifact(row: EvidenceArtifactRow): EvidenceArtifact {
  return restoreRecord(EvidenceArtifact, row.value);
}

export function decodeEnvironmentReport(row: EnvironmentReportRow): SandboxReport {
  return restoreRecord(SandboxReport, row.value);
}

/** Restores bounded output fetched for one exact process handle. */
export function decodeEnvironmentProcessDetails(row: EnvironmentProcessDetailsRow): ProcessObservation {
  return restoreRecord(ProcessObservation, row.value);
}

/** Restores the workspace allowance with the protocol's money and optional fields. */
export function decodeAllowance(row: AllowanceRow): Allowance {
  return restoreRecord(Allowance, row.value);
}
