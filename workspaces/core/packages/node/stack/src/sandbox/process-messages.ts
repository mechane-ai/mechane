import { Schema } from 'effect';

export const SandboxProcessStart = Schema.Struct({
  kind: Schema.Literal('start'),
  directory: Schema.NonEmptyString,
  workerEntry: Schema.NonEmptyString,
  launcherOrigin: Schema.NonEmptyString,
  runtimeOrigin: Schema.NonEmptyString,
  bearer: Schema.NonEmptyString,
});

export const SandboxProcessReady = Schema.Struct({ kind: Schema.Literal('ready'), origin: Schema.NonEmptyString });
export const SandboxProcessDispose = Schema.Struct({ kind: Schema.Literal('dispose') });
