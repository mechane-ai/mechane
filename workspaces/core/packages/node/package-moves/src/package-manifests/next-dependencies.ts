import { Array, Effect, Option, Order, Record } from 'effect';
import { MEMBER_SCOPE } from '../constants.ts';
import { MoveRefused } from '../errors.ts';
import type { PlacedMember } from '../packages.types.ts';

/** The range a member's manifest gives a dependency on another member. */
const WORKSPACE_RANGE = 'workspace:*';

/** Dependencies in the order of their names, as a formatted manifest lists them. */
const BY_NAME = Order.mapInput(Order.String, ([name]: readonly [string, string]) => name);

/**
 * A member, and the dependencies and development dependencies its manifest declares. Then the packages its files import
 * after the step, whether it lost files to another member, and the version each manifest of the workspace pins.
 */
type NextDependenciesInput = {
  readonly member: PlacedMember;
  readonly declared: Readonly<Record<string, string>>;
  readonly developed: Readonly<Record<string, string>>;
  readonly imported: ReadonlySet<string>;
  readonly isPruned: boolean;
  readonly versions: ReadonlyMap<string, string>;
};

/** A member, a package it newly imports, and the version each manifest of the workspace pins. */
type PinnedRangeInput = {
  readonly member: PlacedMember;
  readonly name: string;
  readonly versions: ReadonlyMap<string, string>;
};

/** A member's dependencies and development dependencies after the step, by package name. */
type DependencyLists = {
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
};

/**
 * A member's dependencies after the step: each it declares, but another member no file imports, and any package no file
 * imports once it lost files. Each package it newly imports joins at the version the workspace pins. Its development
 * dependencies keep each package but another member no file imports, as the root's tool pins stay.
 */
export const nextDependencies = Effect.fn('nextDependencies')(function* ({
  member,
  declared,
  developed,
  imported,
  isPruned,
  versions,
}: NextDependenciesInput): Effect.fn.Return<DependencyLists, MoveRefused> {
  /** Whether the member keeps the dependency: its files import it, or it names no member and no file left. */
  const isKept: (dependency: readonly [string, string]) => boolean = ([name]) =>
    imported.has(name) || (!isPruned && !name.startsWith(MEMBER_SCOPE));

  const kept = Record.toEntries(declared).filter(isKept);

  /** Whether the package is another one the member's files import that its manifest does not declare. */
  const isUndeclared: (name: string) => boolean = (name) =>
    name !== member.name && !Record.has({ ...declared, ...developed }, name);

  const newly = [...imported].filter(isUndeclared);
  const added = yield* Effect.forEach(newly, (name) => pinnedRange({ member, name, versions }), { concurrency: 1 });

  /** Whether the member keeps the development dependency: its files import it, or it names no member. */
  const isKeptTool: (range: string, name: string) => boolean = (_range, name) =>
    imported.has(name) || !name.startsWith(MEMBER_SCOPE);

  return {
    dependencies: Record.fromEntries(Array.sort([...kept, ...added], BY_NAME)),
    devDependencies: Record.filter(developed, isKeptTool),
  };
});

/** The range a newly imported package takes: `workspace:*` for a member, else the version a manifest pins. */
const pinnedRange = Effect.fn('pinnedRange')(function* ({
  member,
  name,
  versions,
}: PinnedRangeInput): Effect.fn.Return<readonly [string, string], MoveRefused> {
  if (name.startsWith(MEMBER_SCOPE)) {
    return [name, WORKSPACE_RANGE] as const;
  }

  const version = Option.fromNullishOr(versions.get(name));

  if (Option.isNone(version)) {
    return yield* new MoveRefused({ path: member.folder, reason: `no manifest of the workspace pins ${name}` });
  }

  return [name, version.value] as const;
});
