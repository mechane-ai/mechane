import { createApi } from './api.ts';
import type { Output } from './api.ts';

/** The current principal and the workspaces the server admits it to. */
export type Session = Output<'showPrincipal'> & Output<'listWorkspaces'>;

/** Loads the principal before discovering its current workspace membership. */
export async function loadSession(origin: URL, signal: AbortSignal): Promise<Session> {
  const api = createApi(origin, signal, () => undefined);
  const principal = await api('showPrincipal', {});
  const workspaces = await api('listWorkspaces', {});

  return { ...principal, ...workspaces };
}
