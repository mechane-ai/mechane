import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseSync } from 'oxc-parser';
import manifest from '../package.json' with { type: 'json' };

const root = join(import.meta.dirname, '..');

type Declaration = { readonly kind: 'value' | 'type'; readonly declaration: string };

export function readSource(path: string): string {
  return readFileSync(join(root, path), 'utf8');
}

export function parseSource(path: string) {
  const source = readSource(path);
  const parsed = parseSync(path, source);
  assert.deepEqual(parsed.errors, [], `Parse ${path} for the Elements catalog`);
  return { source, parsed };
}

function isTypescriptSource([, path]: readonly [string, string]): boolean {
  return /\.tsx?$/.test(path);
}

export function publicEntries() {
  const entries: Record<string, Record<string, Declaration>> = {};
  const publicModules = Object.entries(manifest.exports).filter(isTypescriptSource);
  for (const [key, source] of publicModules) {
    const specifier = `${manifest.name}${key.slice(1)}`;
    const { parsed } = parseSource(source);
    const members: Record<string, Declaration> = {};
    for (const block of parsed.module.staticExports) {
      for (const entry of block.entries) {
        const name = entry.exportName.name;
        assert.ok(name !== null, `Name the public exports of ${specifier}`);
        const target = entry.moduleRequest?.value;
        const local = target?.startsWith('.') === true ? join(dirname(source), target) : source;
        const declaration = join('dist', local.replace(/\.tsx?$/, '.d.ts'));
        members[name] = { kind: entry.isType ? 'type' : 'value', declaration };
      }
    }
    entries[specifier] = members;
  }
  return entries;
}
