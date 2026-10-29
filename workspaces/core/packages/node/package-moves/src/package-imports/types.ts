import type { ExportTable, ModuleName, Origin } from '@mechane/modules';
import type { Option } from 'effect';
import type { PlacedMember, Requirement, StepLayout } from '../packages.types.ts';

/** What a file's rewrite reads of the tree before the step: the layout, every file's exports, and each entry. */
export type SourceContext = {
  readonly layout: StepLayout;
  readonly table: ExportTable;
  /** Each member's entry before the step, relative to the workspace, by the member's package name. */
  readonly entries: ReadonlyMap<string, string>;
};

/** A relative path in a file's text: the path, the offsets between its quotes, and whether it is an import. */
export type LiteralSite = {
  readonly value: string;
  readonly start: number;
  readonly end: number;
  readonly isModule: boolean;
};

/** Where a name a statement takes comes from after the step, and the export of an entry it needs. */
export type Destination = {
  readonly specifier: string;
  readonly name: ModuleName;
  /** Absent for a name of the importer's own member or of a package. */
  readonly requirement: Option.Option<Requirement>;
};

/**
 * Where a name stands after the step: the importer's path and member, the declaration's origin before the step and its
 * path and member after it. A local name's file stays in the importer's member, and a staying name's member is its
 * package's. A dropped name is an entry's re-export of a file that left its member.
 */
export type NamePlace = {
  readonly importer: string;
  readonly target: string;
  readonly importing: PlacedMember;
  readonly origin: Origin;
  readonly declaring: string;
  readonly owner: PlacedMember;
  readonly isLocal: boolean;
  readonly isStaying: boolean;
  readonly isDropped: boolean;
};
