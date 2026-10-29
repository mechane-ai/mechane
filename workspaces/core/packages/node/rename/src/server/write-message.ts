import type { ServerChild } from '../types.ts';
import { HEADER_END, LENGTH_HEADER } from './constants.ts';

type WriteInput = { readonly child: ServerChild; readonly message: unknown };

/** Writes one JSON-RPC message, framed by its length in bytes. */
export function writeMessage({ child, message }: WriteInput): void {
  const body = JSON.stringify(message);

  child.stdin.write(`${LENGTH_HEADER} ${Buffer.byteLength(body)}${HEADER_END}${body}`);
}
