import { createApi } from './api.ts';
import type { Output } from './api.ts';

/** The current principal and the workspaces the server admits it to. */
export type ViewerSession = Output<'showPrincipal'> & Output<'listWorkspaces'>;

/** Each read resolves the caller from the same browser session. */
export async function loadViewerSession(origin: URL, signal: AbortSignal): Promise<ViewerSession> {
  const api = createApi(origin, signal, () => undefined);
  const [principal, workspaces] = await Promise.all([api('showPrincipal', {}), api('listWorkspaces', {})]);

  return { ...principal, ...workspaces };
}
