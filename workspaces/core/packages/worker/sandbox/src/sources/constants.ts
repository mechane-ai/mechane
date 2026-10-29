/** The source operation named by a replayable checkpoint execution id. */
export const SourceCheckpointKind = { Preparation: 'prepare', Finalization: 'finalize', Capture: 'capture' } as const;

export type SourceCheckpointKind = (typeof SourceCheckpointKind)[keyof typeof SourceCheckpointKind];
