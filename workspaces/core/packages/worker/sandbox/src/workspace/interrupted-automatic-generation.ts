import { RecordId, SandboxOperationId } from '@mechane/records';
import { Option, Result, Schema } from 'effect';
import { WorkspaceTransferFailed, WorkspaceTransferPhase } from '../errors.ts';

const FIRST_PART = 0;
const HELD_BY_OTHER_GENERATION = 'another workspace generation owns the guest fence';

const ArchivedOperation = Schema.fromJsonString(
  Schema.Struct({
    operationId: SandboxOperationId,
    generation: RecordId,
    phase: Schema.Literal(WorkspaceTransferPhase.Archive),
    path: Schema.Null,
    cursor: Schema.Literal(FIRST_PART),
  }),
);

const PREFIX = 'workspace transfer ';
const RESET = ': Error: Durable Object reset because its code was updated.';

type InterruptedInput = { readonly cause: unknown; readonly diagnostic: Option.Option<string> };

/** Earlier Workers recorded the interrupted automatic capture only in the reset diagnostic. */
export function interruptedAutomaticGeneration({ cause, diagnostic }: InterruptedInput): Option.Option<RecordId> {
  if (!Schema.is(WorkspaceTransferFailed)(cause) || cause.reason !== HELD_BY_OTHER_GENERATION) {
    return Option.none();
  }

  if (Option.isNone(diagnostic)) {
    return Option.none();
  }

  const text = diagnostic.value;

  if (!text.startsWith(PREFIX) || !text.endsWith(RESET)) {
    return Option.none();
  }

  const document = text.slice(PREFIX.length, -RESET.length);
  const decoded = Schema.decodeUnknownResult(ArchivedOperation)(document);

  if (Result.isFailure(decoded)) {
    return Option.none();
  }

  const { generation, operationId } = decoded.success;

  if (generation !== operationId || generation === cause.generation) {
    return Option.none();
  }

  return Option.some(generation);
}
