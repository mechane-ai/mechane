import { wireStruct } from '@mechane/records';
import { Schema } from 'effect';

/** A snapshot resumes writers after copying; a drain keeps them frozen until machine shutdown. */
export const ArchiveMode = { Snapshot: 'snapshot', Drain: 'drain' } as const;

export type ArchiveMode = (typeof ArchiveMode)[keyof typeof ArchiveMode];

/** Declares the writer lifetime for a new immutable home archive. */
export const WorkspaceArchiveRequest = wireStruct({ fields: { mode: Schema.Enum(ArchiveMode) } });

export type WorkspaceArchiveRequest = typeof WorkspaceArchiveRequest.Type;
