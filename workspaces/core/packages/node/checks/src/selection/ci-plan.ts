import {
  FACTORY_FOLDER,
  folderPrefixPath,
  gitLines,
  mergeBase,
  WORKSPACE_FOLDER,
  workspaceMembers,
} from '@mechane/checks-kernel';
import type { InputUnreadable, Member } from '@mechane/checks-kernel';
import { Lane } from '@mechane/rule-shapes';
import { Effect, Option } from 'effect';
import { basename, relative } from 'node:path';

const GLOBAL_CONFIGURATION_NAMES: ReadonlySet<string> = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'dependencies.json',
  'mise.toml',
  'mise.lock',
  'tsconfig.base.json',
]);

const ELEMENTS_MEMBERS: ReadonlySet<string> = new Set(['@mechane-ai/elements', '@mechane/catalog']);
const ALL_LANES: ReadonlyArray<Lane> = [Lane.Shared, Lane.Worker, Lane.Browser, Lane.Node];
const INFRASTRUCTURE_PREFIX = 'infrastructure/';
const WORKSPACE_PACKAGE_PREFIX = 'packages/';

type CiPlanInput = { readonly baseBranch: string; readonly inherited: Readonly<Record<string, string>> };

type MemberMatchInput = { readonly path: string; readonly members: ReadonlyArray<Member> };

type PathInput = { readonly path: string };

type FolderInput = { readonly folder: string };

type LaneExpansionInput = { readonly lane: Lane };

type CiPlan = {
  readonly lanes: ReadonlyArray<Lane>;
  readonly hasElements: boolean;
  readonly hasConsole: boolean;
  readonly hasWorker: boolean;
  readonly hasInfrastructure: boolean;
};

/** Computes affected package lanes and build surfaces from git diff and workspace membership. */
export const ciPlanLines = Effect.fn('ciPlanLines')(function* ({
  baseBranch,
  inherited,
}: CiPlanInput): Effect.fn.Return<ReadonlyArray<string>, InputUnreadable> {
  const base = yield* mergeBase({ baseBranch, inherited });
  const committed = yield* gitLines({ args: ['diff', '--name-only', base], inherited });
  const untracked = yield* gitLines({ args: ['ls-files', '--others', '--exclude-standard', '--full-name'], inherited });
  const changed = [...committed, ...untracked];
  const members = yield* workspaceMembers();
  const workspaceRelative = relative(FACTORY_FOLDER, WORKSPACE_FOLDER);
  const workspacePrefix = folderPrefixPath({ folder: workspaceRelative });
  const isGlobalChange = changed.length === 0 || changed.some((path) => isGlobalConfigurationPath({ path }));

  if (isGlobalChange) {
    const full: CiPlan = {
      lanes: ALL_LANES,
      hasElements: true,
      hasConsole: true,
      hasWorker: true,
      hasInfrastructure: true,
    };

    return [JSON.stringify(full)];
  }

  const workspacePaths = changed
    .filter((fullPath) => fullPath.startsWith(workspacePrefix))
    .map((fullPath) => fullPath.slice(workspacePrefix.length));

  const hasInfrastructure = workspacePaths.some((path) => path.startsWith(INFRASTRUCTURE_PREFIX));
  const packagePaths = workspacePaths.filter((path) => path.startsWith(WORKSPACE_PACKAGE_PREFIX));

  const matchedOwners = packagePaths.flatMap((path) => {
    const owner = owningMember({ path, members });

    return Option.toArray(owner);
  });

  const ownerLanes = matchedOwners.flatMap((member) => {
    const lane = memberLane({ folder: member.folder });

    return Option.toArray(lane);
  });

  const expandedList = ownerLanes.flatMap((lane) => expandAffectedLanes({ lane }));
  const expandedLanes = new Set(expandedList);
  const orderedLanes = ALL_LANES.filter((lane) => expandedLanes.has(lane));
  const hasElements = matchedOwners.some((member) => ELEMENTS_MEMBERS.has(member.name));
  const hasConsole = expandedLanes.has(Lane.Browser);
  const hasWorker = expandedLanes.has(Lane.Worker);
  const plan: CiPlan = { lanes: orderedLanes, hasElements, hasConsole, hasWorker, hasInfrastructure };

  return [JSON.stringify(plan)];
});

function isGlobalConfigurationPath({ path }: PathInput): boolean {
  const name = basename(path);

  return GLOBAL_CONFIGURATION_NAMES.has(name);
}

function owningMember({ path, members }: MemberMatchInput): Option.Option<Member> {
  const matched = members.find((member) => {
    if (member.folder.length === 0) {
      return false;
    }

    const prefix = folderPrefixPath({ folder: member.folder });

    return path.startsWith(prefix);
  });

  return Option.fromNullishOr(matched);
}

function memberLane({ folder }: FolderInput): Option.Option<Lane> {
  if (folder.startsWith('packages/shared/')) {
    return Option.some(Lane.Shared);
  }

  if (folder.startsWith('packages/worker/')) {
    return Option.some(Lane.Worker);
  }

  if (folder.startsWith('packages/browser/')) {
    return Option.some(Lane.Browser);
  }

  if (folder.startsWith('packages/node/')) {
    return Option.some(Lane.Node);
  }

  return Option.none();
}

function expandAffectedLanes({ lane }: LaneExpansionInput): ReadonlyArray<Lane> {
  if (lane === Lane.Shared) {
    return ALL_LANES;
  }

  return [lane];
}
