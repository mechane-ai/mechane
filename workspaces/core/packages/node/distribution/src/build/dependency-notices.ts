import { Schema } from 'effect';
import type { Dirent } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const PACKAGE_SEGMENT = '/node_modules/';
const NOTICE_FILENAME = /^(?:licen[cs]e|copying|notice)(?:[._-].*)?$/i;
const THIRD_PARTY_NOTICE_FILENAME = /^third[_-]?party[_-](?:notices?|licen[cs]es?)(?:[._-].*)?$/i;
const SUPPLEMENTS: Readonly<URL> = new URL('../../../../../licenses/native/', import.meta.url);

const PackageMetadata = Schema.Struct({
  name: Schema.NonEmptyString,
  version: Schema.NonEmptyString,
  license: Schema.optionalKey(Schema.Unknown),
});

const SupplementFiles = Schema.Record(
  Schema.String,
  Schema.String.check(Schema.isPattern(/^[a-z0-9][a-z0-9.-]+\.txt$/)),
);

type DependencyFolderInput = { readonly source: string; readonly workingDirectory: string };

function dependencyFolder({ source, workingDirectory }: DependencyFolderInput): string | undefined {
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

type PackageNoticesInput = { readonly folder: string; readonly supplements: Readonly<Record<string, string>> };
type PackageNotices = { readonly identity: string; readonly text: string };
type NoticeFiles = { readonly primary: ReadonlyArray<string>; readonly thirdParty: ReadonlyArray<string> };
type NoticeFilesInput = { readonly folder: string };
type ThirdPartyNoticeInput = NoticeFilesInput & { readonly entry: Dirent };

async function thirdPartyNoticeFiles({ folder, entry }: ThirdPartyNoticeInput): Promise<ReadonlyArray<string>> {
  if (entry.isFile()) {
    return [entry.name];
  }

  if (!entry.isDirectory()) {
    throw new Error(`Dependency notice is not a regular file or directory: ${entry.name}`);
  }

  const directory = join(folder, entry.name);
  const children = await readdir(directory, { recursive: true, withFileTypes: true });
  const files: Array<string> = [];

  for (const child of children) {
    if (!child.isFile() && !child.isDirectory()) {
      throw new Error(`Dependency notice contains a non-regular entry: ${entry.name}/${child.name}`);
    }

    if (child.isFile()) {
      const path = join(child.parentPath, child.name);

      files.push(relative(folder, path));
    }
  }

  return files;
}

async function packageNoticeFiles({ folder }: NoticeFilesInput): Promise<NoticeFiles> {
  const entries = await readdir(folder, { withFileTypes: true });

  const primary = entries
    .filter((entry) => entry.isFile() && NOTICE_FILENAME.test(entry.name))
    .map((entry) => entry.name);

  const thirdParty: Array<string> = [];

  for (const entry of entries.filter((candidate) => THIRD_PARTY_NOTICE_FILENAME.test(candidate.name))) {
    const files = await thirdPartyNoticeFiles({ folder, entry });

    thirdParty.push(...files);
  }

  return { primary, thirdParty };
}

async function packageNotices({ folder, supplements }: PackageNoticesInput): Promise<PackageNotices> {
  const metadata = Schema.decodeUnknownSync(PackageMetadata)(
    JSON.parse(await readFile(join(folder, 'package.json'), 'utf8')),
  );

  const identity = `${metadata.name}@${metadata.version}`;
  const files = await packageNoticeFiles({ folder });
  const filenames = [...files.primary, ...files.thirdParty].toSorted();
  const notices: Array<string> = [];

  if (files.primary.length === 0) {
    const supplement = supplements[identity];

    if (supplement === undefined) {
      const readme = await readFile(join(folder, 'README.md'), 'utf8').catch(() => '');

      const hasMitPermission =
        readme.includes('Permission is hereby granted') && readme.includes('THE SOFTWARE IS PROVIDED');

      const hasMitNotice = metadata.license === 'MIT' && readme.includes('Copyright') && hasMitPermission;

      if (!hasMitNotice) {
        throw new Error(`Bundled dependency ${identity} has no packaged or reviewed license notice`);
      }

      notices.push(`## README.md\n\n${readme.trimEnd()}`);
    } else {
      const text = await readFile(new URL(supplement, SUPPLEMENTS), 'utf8');

      if (text.trim() === '') {
        throw new Error(`Bundled dependency ${identity} has an empty reviewed license notice`);
      }

      notices.push(text.trimEnd());
    }
  }

  for (const filename of filenames) {
    const contents = await readFile(join(folder, filename), 'utf8');

    if (contents.trim() === '') {
      throw new Error(`Bundled dependency ${identity} has an empty ${filename}`);
    }

    notices.push(`## ${filename}\n\n${contents.trimEnd()}`);
  }

  return { identity, text: `# ${identity}\n\n${notices.join('\n\n')}` };
}

type DependencyNoticesInput = {
  readonly inputs: ReadonlyArray<string>;
  readonly workingDirectory: string;
  readonly outputPath: string;
};

export async function writeDependencyNotices({
  inputs,
  workingDirectory,
  outputPath,
}: DependencyNoticesInput): Promise<void> {
  const supplements = Schema.decodeUnknownSync(SupplementFiles)(
    JSON.parse(await readFile(new URL('supplements.json', SUPPLEMENTS), 'utf8')),
  );

  const folders = new Set<string>();

  for (const source of inputs) {
    const folder = dependencyFolder({ source, workingDirectory });

    if (folder !== undefined) {
      folders.add(folder);
    }
  }

  const packages = new Map<string, string>();

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
