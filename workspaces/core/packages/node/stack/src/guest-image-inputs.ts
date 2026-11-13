import { SHA256_PATTERN } from '@mechane/records';
import { Schema } from 'effect';
import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { join, posix, relative, sep } from 'node:path';

const MODE_MODULUS = 0o1_0000;

export const GuestImageInputs = Schema.Struct({
  format_version: Schema.Literal(1),
  platform: Schema.String,
  files: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      kind: Schema.Literals(['file', 'directory']),
      mode: Schema.Int,
      bytes: Schema.Int,
      sha256: Schema.String.check(Schema.isPattern(SHA256_PATTERN)),
    }),
  ),
  sha256: Schema.String.check(Schema.isPattern(SHA256_PATTERN)),
});

export type GuestImageInputs = typeof GuestImageInputs.Type;
type GuestImageInputsInput = { readonly directory: string; readonly platform: string };

export async function guestImageInputs({ directory, platform }: GuestImageInputsInput): Promise<GuestImageInputs> {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });

  const observed = await Promise.all(
    entries.map(async (entry) => {
      const file = join(entry.parentPath, entry.name);
      const name = relative(directory, file).split(sep).join(posix.sep);
      const status = await lstat(file);
      const mode = status.mode % MODE_MODULUS;

      if (status.isDirectory()) {
        const sha256 = createHash('sha256').update('').digest('hex');

        return { name, kind: 'directory' as const, mode, bytes: 0, sha256 };
      }

      if (!status.isFile()) {
        throw new Error('Guest image input is not a regular file or directory');
      }

      const bytes = await readFile(file);
      const sha256 = createHash('sha256').update(bytes).digest('hex');

      return { name, kind: 'file' as const, mode, bytes: bytes.length, sha256 };
    }),
  );

  const files = observed.toSorted((left, right) => left.name.localeCompare(right.name, 'en'));
  const contents = JSON.stringify({ format_version: 1, platform, files });
  const sha256 = createHash('sha256').update(contents).digest('hex');

  return { format_version: 1, platform, files, sha256 };
}
