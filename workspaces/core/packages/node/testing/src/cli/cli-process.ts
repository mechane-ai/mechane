import { ORIGIN_VARIABLE } from '@mechane/deployment';
import type { StartProcessInput } from '@mechane/program';
import { Duration } from 'effect';
import type { BinaryCommandInput } from './types.ts';

/** How long one CLI run may take; it outlasts the CLI's own request timeout, so the CLI reports a hung Worker. */
const CLI_TIMEOUT = Duration.minutes(1);

/** The CLI process of a command: its binary and arguments, the stack's variables with its own, and the CLI timeout. */
export function cliProcess({ stack, binary, args, environment }: BinaryCommandInput): StartProcessInput {
  return {
    command: binary,
    args,
    environment: { ...stack.settings.inherited, [ORIGIN_VARIABLE]: stack.origin.origin, ...environment },
    timeout: CLI_TIMEOUT,
  };
}
