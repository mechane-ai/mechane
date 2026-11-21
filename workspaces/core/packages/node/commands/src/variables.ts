import { API_KEY_VARIABLE, CONFIG_HOME_VARIABLE } from './constants.ts';

/** A variable the CLI reads that no flag supplies, such as a secret, which never belongs on a command line. */
type VariableDeclaration = { readonly summary: string };

/** The variables the CLI reads beside its flags' own, keyed by their name. */
export const VARIABLES = {
  [API_KEY_VARIABLE]: {
    summary: 'a key from mechane key create, used in place of the saved login, such as by an agent or CI',
  },
  [CONFIG_HOME_VARIABLE]: { summary: 'the folder whose mechane folder holds the saved login; ~/.config when unset' },
} as const satisfies Readonly<Record<string, VariableDeclaration>>;
