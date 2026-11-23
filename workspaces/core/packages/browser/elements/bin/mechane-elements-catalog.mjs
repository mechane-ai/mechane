import { cpSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ignored = new Set(['a', 'an', 'and', 'are', 'build', 'for', 'in', 'of', 'on', 'page', 'the', 'to', 'with']);

/** The skills for an application that uses Elements. The package also ships a skill for changing the library. */
const appSkills = ['use-elements', 'review-elements', 'upgrade-elements'];

/** @import {Catalog} from './catalog.d.mts' */

/**
 * Replaces each application skill in the directory with the copy from the installed package.
 *
 * @param {Catalog} catalog The catalog built from the public package.
 * @param {string} directory The agent's skills directory, such as `.claude/skills`.
 */
function installSkills(catalog, directory) {
  const installed = appSkills.map((name) => {
    const target = resolve(directory, name);

    rmSync(target, { recursive: true, force: true });
    cpSync(fileURLToPath(new URL(`../skills/${name}`, import.meta.url)), target, { recursive: true });

    return join(directory, name);
  });

  return { package: catalog.package, version: catalog.version, installed };
}

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

const usage = [
  'Usage: mechane-elements-catalog [task or public export name]',
  '       mechane-elements-catalog --install-skills <directory>',
  '',
  'With a task, prints the matching recipes, public exports and the best example as JSON.',
  'With --install-skills, copies the Elements skills into an agent skills directory such as .claude/skills.',
].join('\n');

/** @param {Catalog} catalog The catalog built from the public package. */
export function runCatalog(catalog) {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { 'help': { type: 'boolean', short: 'h', default: false }, 'install-skills': { type: 'string' } },
  });

  const directory = values['install-skills'];

  if (values.help) {
    process.stdout.write(`${usage}\n`);
  } else {
    const result =
      directory === undefined
        ? lookup(catalog, positionals.join(' ').trim().toLowerCase())
        : installSkills(catalog, directory);

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }
}
