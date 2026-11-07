import type { StoreContext } from '../../context.ts';
import { createDeviceStore } from './devices.ts';
import { createIdentityStore } from './identities.ts';
import { createKeyStore } from './keys.ts';

export function createAuthStore(context: StoreContext) {
  return { auth: { ...createIdentityStore(context), ...createKeyStore(context), ...createDeviceStore(context) } };
}

export type AuthRuntimeStore = ReturnType<typeof createAuthStore>;
