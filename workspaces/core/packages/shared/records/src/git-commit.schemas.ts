import { Schema } from 'effect';

/** Full SHA-1 object IDs prevent a branch move from changing a recorded baseline. */
export const GitCommit = Schema.String.check(Schema.isPattern(/^[0-9a-f]{40}$/u));
export type GitCommit = typeof GitCommit.Type;
