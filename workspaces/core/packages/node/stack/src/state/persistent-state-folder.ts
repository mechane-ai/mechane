import { PrivateMode, StepSubject } from '@mechane/program';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { chmod, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { verifyCelldStopped } from '../celld/verify-celld-stopped.ts';
import { StackStep } from '../constants.ts';
import { StackFailed } from '../errors.ts';
import type { StackSettings, StateLayout } from '../types.ts';
import { LOCAL_FILES } from './constants.ts';
import { localStateManifest } from './local-state-manifest.ts';
import { lockedStateFolder } from './locked-state-folder.ts';
import { localBootstrapSecret } from './secrets/local-bootstrap-secret.ts';
import { localCredentialKeyring } from './secrets/local-credential-keyring.ts';
import { stateLayout } from './state-layout.ts';

type PersistentStateFolderInput = { readonly settings: StackSettings };

type PersistentState = StateLayout & {
  readonly bootstrapSecret: string;
  readonly bootstrapSecretFile: string;
  readonly credentialKeyring: string;
};

/** Opens a private installation whose credentials and runtime files survive scope closure. */
export const persistentStateFolder = Effect.fn('persistentStateFolder')(function* ({
  settings,
}: PersistentStateFolderInput): Effect.fn.Return<PersistentState, StackFailed, Scope.Scope> {
  const stateFolder = yield* lockedStateFolder({ path: settings.localStateFolder });

  yield* localStateManifest({ stateFolder, origin: settings.localOrigin });
  yield* Effect.tryPromise({
    try: () => chmod(stateFolder, PrivateMode.Folder),
    catch: (cause) => new StackFailed({ step: StackStep.WriteLocalState, reason: String(cause) }),
  });

  const layout = stateLayout({ stateFolder });

  yield* verifyCelldStopped({ projectFolder: layout.projectFolder });

  const bootstrapSecretFile = join(stateFolder, LOCAL_FILES.bootstrapSecret);
  const bootstrapSecret = yield* localBootstrapSecret({ path: bootstrapSecretFile });
  const credentialKeyringFile = join(stateFolder, LOCAL_FILES.credentialKeyring);
  const credentialKeyring = yield* localCredentialKeyring({ path: credentialKeyringFile });

  const paths = [layout.projectFolder, layout.sandboxesFolder];

  yield* Effect.forEach(paths, createDirectory, { concurrency: 1, discard: true });

  return { ...layout, bootstrapSecret, bootstrapSecretFile, credentialKeyring };
});

const createDirectory = Effect.fn('createDirectory')(function* (path: string): Effect.fn.Return<void, StackFailed> {
  const step = StackStep.CreateStateFolder;
  const subjects = [StepSubject.cases.Path.make({ path })];

  yield* Effect.tryPromise({
    try: () => mkdir(path, { recursive: true, mode: PrivateMode.Folder }),
    catch: (cause) => new StackFailed({ step, subjects, reason: String(cause) }),
  });
});
