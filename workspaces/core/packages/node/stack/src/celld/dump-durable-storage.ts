import { createHash } from 'node:crypto';
import type { Dirent } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { holdSqliteReaders } from '../fixtures/store/sqlite-readers.ts';

type DumpStorageInput = { readonly directories: ReadonlyArray<string>; readonly signal?: AbortSignal };
type DirectoryInput = { readonly directory: string; readonly signal: AbortSignal | undefined };
type PersistedFilesInput = { readonly directory: string; readonly signal?: AbortSignal };

type SelectedFilesInput = {
  readonly directory: string;
  readonly projectDirectory: string;
  readonly files: ReadonlyArray<Dirent>;
  readonly signal: AbortSignal | undefined;
  readonly names?: ReadonlySet<string>;
};

type NativeDatabaseInput = { readonly directory: string; readonly file: Dirent };
type StoredFile = { readonly source: string; readonly bytes: Buffer };
const SQLITE_FILES: ReadonlySet<string> = new Set(['db.sqlite', 'db.sqlite-wal']);
const FILE_CAPTURE_PREFIX = 'MECHANE_DURABLE_STORAGE_FILE_V1 ';

const CELLD_OBJECTS_FILES: ReadonlySet<string> = new Set([
  '.celld/dev/objects.sqlite3',
  '.celld/dev/objects.sqlite3-wal',
  '.celld/dev/objects.sqlite3-shm',
]);

const CELLD_RUNTIME_SQLITE = /^\.celld\/dev\/runtime\/[^/]+\/ltx\/e\d+\/db\.sqlite(?:-(?:wal|shm))?$/;

// Read locks keep WAL files alive; separate file reads do not form one storage-wide snapshot.
export async function* persistedFiles({ directory, signal }: PersistedFilesInput): AsyncGenerator<Buffer> {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });

  for await (const file of readSelectedFiles({ directory, projectDirectory: directory, files: entries, signal })) {
    yield file.bytes;
  }
}

export async function dumpDurableStorage({ directories, signal }: DumpStorageInput): Promise<string> {
  const contents: Array<string> = [];

  for (const directory of directories) {
    const stored = await dumpDirectory({ directory, signal });

    contents.push(stored);
  }

  return contents.join('\n');
}

async function dumpDirectory({ directory, signal }: DirectoryInput): Promise<string> {
  const root = join(directory, '.celld', 'dev', 'runtime');

  const files = await readdir(root, { recursive: true, withFileTypes: true }).catch((error: unknown) => {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return [];
    }

    throw error;
  });

  const contents: Array<string> = [];

  if (files.length === 0) {
    return '';
  }

  for await (const { source, bytes } of readSelectedFiles({
    directory: root,
    projectDirectory: directory,
    files,
    signal,
    names: SQLITE_FILES,
  })) {
    const capture = {
      kind: 'live-sqlite-file',
      source,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      base64: bytes.toString('base64'),
    };

    contents.push(bytes.toString('utf8'), `${FILE_CAPTURE_PREFIX}${JSON.stringify(capture)}`);
  }

  return contents.join('\n');
}

async function* readSelectedFiles({
  directory,
  projectDirectory,
  files,
  signal,
  names,
}: SelectedFilesInput): AsyncGenerator<StoredFile> {
  const paths = files.map((file) => nativeDatabasePath({ directory: projectDirectory, file }));
  const databases = new Set(paths.filter((path) => path !== null));
  const readers = holdSqliteReaders({ paths: [...databases] });

  try {
    const current = await readdir(directory, { recursive: true, withFileTypes: true });

    const selected = current.filter((file) => {
      const isSharedMemory = isNativeSharedMemory({ directory: projectDirectory, file });

      if (!file.isFile() || isSharedMemory) {
        return false;
      }

      return names === undefined || names.has(file.name);
    });

    for (const file of selected) {
      const source = join(file.parentPath, file.name);
      const bytes = await readFile(source, { signal });

      yield { source, bytes };
    }
  } finally {
    readers.close();
  }
}

function nativeDatabasePath({ directory, file }: NativeDatabaseInput): string | null {
  const path = relative(directory, join(file.parentPath, file.name)).split(sep).join('/');

  if (!CELLD_OBJECTS_FILES.has(path) && !CELLD_RUNTIME_SQLITE.test(path)) {
    return null;
  }

  return join(directory, path.replace(/-(?:wal|shm)$/, ''));
}

function isNativeSharedMemory(input: NativeDatabaseInput): boolean {
  if (!input.file.name.endsWith('-shm')) {
    return false;
  }

  return nativeDatabasePath(input) !== null;
}
