import { join } from 'node:path';

/** A numeric directory entry already selected from the proc filesystem. */
type ContainerProcessPathInput = { readonly directory: string };

/** Builds the Linux proc status path for one numeric process identifier. */
export function containerProcessPath({ directory }: ContainerProcessPathInput): string {
  return join('/proc', directory, 'status');
}
