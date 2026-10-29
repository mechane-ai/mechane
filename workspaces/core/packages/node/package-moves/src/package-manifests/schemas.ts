import { Schema } from 'effect';

/** A manifest's dependencies or development dependencies, by package name. */
const Dependencies = Schema.optionalKey(Schema.Record(Schema.String, Schema.String));

/** The parts of a package manifest the step reads: its dependencies and its development dependencies. */
export const ManifestDependencies = Schema.Struct({ dependencies: Dependencies, devDependencies: Dependencies });

export type ManifestDependencies = typeof ManifestDependencies.Type;
