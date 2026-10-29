/**
 * The runtimes a member's program targets, whose globals differ: the shared lane's code, which also loads in a browser,
 * under the DOM's types; the Worker's, under Cloudflare's; and Node's.
 */
export const Lane = { Shared: 'shared', Worker: 'worker', Node: 'node' } as const;

export type Lane = (typeof Lane)[keyof typeof Lane];

/**
 * The layers of the package map, from the bottom: a member imports only members of a strictly lower layer that its lane
 * allows (ST-02).
 */
export const Layer = {
  Vocabulary: 0,
  Configuration: 1,
  Wire: 2,
  Platform: 3,
  Adapters: 4,
  Domain: 5,
  Surfaces: 6,
  Entries: 7,
} as const;

export type Layer = (typeof Layer)[keyof typeof Layer];

/** The form a member's code takes: schemas, constants and pure functions, plain TypeScript, or the Effect dialect. */
export const Dialect = { Data: 'data', Plain: 'plain', Effect: 'effect' } as const;

export type Dialect = (typeof Dialect)[keyof typeof Dialect];

/** The template a member's package follows, which fixes its files and folders (ST-08, ST-12). */
export const PackageKind = {
  Library: 'library',
  LibraryProgram: 'library-program',
  Wire: 'wire',
  Store: 'store',
  Object: 'object',
  Surface: 'surface',
  Program: 'program',
  Scenarios: 'scenarios',
  Support: 'support',
  App: 'app',
} as const;

export type PackageKind = (typeof PackageKind)[keyof typeof PackageKind];

/**
 * The boundary that admits a package (ST-01): it owns persisted state, has another dependency closure, serves two or
 * more other packages, or is a program.
 */
export const Criterion = { State: 'state', Closure: 'closure', Reuse: 'reuse', Program: 'program' } as const;

export type Criterion = (typeof Criterion)[keyof typeof Criterion];

/**
 * The families of dependency-cruiser rules the generator writes from the member manifest: one rule for each member's
 * layer, one for each lane's runtime modules, and one for each confined package.
 */
export const ManifestFamily = { Layer: 'layer', Lane: 'lane', Confine: 'confine' } as const;

export type ManifestFamily = (typeof ManifestFamily)[keyof typeof ManifestFamily];

/** What separates a family's name from its subject in each rule it writes, as in `layer:@mechane/client`. */
export const SUBJECT_SEPARATOR = ':';
