import { Schema } from 'effect';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const PACKAGE_SEGMENT = '/node_modules/';
const NOTICE_FILENAME = /^(?:licen[cs]e|copying|notice)(?:[._-].*)?$/i;
const SUPPLEMENTS = new URL('../../../../licenses/native/', import.meta.url);
const PackageMetadata = Schema.Struct({
  name: Schema.NonEmptyString,
  version: Schema.NonEmptyString,
  license: Schema.optionalKey(Schema.Unknown),
});
const SupplementFiles = Schema.Record(
  Schema.String,
  Schema.String.check(Schema.isPattern(/^[a-z0-9][a-z0-9.-]+\.txt$/)),
);

/** @param {{ source: string; workingDirectory: string }} input Compiler input and its resolution root. */
function dependencyFolder({ source, workingDirectory }) {
  const absolute = resolve(workingDirectory, source);
  const position = absolute.lastIndexOf(PACKAGE_SEGMENT);

  if (position === -1) {
    return;
  }

  const start = position + PACKAGE_SEGMENT.length;
  const [name, scopedName] = absolute.slice(start).split('/');

  if (name === undefined || name === '') {
    throw new Error(`Dependency input has no package name: ${source}`);
  }

  const names = [name];

  if (name.startsWith('@')) {
    if (scopedName === undefined || scopedName === '') {
      throw new Error(`Dependency input has no scoped package name: ${source}`);
    }

    names.push(scopedName);
  }

  return join(absolute.slice(0, start), ...names);
}

/**
 * @param {{ folder: string; supplements: Readonly<Record<string, string>> }} input Package root and reviewed notice
 *   files.
 */
async function packageNotices({ folder, supplements }) {
  const metadata = Schema.decodeUnknownSync(PackageMetadata)(
    JSON.parse(await readFile(join(folder, 'package.json'), 'utf8')),
  );
  const identity = `${metadata.name}@${metadata.version}`;
  const entries = await readdir(folder, { withFileTypes: true });
  const filenames = entries
    .filter((entry) => entry.isFile() && NOTICE_FILENAME.test(entry.name))
    .map((entry) => entry.name)
    .toSorted();

  if (filenames.length === 0) {
    const supplement = supplements[identity];

    if (supplement !== undefined) {
      const text = await readFile(new URL(supplement, SUPPLEMENTS), 'utf8');

      return { identity, text: `# ${identity}\n\n${text.trimEnd()}` };
    }

    const readme = await readFile(join(folder, 'README.md'), 'utf8').catch(() => '');
    const hasMitPermission =
      readme.includes('Permission is hereby granted') && readme.includes('THE SOFTWARE IS PROVIDED');
    const hasMitNotice = metadata.license === 'MIT' && readme.includes('Copyright') && hasMitPermission;

    if (!hasMitNotice) {
      throw new Error(`Bundled dependency ${identity} has no packaged or reviewed license notice`);
    }

    return { identity, text: `# ${identity}\n\n## README.md\n\n${readme.trimEnd()}` };
  }

  const notices = [];

  for (const filename of filenames) {
    const contents = await readFile(join(folder, filename), 'utf8');

    if (contents.trim() === '') {
      throw new Error(`Bundled dependency ${identity} has an empty ${filename}`);
    }

    notices.push(`## ${filename}\n\n${contents.trimEnd()}`);
  }

  return { identity, text: `# ${identity}\n\n${notices.join('\n\n')}` };
}

/**
 * @param {{ inputs: ReadonlyArray<string>; workingDirectory: string; outputPath: string }} input Bundled sources and
 *   their notice output.
 */
export async function writeDependencyNotices({ inputs, workingDirectory, outputPath }) {
  const supplements = Schema.decodeUnknownSync(SupplementFiles)(
    JSON.parse(await readFile(new URL('supplements.json', SUPPLEMENTS), 'utf8')),
  );
  /** @type {Set<string>} */
  const folders = new Set();

  for (const source of inputs) {
    const folder = dependencyFolder({ source, workingDirectory });

    if (folder !== undefined) {
      folders.add(folder);
    }
  }

  /** @type {Map<string, string>} */
  const packages = new Map();

  for (const folder of folders) {
    const notice = await packageNotices({ folder, supplements });
    const previous = packages.get(notice.identity);

    if (previous !== undefined && previous !== notice.text) {
      throw new Error(`Bundled dependency ${notice.identity} has conflicting license notices`);
    }

    packages.set(notice.identity, notice.text);
  }

  const notices = [...packages.values()].toSorted();

  await writeFile(outputPath, `${notices.join('\n\n---\n\n')}\n`);
}
