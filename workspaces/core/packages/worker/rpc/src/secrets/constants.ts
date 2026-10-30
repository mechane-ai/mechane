import { WORKER_VARIABLES } from '@mechane/deployment';

/** Secret binding identifiers are safe to include in failures; their values are not. */
export const OperatorSecretName = {
  GitHub: WORKER_VARIABLES.githubClientSecret,
  Model: WORKER_VARIABLES.modelApiKey,
  CredentialKeyring: WORKER_VARIABLES.credentialKeyring,
} as const;

export type OperatorSecretName = (typeof OperatorSecretName)[keyof typeof OperatorSecretName];
