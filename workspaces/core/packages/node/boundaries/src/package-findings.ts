import type { Finding, Member } from '@mechane/checks-kernel';
import type { MemberManifest } from '@mechane/rule-shapes';
import { Array, Option } from 'effect';
import { holdingMember } from './holding-member.ts';
import { manifestFindings } from './manifest-findings.ts';
import type { CruisedModule, CruisedModules } from './schemas.ts';

/** One import of a cruised file, by its specifier, and the file it resolved to. */
type ResolvedImport = { readonly source: string; readonly module: string; readonly resolved: string };

/** An import from one workspace member's file into another member's file. */
type CrossingImport = {
  readonly source: string;
  readonly module: string;
  readonly resolved: string;
  readonly from: Member;
  readonly to: Member;
};

type PackagesInput = {
  readonly modules: CruisedModules;
  readonly manifest: MemberManifest;
  readonly members: ReadonlyArray<Member>;
};

type CrossingInput = { readonly modules: CruisedModules; readonly members: ReadonlyArray<Member> };

/**
 * Checks the members and their edges: the manifest declares every member, and every import between members follows an
 * edge the importer's `package.json` declares, by package name. The layer rules hold each edge to the layers, so no
 * edge closes a cycle.
 */
export function packageFindings({ modules, manifest, members }: PackagesInput): ReadonlyArray<Finding> {
  const crossing = crossingImports({ modules, members });
  const isUndeclared: (edge: CrossingImport) => boolean = (edge) => !edge.from.internal.includes(edge.to.name);

  const undeclaredFinding: (edge: CrossingImport) => Finding = (edge) => ({
    check: 'packages',
    location: edge.source,
    message: `Declare ${edge.to.name} in the package.json of ${edge.from.name} or drop the import, such as \`"${edge.to.name}": "workspace:*"\``,
  });

  const byPathFinding: (edge: CrossingImport) => Finding = (edge) => ({
    check: 'packages',
    location: edge.source,
    message: `Import ${edge.to.name} by name, such as \`from '${edge.to.name}'\`, since it reaches ${edge.resolved} by path`,
  });

  return [
    ...crossing.filter(isUndeclared).map(undeclaredFinding),
    ...crossing.filter((edge) => edge.module.startsWith('.')).map(byPathFinding),
    ...manifestFindings({ manifest, members }),
  ];
}

/** Each resolved import of a member's file that lands in another member's file. */
function crossingImports({ modules, members }: CrossingInput): ReadonlyArray<CrossingImport> {
  /** Each import of one cruised file that resolved to a file. */
  const resolvedImports: (module: CruisedModule) => ReadonlyArray<ResolvedImport> = ({ source, dependencies }) =>
    dependencies
      .filter((dependency) => !dependency.isUnresolvable)
      .map(({ module, resolved }) => ({ source, module, resolved }));

  /** One resolved import with the members at its two ends, when they differ. */
  const crossingOf: (resolvedImport: ResolvedImport) => Option.Option<CrossingImport> = (resolvedImport) => {
    const ends = Option.all({
      from: holdingMember({ path: resolvedImport.source, members }),
      to: holdingMember({ path: resolvedImport.resolved, members }),
    });

    const crossing = Option.map(ends, (end) => ({ ...resolvedImport, ...end }));

    return Option.filter(crossing, ({ from, to }) => from.name !== to.name);
  };

  return Array.getSomes(modules.flatMap(resolvedImports).map(crossingOf));
}
