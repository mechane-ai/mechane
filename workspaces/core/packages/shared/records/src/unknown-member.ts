import { Record, Schema } from 'effect';
import { PrintableName } from './schemas.ts';
import type { ClosedSetInput, UnknownMemberSchema } from './types.ts';

/**
 * Text that names no member of a closed set: a member a newer deployment added, which this release does not know and
 * prints as written, so it must be printable. Its brand types it apart from the set's own members, so a reader names
 * each of those and then the rest.
 */
export function unknownMember({ set }: ClosedSetInput): UnknownMemberSchema {
  const members: ReadonlySet<string> = new Set(Record.values(set));

  return PrintableName.check(
    Schema.makeFilter((text) => !members.has(text), { expected: 'a member this release does not know' }),
  ).pipe(Schema.brand('UnknownMember'));
}
