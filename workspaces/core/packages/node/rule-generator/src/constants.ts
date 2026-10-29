import { fileURLToPath } from 'node:url';

/** The registry's source, relative to the workspace, where a finding of a rule's entry points. */
export const REGISTRY = 'packages/node/rules/src';

/**
 * What the program does: write every generated file, or report each one that differs from what it would write. Or it
 * answers a question: `explain` prints a rule's entry and examples, and `for` the rules of a path.
 */
export const GenerateCommand = { Write: 'write', Check: 'check', Explain: 'explain', For: 'for' } as const;

export type GenerateCommand = (typeof GenerateCommand)[keyof typeof GenerateCommand];

/**
 * How the generator ends: every file current and the registry sound, a file that differs or a finding of the registry,
 * or an input it could not use.
 */
export const GenerateStatus = { Current: 0, Findings: 1, Failed: 2 } as const;

export type GenerateStatus = (typeof GenerateStatus)[keyof typeof GenerateStatus];

/** The steps of the generator that can fail on a file: reading an input, formatting its output, or writing it. */
export const GenerateStep = { Read: 'read', Format: 'format', Write: 'write' } as const;

export type GenerateStep = (typeof GenerateStep)[keyof typeof GenerateStep];

/** The product workspace, which every generated path is relative to. */
export const WORKSPACE_FOLDER = fileURLToPath(new URL('../../../../', import.meta.url));
