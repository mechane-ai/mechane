import { Schema } from 'effect';
import { Criterion, Dialect, Lane, Layer, PackageKind } from './manifest.constants.ts';

/**
 * One member as `dependencies.json` declares it: what it owns, its layer and lane, its dialect and the template its
 * package follows, and the boundary that admits it. Its edges are its `package.json`'s.
 */
const MemberEntry = Schema.Struct({
  owns: Schema.NonEmptyString,
  layer: Schema.Enum(Layer),
  lane: Schema.Enum(Lane),
  dialect: Schema.Enum(Dialect),
  kind: Schema.Enum(PackageKind),
  criterion: Schema.Enum(Criterion),
  /** The only members that may import it; absent when any member that its layer and lane allow may. */
  consumers: Schema.OptionFromOptionalKey(Schema.Array(Schema.String)),
  /** The third-party packages that only it and the other members naming them may import; absent for none. */
  confines: Schema.OptionFromOptionalKey(Schema.Array(Schema.String)),
});

/** One member as `dependencies.json` declares it. */
export type MemberEntry = typeof MemberEntry.Type;

/** The member manifest, `dependencies.json`: every workspace member by its package name. */
export const MemberManifest = Schema.Record(Schema.String, MemberEntry);

export type MemberManifest = typeof MemberManifest.Type;

/**
 * The part of `.tenet.lock` the registry reads: each installed contract by its file's path from the factory's root,
 * with the asset files it ships.
 */
export const ContractLock = Schema.Struct({
  contracts: Schema.Record(
    Schema.String,
    Schema.Struct({
      /** Each asset file's hash, by its path from the contract's folder; absent when the contract ships none. */
      files: Schema.OptionFromOptionalKey(Schema.Record(Schema.String, Schema.String)),
    }),
  ),
});

export type ContractLock = typeof ContractLock.Type;
