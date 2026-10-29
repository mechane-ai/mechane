import { Schema } from 'effect';

const Dependency = Schema.Struct({
  module: Schema.String,
  resolved: Schema.String,
  isUnresolvable: Schema.Boolean,
}).pipe(Schema.encodeKeys({ isUnresolvable: 'couldNotResolve' }));

const CruisedModule = Schema.Struct({ source: Schema.String, dependencies: Schema.Array(Dependency) });

/** One module a cruise found, with the imports it resolved to files. */
export type CruisedModule = typeof CruisedModule.Type;

/** The modules a cruise found, each with the imports it resolved to files. */
export const CruisedModules = Schema.Array(CruisedModule);

export type CruisedModules = typeof CruisedModules.Type;

/** One import that breaks a rule of .dependency-cruiser.cjs: the importing file, the imported one and the rule. */
export const CruiseViolation = Schema.Struct({
  from: Schema.String,
  to: Schema.String,
  rule: Schema.Struct({ name: Schema.String }),
});

export type CruiseViolation = typeof CruiseViolation.Type;
