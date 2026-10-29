import { EVERY_WORKSPACE } from '@mechane/deployment';
import { RecordId } from '@mechane/records';
import { Schema } from 'effect';
import { REVISION_PATTERN } from './releases/constants.ts';

/** The revision of the source a release or a Worker was built from, as `git describe` names it. */
export const Revision = Schema.String.check(Schema.isPattern(REVISION_PATTERN));

export type Revision = typeof Revision.Type;

/** Workspaces as an operator's list variable writes them: the JSON array of their ids. */
export const WorkspaceIdsVariable = Schema.fromJsonString(Schema.Array(RecordId));

export type WorkspaceIdsVariable = typeof WorkspaceIdsVariable.Type;

/** The workspaces whose mechs and drones get sandboxes: every one, as a local stack stages it, or those listed. */
export const SandboxWorkspacesVariable = Schema.Union([Schema.Literal(EVERY_WORKSPACE), WorkspaceIdsVariable]);

export type SandboxWorkspacesVariable = typeof SandboxWorkspacesVariable.Type;

/** A time on the wire, an RFC 3339 string. */
export const WireTime = Schema.DateTimeUtcFromString;

export type WireTime = typeof WireTime.Type;

/**
 * The fields of a record of a kind a newer deployment added, which this release does not know, as the wire wrote them.
 * A reader keeps them whole, so the record encodes again as it came.
 */
export const UnknownFields = Schema.Record(Schema.String, Schema.Unknown);

export type UnknownFields = typeof UnknownFields.Type;
