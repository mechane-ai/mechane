import { ORIGIN_VARIABLE } from '@mechane/deployment';
import { writeDiagnostic, writeResult } from '@mechane/program';
import { localSignInUrl } from '@mechane/protocol';
import { PROGRAM } from '../constants.ts';
import type { LocalStack } from '../types.ts';

type AnnouncePackageInput = { readonly stack: LocalStack; readonly folder: string };

/** Prints bootstrap paths and origin-bound CLI instructions without exposing credentials. */
export function announcePackage({ stack, folder }: AnnouncePackageInput): void {
  const origin = stack.origin.origin;
  const signIn = localSignInUrl({ origin: stack.origin });

  const lines = [
    `open ${signIn.href} and paste the secret from ${stack.bootstrapSecretFile}`,
    `sign in with ${ORIGIN_VARIABLE}=${origin} "${folder}/mechane" auth login`,
    `state stays in ${stack.stateFolder}; logs are in ${stack.logFile}; stop with Ctrl-C`,
  ];

  writeResult({ line: `export ${ORIGIN_VARIABLE}=${origin}` });

  for (const line of lines) {
    writeDiagnostic({ program: PROGRAM, line });
  }
}
