import { RecordId } from '@mechane/records';
import { Schema } from 'effect';

/** Native workflow run identity retained separately from derived browser and process receipt identities. */
export const SandboxRunId = RecordId.pipe(Schema.brand('SandboxRunId'));
export type SandboxRunId = typeof SandboxRunId.Type;
