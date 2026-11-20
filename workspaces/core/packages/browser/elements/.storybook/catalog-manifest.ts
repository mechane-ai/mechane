import { basename, join } from 'node:path';
import { parseSync } from 'oxc-parser';
import type { StaticImportEntry } from 'oxc-parser';
import type { Manifests } from 'storybook/internal/types';
import manifest from '../package.json' with { type: 'json' };
import { publicEntries, readSource } from '../scripts/catalog-source.mts';

type Entries = ReturnType<typeof publicEntries>;

function publicBinding(item: StaticImportEntry, requested: string, entries: Entries) {
  const name = item.importName.name;

  if (name === null) {
    return null;
  }

  const original = entries[requested] ?? {};

  const specifier = Object.hasOwn(original, name)
    ? requested
    : Object.keys(entries).find((key) => Object.hasOwn(entries[key] ?? {}, name));

  if (specifier === undefined) {
    return null;
  }

  const local = item.localName.value;
  const binding = local === name ? name : `${name} as ${local}`;

  return { specifier, binding: item.isType ? `type ${binding}` : binding };
}

function publishedImports(code: string, entries: Entries): string {
  const statements = parseSync('imports.ts', code).module.staticImports;

  const external = statements
    .filter((statement) => !Object.hasOwn(entries, statement.moduleRequest.value))
    .map((statement) => code.slice(statement.start, statement.end));

  const elements = statements
    .filter((statement) => Object.hasOwn(entries, statement.moduleRequest.value))
    .flatMap((statement) =>
      statement.entries.map((item) => publicBinding(item, statement.moduleRequest.value, entries)),
    )
    .filter((item) => item !== null);

  const specifiers = new Set(elements.map((item) => item.specifier));

  const corrected = Array.from(specifiers, (specifier) => {
    const bindings = elements.filter((item) => item.specifier === specifier).map((item) => item.binding);

    return `import { ${bindings.join(', ')} } from '${specifier}';`;
  });

  return [...external, ...corrected].join('\n');
}

/** Storybook infers package-root imports even for subpath components and local recipe examples. */
export function catalogManifests(manifests: Manifests): Manifests {
  const source = manifests.components;

  if (source === undefined) {
    return manifests;
  }

  const entries = publicEntries();

  const components = Object.fromEntries(
    Object.entries(source.components).map(([id, component]) => {
      if (component.path.startsWith('./src/stories/recipes/')) {
        const slug = basename(component.path, '.stories.tsx');
        const recipe = readSource(join('recipes', `${slug}.tsx`));

        const stories = component.stories.map((story) => ({
          ...story,
          snippet: story.name === 'Example' || story.snippet === undefined ? recipe : `${recipe}\n\n${story.snippet}`,
        }));

        return [id, { ...component, import: '', stories }];
      }

      if (component.import?.includes(manifest.name) === true) {
        return [id, { ...component, import: publishedImports(component.import, entries) }];
      }

      return [id, component];
    }),
  );

  return { ...manifests, components: { ...source, components } };
}
