import type { Scenario } from '@mechane/testing';

const HALF_DIVISOR = 2;

export const CONTAINER_FREE_FAMILIES: ReadonlySet<string> = new Set(['auth', 'managed']);

export const SMOKE_SHARDS = [
  'auth',
  'managed-core',
  'managed-advanced',
  'lifecycle',
  'console',
  'compute-fast',
  'compute-recovery',
  'compute-restore',
] as const;

export type SmokeShard = (typeof SMOKE_SHARDS)[number];

const LIFECYCLE_FAMILIES: ReadonlySet<string> = new Set(['context', 'runs', 'recovery', 'evals', 'security']);
const COMPUTE_RECOVERY_NAMES: ReadonlySet<string> = new Set(['checkpointedFilesSurviveMachineLoss']);

const COMPUTE_RESTORE_NAMES: ReadonlySet<string> = new Set([
  'drainCompletesBeforePendingBash',
  'largeHomeSurvivesRestore',
]);

type ShardSelectionInput = { readonly catalog: ReadonlyArray<Scenario>; readonly shard: SmokeShard };

export function parseSmokeShard(value: string): SmokeShard {
  const matched = SMOKE_SHARDS.find((candidate) => candidate === value);

  if (matched === undefined) {
    throw new Error(`The smoke does not declare shard ${value}`);
  }

  return matched;
}

function scenariosForShard({ catalog, shard }: ShardSelectionInput): ReadonlyArray<Scenario> {
  const managed = catalog.filter(({ family }) => family === 'managed');
  const managedMidpoint = Math.ceil(managed.length / HALF_DIVISOR);

  switch (shard) {
    case 'auth':
      return catalog.filter(({ family }) => family === 'auth');
    case 'managed-core':
      return managed.slice(0, managedMidpoint);
    case 'managed-advanced':
      return managed.slice(managedMidpoint);
    case 'lifecycle':
      return catalog.filter(({ family }) => LIFECYCLE_FAMILIES.has(family));
    case 'console':
      return catalog.filter(({ family }) => family === 'console');
    case 'compute-fast':
      return catalog.filter(
        ({ family, run }) =>
          family === 'compute' && !COMPUTE_RECOVERY_NAMES.has(run.name) && !COMPUTE_RESTORE_NAMES.has(run.name),
      );
    case 'compute-recovery':
      return catalog.filter(({ family, run }) => family === 'compute' && COMPUTE_RECOVERY_NAMES.has(run.name));
    case 'compute-restore':
      return catalog.filter(({ family, run }) => family === 'compute' && COMPUTE_RESTORE_NAMES.has(run.name));
  }
}

export function selectShardScenarios({ catalog, shard }: ShardSelectionInput): ReadonlyArray<Scenario> {
  const partitioned = SMOKE_SHARDS.flatMap((name) => scenariosForShard({ catalog, shard: name }));
  const covered = new Set<string>();

  for (const scenario of partitioned) {
    if (covered.has(scenario.guarantee)) {
      throw new Error(`Smoke shard partition duplicated guarantee: ${scenario.guarantee}`);
    }

    covered.add(scenario.guarantee);
  }

  if (covered.size !== catalog.length) {
    throw new Error('Smoke shard partition does not cover the complete scenario catalog');
  }

  const selected = scenariosForShard({ catalog, shard });

  if (selected.length === 0) {
    throw new Error(`Smoke shard ${shard} selected no scenarios`);
  }

  return selected;
}
