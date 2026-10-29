import type { Lane } from '@mechane/rule-shapes';
import { Record } from 'effect';
import { posix } from 'node:path';
import { CONTRACTS } from '../contracts.ts';
import type { GeneratedFile } from '../types.ts';
import { STRICT_GLOBALS, STRICT_GLOBALS_FILE } from './constants.ts';

/**
 * Each lane's `strict-globals.d.ts`, which every member of the lane includes: `JSON.parse` and the `json()` of each
 * body the lane declares return `unknown`, so a schema decodes what they read (TD-11).
 */
export function strictGlobals(): ReadonlyArray<GeneratedFile> {
  const laneGlobals: (lane: readonly [Lane, ReadonlyArray<string>]) => GeneratedFile = ([lane, bodies]) => {
    const bodyInterface: (body: string) => ReadonlyArray<string> = (body) => [
      `interface ${body} {`,
      '  json(): Promise<unknown>;',
      '}',
    ];

    const text = [
      '// Generated from @mechane/rules by `mise run fix`; change the registry, never this file.',
      `// The ${lane} lane's untyped boundaries answer \`unknown\`, which a schema then decodes (TD-11).`,
      "// A declaration file without imports declares globals, whose interfaces merge with the runtime's.",
      'interface JSON {',
      '  parse(text: string, reviver?: (this: unknown, key: string, value: unknown) => unknown): unknown;',
      '}',
      ...bodies.flatMap(bodyInterface),
      '',
    ];

    return { path: posix.join(STRICT_GLOBALS, lane, STRICT_GLOBALS_FILE), text: text.join('\n') };
  };

  return Record.toEntries(CONTRACTS['code-typescript-effect-schemas'].values.jsonBodies).map(laneGlobals);
}
