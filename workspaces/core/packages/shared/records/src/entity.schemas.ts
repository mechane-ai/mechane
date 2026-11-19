import { Schema } from 'effect';
import { RecordId } from './schemas.ts';

/** The ID of a mech within its workspace. */
export const MechId = RecordId.pipe(Schema.brand('MechId'));
export type MechId = typeof MechId.Type;

const managedAgentPattern = Schema.isPattern(/^agent_[A-Za-z0-9_-]{1,128}$/u);
export const ManagedAgentId = Schema.String.check(managedAgentPattern).pipe(Schema.brand('ManagedAgentId'));
export type ManagedAgentId = typeof ManagedAgentId.Type;

export const MachineId = RecordId.pipe(Schema.brand('MachineId'));
export type MachineId = typeof MachineId.Type;

export const NativeSnapshotId = RecordId.pipe(Schema.brand('NativeSnapshotId'));
export type NativeSnapshotId = typeof NativeSnapshotId.Type;

/** The ID of the workspace that owns its resources and grants. */
export const WorkspaceId = RecordId.pipe(Schema.brand('WorkspaceId'));
export type WorkspaceId = typeof WorkspaceId.Type;

/** The ID of the authenticated actor recorded on an operation. */
export const PrincipalId = RecordId.pipe(Schema.brand('PrincipalId'));
export type PrincipalId = typeof PrincipalId.Type;

/** A credential of one service principal in one workspace. */
export const ServiceKeyId = RecordId.pipe(Schema.brand('ServiceKeyId'));
export type ServiceKeyId = typeof ServiceKeyId.Type;

export const SessionId = RecordId.pipe(Schema.brand('SessionId'));
export type SessionId = typeof SessionId.Type;
