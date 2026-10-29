import { Record } from 'effect';
import type { CruisedModule, CruisedModules } from './schemas.ts';

type ModuleGraphInput = { readonly modules: CruisedModules };

/** Each cruised file and the files it imports, which the changed set follows back to every importer of a change. */
export function moduleGraph({ modules }: ModuleGraphInput): Readonly<Record<string, ReadonlyArray<string>>> {
  /** A cruised file and the files its resolved imports name. */
  const graphEntry: (module: CruisedModule) => readonly [string, ReadonlyArray<string>] = ({
    source,
    dependencies,
  }) => [
    source,
    dependencies.filter((dependency) => !dependency.isUnresolvable).map((dependency) => dependency.resolved),
  ];

  return Record.fromEntries(modules.map(graphEntry));
}
