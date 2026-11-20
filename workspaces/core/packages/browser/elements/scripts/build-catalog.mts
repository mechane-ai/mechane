import assert from 'node:assert/strict';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCsf } from 'storybook/internal/csf-tools';
import type { Catalog } from '../bin/catalog.d.mts';
import manifest from '../package.json' with { type: 'json' };
import { parseSource, publicEntries, readSource } from './catalog-source.mts';

const root = join(import.meta.dirname, '..');

function recipe(file: string, entries: ReturnType<typeof publicEntries>) {
  const path = `recipes/${file}`;
  const { source, parsed } = parseSource(path);
  const slug = file.slice(0, -'.tsx'.length);
  const storySource = readSource(`src/stories/recipes/${slug}.stories.tsx`);
  const csf = loadCsf(storySource, { makeTitle: (title) => title }).parse();
  const component = parsed.program.body.find((node) => {
    if (node.type !== 'ExportNamedDeclaration' || node.declaration?.type !== 'FunctionDeclaration') {
      return false;
    }
    return node.declaration.id?.name === csf.meta.component;
  });
  assert.ok(component !== undefined, `Use the exported recipe component in the Storybook meta for ${path}`);
  const docs = parsed.comments.findLast((comment) => {
    const adjacent = source.slice(comment.end, component.start).trim() === '';
    return comment.end <= component.start && adjacent && comment.value.startsWith('*');
  });
  assert.ok(docs !== undefined, `Describe the task and constraints on the exported recipe in ${path}`);
  const description = docs.value
    .split('\n')
    .map((line) => line.trim().replace(/^\*\s?/, ''))
    .join(' ')
    .trim();
  const imports = parsed.module.staticImports
    .filter((statement) => statement.moduleRequest.value !== 'react')
    .map((statement) => {
      const specifier = statement.moduleRequest.value;
      const members = entries[specifier];
      assert.ok(members !== undefined, `Use a public Elements import in ${path}: ${specifier}`);
      for (const entry of statement.entries) {
        const name = entry.importName.name;
        assert.ok(name !== null && Object.hasOwn(members, name), `Unknown import ${name} in ${path}`);
      }
      return source.slice(statement.start, statement.end);
    });
  const example = csf.stories[0];
  assert.ok(example !== undefined, `Missing Storybook example for ${path}`);
  const title = csf.meta.title?.split('/').at(-1);
  assert.ok(title !== undefined, `Name the Storybook example for ${path}`);
  return { slug, title, description, path, story: example.id, imports };
}

function main(): void {
  const entries = publicEntries();
  for (const members of Object.values(entries)) {
    for (const { declaration } of Object.values(members)) {
      assert.ok(existsSync(join(root, declaration)), `Missing public declaration ${declaration}`);
    }
  }
  const files = readdirSync(join(root, 'recipes'))
    .filter((file) => file.endsWith('.tsx'))
    .toSorted();
  const recipes = files.map((file) => recipe(file, entries));
  const catalog = { package: manifest.name, version: manifest.version, recipes, entries } satisfies Catalog;
  writeFileSync(join(root, 'dist/catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);
  writeFileSync(
    join(root, 'dist/mechane-elements-catalog.mjs'),
    [
      '#!/usr/bin/env node',
      "import catalog from './catalog.json' with { type: 'json' };",
      "import { runCatalog } from '../bin/mechane-elements-catalog.mjs';",
      'runCatalog(catalog);',
      '',
    ].join('\n'),
    { mode: 0o755 },
  );
}

main();
