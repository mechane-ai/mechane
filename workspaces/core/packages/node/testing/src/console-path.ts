type ConsolePathInput = { readonly workspaceId: string; readonly mechId: string };

export function consolePath({ workspaceId, mechId }: ConsolePathInput): string {
  const search = new URLSearchParams({ workspace: workspaceId, mech: mechId });

  return `/console/?${search.toString()}`;
}
