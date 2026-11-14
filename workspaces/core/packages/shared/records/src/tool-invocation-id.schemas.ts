import { Schema } from 'effect';

/** An adapter receipt belongs to its native task, independently of the model's call identifier. */
export const ToolInvocationId = Schema.NonEmptyString.pipe(Schema.brand('ToolInvocationId'));

export type ToolInvocationId = typeof ToolInvocationId.Type;
