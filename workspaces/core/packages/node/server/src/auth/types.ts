import type { AuthenticationConfiguration, AuthRuntimeStore } from '@mechane/runtime';

export type AuthHandlerOptions = {
  readonly store: AuthRuntimeStore;
  readonly configuration: AuthenticationConfiguration;
};

export type AuthRequest = AuthHandlerOptions & { readonly request: Request; readonly peerAddress?: string | null };
export type SessionCookie = { readonly token: string; readonly principalId: string };
