import type { CredentialKeyring, StoreContext } from '@mechane/authority-store';
import { createManagedAgentStore } from './agents.ts';
import { createManagedEvidenceStore } from './evidence-store.ts';
import { createInstalledCommandAccess } from './installed-command-access.ts';
import { createInstalledEnvironmentStore } from './installed-environment.ts';
import { createManagedMemoryStore } from './memory.ts';
import { createManagedSessionStore } from './sessions.ts';
import { createManagedSkillStore } from './skills.ts';
import { createManagedVaultStore } from './vault-store.ts';
import { createManagedWorkerStore } from './work-store.ts';

export function createManagedCatalog(context: StoreContext, keyring: CredentialKeyring) {
  return {
    installed: {
      ...createInstalledEnvironmentStore(context),
      commandAccess: createInstalledCommandAccess(context, keyring),
    },
    agents: createManagedAgentStore(context),
    evidence: createManagedEvidenceStore(context),
    sessions: createManagedSessionStore(context, keyring),
    worker: createManagedWorkerStore(context),
    memory: createManagedMemoryStore(context),
    skills: createManagedSkillStore(context),
    vaults: createManagedVaultStore(context, keyring),
  };
}
