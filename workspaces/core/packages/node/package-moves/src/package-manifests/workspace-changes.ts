import { InputUnreadable, readText } from '@mechane/checks-kernel';
import type { FileChange, MoveStep } from '@mechane/checks-kernel';
import { JSON_INDENT_CHARS } from '@mechane/program';
import { MemberManifest } from '@mechane/rule-shapes';
import { Effect, Option, Record, Schema } from 'effect';
import { posix } from 'node:path';
import { parseDocument } from 'yaml';
import type { PlacedMember, StepLayout } from '../packages.types.ts';

/** The member manifest, relative to the workspace. */
const MEMBER_MANIFEST = 'dependencies.json';

/** The file that lists the workspace's member folders as globs, relative to the workspace. */
const WORKSPACE_FILE = 'pnpm-workspace.yaml';

/** The key of pnpm-workspace.yaml whose globs list the member folders. */
const PACKAGES_KEY = 'packages';

/** The part of pnpm-workspace.yaml the step extends: the globs of the member folders. */
const WorkspaceFolders = Schema.Struct({ [PACKAGES_KEY]: Schema.Array(Schema.String) });

/** A step, and the names of the members it empties. */
type ManifestChangeInput = { readonly step: MoveStep; readonly emptied: ReadonlyArray<string> };

/** A step, its layout, and the names of the members it empties. */
type WorkspaceChangesInput = {
  readonly step: MoveStep;
  readonly layout: StepLayout;
  readonly emptied: ReadonlyArray<string>;
};

/**
 * The member manifest with the step's entries written and each emptied member's gone, and pnpm-workspace.yaml with a
 * glob of each lane folder a member lands in, as `packages/<lane>/*`. A file the step leaves as it is stays unwritten.
 */
export const workspaceChanges = Effect.fn('workspaceChanges')(function* ({
  step,
  layout,
  emptied,
}: WorkspaceChangesInput): Effect.fn.Return<ReadonlyArray<FileChange>, InputUnreadable> {
  const workspace = parseDocument(yield* readText({ path: WORKSPACE_FILE }));

  const { packages } = yield* Schema.decodeUnknownEffect(WorkspaceFolders)(workspace.toJS()).pipe(
    Effect.mapError((error) => new InputUnreadable({ path: WORKSPACE_FILE, reason: error.message })),
  );

  /** The glob of the lane folder that holds a member's folder, as `packages/<lane>/*`. */
  const laneGlob: (member: PlacedMember) => string = ({ folder }) => {
    const lane = posix.dirname(folder);

    return `${lane}/*`;
  };

  const globs = new Set(layout.packages.map(laneGlob));

  /** Whether pnpm-workspace.yaml lacks the glob. */
  const isMissing: (glob: string) => boolean = (glob) => !packages.includes(glob);
  const added = [...globs].filter(isMissing);

  for (const glob of added) {
    workspace.addIn([PACKAGES_KEY], glob);
  }

  return [
    ...Option.toArray(yield* manifestChange({ step, emptied })),
    ...Option.toArray(
      Option.liftPredicate({ path: WORKSPACE_FILE, text: Option.some(workspace.toString()) }, () => added.length > 0),
    ),
  ];
});

/** The member manifest's change: the step's entries written and each emptied member's gone; none when it is as was. */
const manifestChange = Effect.fn('manifestChange')(function* ({
  step,
  emptied,
}: ManifestChangeInput): Effect.fn.Return<Option.Option<FileChange>, InputUnreadable> {
  const manifest = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(MemberManifest), {
    onExcessProperty: 'error',
  })(yield* readText({ path: MEMBER_MANIFEST })).pipe(
    Effect.mapError((error) => new InputUnreadable({ path: MEMBER_MANIFEST, reason: error.message })),
  );

  /** Whether the step keeps the member's row: any but an emptied member's. */
  const isKept: (entry: unknown, name: string) => boolean = (_entry, name) => !emptied.includes(name);
  const kept = Record.filter(manifest, isKept);
  const encoded = Schema.encodeSync(MemberManifest)({ ...kept, ...step.members });
  const isChanged = JSON.stringify(encoded) !== JSON.stringify(Schema.encodeSync(MemberManifest)(manifest));
  const text = `${JSON.stringify(encoded, null, JSON_INDENT_CHARS)}\n`;

  return Option.liftPredicate({ path: MEMBER_MANIFEST, text: Option.some(text) }, () => isChanged);
});
