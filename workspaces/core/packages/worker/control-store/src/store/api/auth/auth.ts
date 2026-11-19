import type { StoreContext } from '../../context.ts';
import { createDeviceStore } from './devices.ts';
import { createIdentityStore } from './identities.ts';
import { resolveInstallationPrincipal } from './installation.ts';
import type { InstallationWorkspace } from './installation.ts';
import { createKeyStore } from './keys.ts';
import { createManagedOidcStore } from './managed-oidc.ts';
import { createWorkspaceServiceStore } from './workspace-services.ts';

export function createAuthStore(context: StoreContext) {
  return {
    auth: {
      resolveManagedInstallation: (workspace: InstallationWorkspace) =>
        resolveInstallationPrincipal(context, workspace),
      ...createIdentityStore(context),
      ...createManagedOidcStore(context),
      ...createKeyStore(context),
      ...createWorkspaceServiceStore(context),
      ...createDeviceStore(context),
    },
  };
}

export type AuthRuntimeStore = ReturnType<typeof createAuthStore>;
