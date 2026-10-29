import { LOOPBACK_HOST } from '../constants.ts';

type LoopbackUrlInput = { readonly port: number };

/** The origin of a server the stack serves on a port of the loopback host. */
export function loopbackUrl({ port }: LoopbackUrlInput): string {
  return `http://${LOOPBACK_HOST}:${port}`;
}
