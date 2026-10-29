import { DeployFailed, DeployStep } from '@mechane/deploy-kernel';
import { PERMISSION_BITS, PrivateMode, StepSubject } from '@mechane/program';
import { Effect, Option, Record } from 'effect';
import { readFile, stat } from 'node:fs/promises';
import { parseEnv } from 'node:util';

const MODE_RADIX = 8;

type ReadEnvironmentInput = {
  /** Absent when credentials come from the declared environment references. */
  readonly path: Option.Option<string>;
  readonly inheritedCredentials: Readonly<Record<string, string>>;
};

type ParseEnvironmentInput = { readonly text: string };

/** A selected credential file must be owner-only and completely replaces inherited credentials. */
export const readEnvironment = Effect.fn('readEnvironment')(function* ({
  path,
  inheritedCredentials,
}: ReadEnvironmentInput): Effect.fn.Return<Readonly<Record<string, string>>, DeployFailed> {
  if (Option.isNone(path)) {
    return inheritedCredentials;
  }

  const filePath = path.value;
  const step = DeployStep.ReadEnvironmentFile;
  const subjects = [StepSubject.cases.Path.make({ path: filePath })];

  const { mode } = yield* Effect.tryPromise({
    try: () => stat(filePath),
    catch: (cause) => new DeployFailed({ step, subjects, reason: String(cause) }),
  });

  // oxlint-disable-next-line no-bitwise -- a file's access mode is encoded in its low nine bits
  const permissions = mode & PERMISSION_BITS;

  if (permissions !== PrivateMode.File) {
    const permissionBits = permissions.toString(MODE_RADIX);

    return yield* new DeployFailed({ step, subjects, reason: `its mode is ${permissionBits}; run chmod 600 on it` });
  }

  const text = yield* Effect.tryPromise({
    try: () => readFile(filePath, 'utf8'),
    catch: (cause) => new DeployFailed({ step, subjects, reason: String(cause) }),
  });

  return parseEnvironment({ text });
});

function parseEnvironment({ text }: ParseEnvironmentInput): Readonly<Record<string, string>> {
  const parsed = parseEnv(text);
  const present = Record.map(parsed, Option.fromUndefinedOr);

  return Record.getSomes(present);
}
