import { Schema } from 'effect';

export class DevSessionError extends Error {
  readonly _tag = 'DevSessionError';
  override readonly name = 'DevSessionError';
}

export class DevSessionUnavailableError extends Error {
  readonly _tag = 'DevSessionUnavailableError';
  override readonly name = 'DevSessionUnavailableError';
}

export const DevProvider = Schema.Literals(['fixture', 'live']);
export type DevProvider = typeof DevProvider.Type;

export const DevApplyTarget = Schema.Literals(['sandbox', 'guest']);
export type DevApplyTarget = typeof DevApplyTarget.Type;

export const DevRequest = Schema.Union([
  Schema.Struct({ command: Schema.Literal('status') }),
  Schema.Struct({ command: Schema.Literal('stop') }),
  Schema.Struct({ command: Schema.Literal('cli'), args: Schema.Array(Schema.String) }),
  Schema.Struct({ command: Schema.Literal('test'), name: Schema.NonEmptyString }),
  Schema.Struct({ command: Schema.Literal('apply'), target: DevApplyTarget }),
]);

export type DevRequest = typeof DevRequest.Type;

export const DevOutput = Schema.Union([
  Schema.Struct({ channel: Schema.Literals(['stdout', 'stderr']), text: Schema.String }),
  Schema.Struct({ channel: Schema.Literal('ready') }),
  Schema.Struct({ channel: Schema.Literal('done'), exitCode: Schema.Int }),
  Schema.Struct({ channel: Schema.Literal('error'), message: Schema.NonEmptyString }),
]);

export type DevOutput = typeof DevOutput.Type;

export const DevSessionRecord = Schema.Struct({
  version: Schema.Literal(1),
  worktreeDirectory: Schema.NonEmptyString,
  stateDirectory: Schema.NonEmptyString,
  socketPath: Schema.NonEmptyString,
  origin: Schema.NonEmptyString,
  providers: Schema.Struct({ model: DevProvider, github: DevProvider }),
  pid: Schema.Int,
  startedAt: Schema.NonEmptyString,
});

export type DevSessionRecord = typeof DevSessionRecord.Type;

type DevFailureMessageInput = { readonly cause: unknown };

export function devFailureMessage({ cause }: DevFailureMessageInput): string {
  if (cause instanceof Error) {
    return cause.message;
  }

  return 'Inspect the retained dev session for the failed operation';
}
