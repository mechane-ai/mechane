/** The manifest, bootstrap credential, and process lock of a persistent local installation. */
export const LOCAL_FILES = {
  manifest: 'local-state.json',
  bootstrapSecret: 'bootstrap-secret',
  credentialKeyring: 'credential-keyring.json',
  lock: 'local-lock.sqlite3',
} as const;

/** The marker that distinguishes an installation from an unrelated directory. */
export const LOCAL_APPLICATION = 'mechane';
