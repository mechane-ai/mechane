import { NoFields } from '@mechane/protocol';
import { CommandShape } from '../constants.ts';
import type { CommandDeclaration } from '../types.ts';

/** The command that checks a deployment, which needs no key. */
export const DEPLOYMENT_COMMANDS = {
  readiness: {
    summary: 'report the release, the Worker revision and each Durable Object schema revision',
    shape: CommandShape.Document,
    operations: ['readiness'],
    flags: {},
    arguments: [],
    input: NoFields,
  },
} as const satisfies Readonly<Record<string, CommandDeclaration>>;
