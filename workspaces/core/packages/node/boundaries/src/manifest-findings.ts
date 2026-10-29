import type { Finding, Member } from '@mechane/checks-kernel';
import type { MemberManifest } from '@mechane/rule-shapes';
import { Option, Record } from 'effect';
import { MEMBER_MANIFEST } from './constants.ts';

/** A manifest's entry, by the member's name. */
type NamedEntry = readonly [name: string, entry: MemberManifest[string]];

/** A member the manifest names among another's consumers, and that member. */
type NamedConsumer = { readonly name: string; readonly consumer: string };

type ManifestsInput = { readonly manifest: MemberManifest; readonly members: ReadonlyArray<Member> };

/**
 * Checks that the manifest declares every member and only members, and that each member's `consumers` names members
 * alone.
 */
export function manifestFindings({ manifest, members }: ManifestsInput): ReadonlyArray<Finding> {
  const names: ReadonlySet<string> = new Set(members.map(({ name }) => name));
  const isUndeclared: (member: Member) => boolean = (member) => !Record.has(manifest, member.name);
  const isMissing: (name: string) => boolean = (name) => !names.has(name);

  /** Each consumer of one entry that names no member. */
  const unknownConsumers: (entry: NamedEntry) => ReadonlyArray<NamedConsumer> = ([name, { consumers }]) =>
    Option.getOrElse(consumers, () => [])
      .filter(isMissing)
      .map((consumer) => ({ name, consumer }));

  const undeclaredMessage: (member: Member) => string = (member) =>
    `Declare ${member.name} with what it owns, its layer and lane, its dialect, kind and criterion, such as \`"${member.name}": { "owns": "…", "layer": 3, "lane": "node", … }\``;

  const missingMessage: (name: string) => string = (name) =>
    `Give ${name} a manifest in the workspace or remove its entry, such as \`"name": "${name}"\` in its package.json`;

  const unknownConsumerMessage: (consumer: NamedConsumer) => string = ({ name, consumer }) =>
    `Name only members in the consumers of ${name}, such as \`"consumers": ["@mechane/app"]\`, since ${consumer} is no member`;

  const messages = [
    ...members.filter(isUndeclared).map(undeclaredMessage),
    ...Record.keys(manifest).filter(isMissing).map(missingMessage),
    ...Record.toEntries(manifest).flatMap(unknownConsumers).map(unknownConsumerMessage),
  ];

  return messages.map((message) => ({ check: 'packages', location: MEMBER_MANIFEST, message }));
}
