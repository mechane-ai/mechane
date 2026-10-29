import type { RequestInput } from './types.ts';
import { writeMessage } from './write-message.ts';

/** Sends one notification, which the server answers with nothing. */
export function notify({ server, method, params }: RequestInput): void {
  writeMessage({ child: server.child, message: { jsonrpc: '2.0', method, params } });
}
