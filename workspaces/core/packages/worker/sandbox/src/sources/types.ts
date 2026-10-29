import type { SourceId } from '@mechane/records';
import type { SourceFence } from '@mechane/sandbox-store';
import type { WorkspaceProviderStepInput } from '../types.ts';

/** A checkout's immutable identity and the generation that owns its sandbox fence. */
export type SourceIdentity = { readonly sourceId: SourceId; readonly generation: SourceId };
/** The sandbox context and the exact source generation named by its caller. */
export type SourceFenceInput = WorkspaceProviderStepInput & SourceIdentity;
/** The sandbox context and the persisted fence used by one serialized transition. */
export type SourceFinalizeInput = WorkspaceProviderStepInput & { readonly fence: SourceFence };
