import { ErrorCode } from '@mechane/commands';
import { ServerFailure } from '@mechane/protocol';
import { Record, Result, Schema } from 'effect';

const FailureRecord = Schema.Struct({ code: Schema.String });
const FailureEnvelope = Schema.fromJsonString(Schema.Struct({ errors: Schema.NonEmptyArray(FailureRecord) }));
const localCodes = Record.values(ErrorCode);
const serverCodes = ServerFailure.members.map((failure) => failure.identifier);
const knownCodes: ReadonlySet<string> = new Set([...localCodes, ...serverCodes]);

export function readFailureCode(stdout: string): string {
  const parsed = Schema.decodeUnknownResult(FailureEnvelope)(stdout);

  if (Result.isFailure(parsed)) {
    return 'NoTerminalFailure';
  }

  const code = parsed.success.errors[0].code;

  if (knownCodes.has(code)) {
    return code;
  }

  return 'UnrecognizedFailure';
}
