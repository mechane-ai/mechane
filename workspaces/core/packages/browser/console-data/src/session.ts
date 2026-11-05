import { createApi } from './api.ts';
import type { Output } from './api.ts';

/** The current principal and the workspaces the server admits it to. */
export type Session = Output<'showPrincipal'> & Output<'listWorkspaces'>;

/** Each read resolves the caller from the same browser session. */
export async function loadSession(origin: URL, signal: AbortSignal): Promise<Session> {
  const api = createApi(origin, signal, () => undefined);
  const [principal, workspaces] = await Promise.all([api('showPrincipal', {}), api('listWorkspaces', {})]);

  return { ...principal, ...workspaces };
}
