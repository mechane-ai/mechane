import { SELF_TOKEN_VARIABLE } from '@mechane/protocol';
import { API_KEY_VARIABLE, CONFIG_HOME_VARIABLE } from './constants.ts';

/** A variable the CLI reads that no flag supplies, such as a secret, which never belongs on a command line. */
type VariableDeclaration = { readonly summary: string };

/** The variables the CLI reads beside its flags' own, keyed by their name. */
export const VARIABLES = {
  [API_KEY_VARIABLE]: {
    summary: 'a key from mechane key create, used in place of the saved login, such as by an agent or CI',
  },
  [SELF_TOKEN_VARIABLE]: {
    summary: 'a short-lived credential injected by the environment for commands scoped to the current mech',
  },
  [CONFIG_HOME_VARIABLE]: { summary: 'the folder whose mechane folder holds the saved login; ~/.config when unset' },
} as const satisfies Readonly<Record<string, VariableDeclaration>>;
