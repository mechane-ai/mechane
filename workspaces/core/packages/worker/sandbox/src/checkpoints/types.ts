import type { SandboxArchive } from '@mechane/protocol';
import type { WorkspaceCheckpoint } from '@mechane/sandbox-store';
import type { WorkspaceProviderStepInput } from '../types.ts';

/** The current transfer and its durable settled receipt. */
export type CheckpointStepInput = WorkspaceProviderStepInput & { readonly checkpoint: WorkspaceCheckpoint };

/** A checkpoint whose validated archive metadata is available for upload or publication. */
export type ArchivedCheckpointInput = CheckpointStepInput & { readonly archive: SandboxArchive };
