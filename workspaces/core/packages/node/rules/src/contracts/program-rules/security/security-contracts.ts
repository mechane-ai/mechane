import type { ContractEnforcement, ContractName } from '@mechane/rule-shapes';
import { securityApiKeyLifecycle } from './security-api-key-lifecycle.ts';
import { securityCliCredentialLifecycle } from './security-cli-credential-lifecycle.ts';
import { securityInterpreterInjection } from './security-interpreter-injection.ts';
import { securityOauthBrowserSessions } from './security-oauth-browser-sessions.ts';
import { securityResourceAccessControl } from './security-resource-access-control.ts';
import { securityServerSecretStorage } from './security-server-secret-storage.ts';

/** The registry's entry for each contract of the security section, in the order of their folders. */
export const SECURITY_CONTRACTS = {
  'security-api-key-lifecycle': securityApiKeyLifecycle,
  'security-cli-credential-lifecycle': securityCliCredentialLifecycle,
  'security-oauth-browser-sessions': securityOauthBrowserSessions,
  'security-server-secret-storage': securityServerSecretStorage,
  'security-resource-access-control': securityResourceAccessControl,
  'security-interpreter-injection': securityInterpreterInjection,
} as const satisfies Readonly<Partial<Record<ContractName, ContractEnforcement>>>;
