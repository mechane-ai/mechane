import { TENSORLAKE_ORIGIN } from '../constants.ts';

type SandboxUrlInput = { readonly name: string };

/** Addresses a sandbox by its saved provider id, or its stable name before the first creation. */
export function sandboxUrl({ name }: SandboxUrlInput): URL {
  const path = sandboxPath({ name });

  return new URL(path, TENSORLAKE_ORIGIN);
}

function sandboxPath({ name }: SandboxUrlInput): string {
  const encoded = encodeURIComponent(name);

  return `/sandboxes/${encoded}`;
}
