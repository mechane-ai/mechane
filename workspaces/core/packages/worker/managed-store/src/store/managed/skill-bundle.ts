import { ManagedStoreError } from '@mechane/authority-store';
import { HttpStatusCode } from '@mechane/records';
import { zipSync } from 'fflate';
import { parseDocument } from 'yaml';

export type SkillFile = { readonly path: string; readonly bytes: Uint8Array };
type SkillBundle = { readonly name: string; readonly description: string; readonly archive: Uint8Array };

const SKILL_UPLOAD_MAX_BYTES = 31_457_280;
const DESCRIPTION_MAX_CHARS = 1024;
const NAME_MAX_CHARS = 64;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const FORBIDDEN_PATH = /[\\:\p{Cc}]/u;
const FORBIDDEN_SEGMENTS: ReadonlySet<string> = new Set(['', '.', '..']);

function readManifest(file: SkillFile): Pick<SkillBundle, 'name' | 'description'> {
  const text = new TextDecoder().decode(file.bytes);
  const header = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/u.exec(text);

  if (header?.[1] === undefined) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'SKILL.md requires YAML frontmatter');
  }

  const document = parseDocument(header[1], { schema: 'core' });
  const name = document.get('name');
  const description = document.get('description');

  if (document.errors.length > 0 || typeof name !== 'string' || typeof description !== 'string') {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'SKILL.md requires a name and description');
  }

  if (!SLUG.test(name) || name.length > NAME_MAX_CHARS || /anthropic|claude/u.test(name)) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'SKILL.md contains an invalid skill name');
  }

  if (description.trim().length === 0 || description.length > DESCRIPTION_MAX_CHARS || /<[^>]+>/u.test(description)) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'SKILL.md contains an invalid description');
  }

  return { name, description };
}

function splitPath(path: string): ReadonlyArray<string> {
  const parts = path.split('/');

  if (FORBIDDEN_PATH.test(path) || parts.some((part) => FORBIDDEN_SEGMENTS.has(part))) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Unsafe file path in skill upload');
  }

  return parts;
}

export function prepareSkillBundle(files: ReadonlyArray<SkillFile>): SkillBundle {
  const manifests = files.filter((file) => {
    const parts = splitPath(file.path);
    const [, fileName, nested] = parts;

    return fileName === 'SKILL.md' && nested === undefined;
  });

  const manifest = manifests[0];

  if (manifest === undefined || manifests.length !== 1) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'SKILL.md not found in uploaded files');
  }

  const prefix = manifest.path.slice(0, -'SKILL.md'.length);
  const { name, description } = readManifest(manifest);
  const entries: Record<string, Uint8Array> = {};
  const paths = new Set<string>();
  let totalBytes = 0;

  for (const file of files) {
    totalBytes += file.bytes.byteLength;

    if (totalBytes >= SKILL_UPLOAD_MAX_BYTES) {
      throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Total skill file size must be under 30 MB');
    }

    if (!file.path.startsWith(prefix) || paths.has(file.path)) {
      throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Skill files need unique paths under one folder');
    }

    paths.add(file.path);

    const relativePath = file.path.slice(prefix.length);
    entries[`${name}/${relativePath}`] = file.bytes;
  }

  const directoryKeys = [...paths].map((path) => [path, ''].join('/')).toSorted();

  for (const [index, directoryKey] of directoryKeys.entries()) {
    if (directoryKeys[index + 1]?.startsWith(directoryKey) === true) {
      throw new ManagedStoreError(HttpStatusCode.BadRequest, 'A skill file blocks a directory in the upload');
    }
  }

  // Store uploads without compression to keep archive creation bounded on the Worker.
  const archive = zipSync(entries, { level: 0 });

  return { name, description, archive };
}
