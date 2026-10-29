import { decodeFile } from '@mechane/checks-kernel';
import type { InputUnreadable, Member } from '@mechane/checks-kernel';
import { Effect, Option, Record, Schema } from 'effect';
import { join } from 'node:path';

/** A member's manifest, whose exports name its entry. */
const MANIFEST_FILE = 'package.json';

/** The part of a member's manifest that names its entries. */
const ManifestExports = Schema.Struct({
  /** Each entry by its subpath, relative to the manifest; absent for a member that exports nothing, as a program. */
  exports: Schema.OptionFromOptionalKey(Schema.Record(Schema.String, Schema.String)),
});

type EntryFilesInput = { readonly members: ReadonlyArray<Member> };

type MemberEntriesInput = { readonly member: Member };

/**
 * Every entry a member's manifest exports, the one `index.ts` a library keeps, by the folder of the member that holds
 * it, both relative to the workspace.
 */
export const entryFiles = Effect.fn('entryFiles')(function* ({
  members,
}: EntryFilesInput): Effect.fn.Return<ReadonlyMap<string, string>, InputUnreadable> {
  const entries = yield* Effect.forEach(members, (member) => memberEntries({ member }), { concurrency: 1 });

  return new Map(entries.flat());
});

/** A member's entries, each under its path relative to the workspace, beside the member's folder. */
const memberEntries = Effect.fn('memberEntries')(function* ({
  member,
}: MemberEntriesInput): Effect.fn.Return<ReadonlyArray<readonly [string, string]>, InputUnreadable> {
  const { exports } = yield* decodeFile({ path: join(member.folder, MANIFEST_FILE), schema: ManifestExports });

  if (Option.isNone(exports)) {
    return [];
  }

  /** An entry's path relative to the workspace, beside the member's folder. */
  const entryPair: (entry: string) => readonly [string, string] = (entry) => [
    join(member.folder, entry),
    member.folder,
  ];

  return Record.values(exports.value).map(entryPair);
});
