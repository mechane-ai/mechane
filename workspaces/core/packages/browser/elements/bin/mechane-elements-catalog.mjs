import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const ignored = new Set(['a', 'an', 'and', 'are', 'build', 'for', 'in', 'of', 'on', 'page', 'the', 'to', 'with']);

/** @import {Catalog} from './catalog.d.mts' */

/**
 * @param {Catalog} catalog The catalog built from the public package.
 * @param {string} query Normalized task or public export name.
 */
function lookup(catalog, query) {
  const version = { package: catalog.package, version: catalog.version };

  if (query.length === 0) {
    return { ...version, recipes: catalog.recipes };
  }

  const words = new Set(query.match(/[a-z0-9]+/g));
  const terms = [...words].filter((word) => !ignored.has(word));
  const matches = catalog.recipes
    .map((recipe) => {
      const title = `${recipe.title} ${recipe.slug}`.toLowerCase();
      const details = `${recipe.description} ${recipe.imports.join(' ')}`.toLowerCase();
      const score = terms.reduce((sum, term) => sum + (title.includes(term) ? 3 : Number(details.includes(term))), 0);

      return { recipe, score };
    })
    .filter(({ score }) => score > 0)
    .toSorted((first, second) => second.score - first.score);

  const exports = Object.entries(catalog.entries).flatMap(([specifier, members]) =>
    Object.entries(members)
      .filter(([name]) => name.toLowerCase().includes(query) || specifier.toLowerCase() === query)
      .map(([name, member]) => ({ name, specifier, ...member })),
  );
  const best = matches[0]?.recipe;

  return {
    ...version,
    recipes: matches.map(({ recipe }) => recipe),
    exports,
    ...(best !== undefined && { example: readFileSync(new URL(`../${best.path}`, import.meta.url), 'utf8') }),
  };
}

/** @param {Catalog} catalog The catalog built from the public package. */
export function runCatalog(catalog) {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { help: { type: 'boolean', short: 'h', default: false } },
  });

  if (values.help) {
    process.stdout.write('Usage: mechane-elements-catalog [task or public export name]\n');
  } else {
    const result = lookup(catalog, positionals.join(' ').trim().toLowerCase());
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }
}
