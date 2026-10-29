import { Schema } from 'effect';
import type { ClosedSet, ClosedSetInput, UnknownMemberSchema } from './types.ts';
import { unknownMember } from './unknown-member.ts';

/** The schema of a closed set's member as a response carries it, known or unknown. */
type MemberOrUnknownSchema<S extends ClosedSet> = Schema.Union<readonly [Schema.Enum<S>, UnknownMemberSchema]>;

/**
 * A member of a closed set as a response carries it: one of the set's, decoded strictly, or one a newer deployment
 * added. That one decodes as its text, typed apart from the set's own members.
 */
export function memberOrUnknown<const S extends ClosedSet>({ set }: ClosedSetInput<S>): MemberOrUnknownSchema<S> {
  return Schema.Union([Schema.Enum(set), unknownMember({ set })]);
}
