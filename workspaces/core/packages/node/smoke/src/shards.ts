import type { Scenario } from '@mechane/testing';

const HALF_DIVISOR = 2;

export const SMOKE_SHARDS = [
  'auth',
  'managed-core',
  'managed-advanced',
  'lifecycle-context',
  'lifecycle-core',
  'lifecycle-recovery',
  'console',
  'compute-core',
  'compute-capacity',
  'compute-browser',
  'compute-drain',
  'compute-recovery',
  'compute-restore',
] as const;

export type SmokeShard = (typeof SMOKE_SHARDS)[number];

const CONTAINER_SCENARIO_NAMES: ReadonlySet<string> = new Set([
  'backgroundProcessKeepsItsCompletion',
  'checkpointedFilesSurviveMachineLoss',
  'drainCompletesBeforePendingBash',
  'executionGrantIsCurrentAndTransient',
  'installedCapacityProtectsPhysicalMachines',
  'installedWorkerRecoversInterruptedCommand',
  'largeHomeSurvivesRestore',
  'recordingFailurePreservesEnvironment',
  'stoppedProcessRemainsInspectable',
  'consoleOpensSessionEvidence',
  'installedWorkerFinishesInterruptedTool',
]);

const LIFECYCLE_CORE_NAMES: ReadonlySet<string> = new Set([
  'workspaceBudgetGuardsSession',
  'interruptRedirectsSession',
  'gradesOnlyValidIsolatedEvaluations',
  'credentialsStayOutOfDurableExecution',
  'remoteToolGrantsHonorPolicy',
]);

const COMPUTE_CORE_NAMES: ReadonlySet<string> = new Set([
  'installedWorkerRecoversInterruptedCommand',
  'installedWorkerFinishesInterruptedTool',
  'backgroundProcessKeepsItsCompletion',
  'executionGrantIsCurrentAndTransient',
]);

const COMPUTE_CAPACITY_NAMES: ReadonlySet<string> = new Set([
  'installedCapacityProtectsPhysicalMachines',
  'stoppedProcessRemainsInspectable',
]);

const COMPUTE_BROWSER_NAMES: ReadonlySet<string> = new Set(['recordingFailurePreservesEnvironment']);
const COMPUTE_DRAIN_NAMES: ReadonlySet<string> = new Set(['drainCompletesBeforePendingBash']);
const COMPUTE_RECOVERY_NAMES: ReadonlySet<string> = new Set(['checkpointedFilesSurviveMachineLoss']);
const COMPUTE_RESTORE_NAMES: ReadonlySet<string> = new Set(['largeHomeSurvivesRestore']);

type ShardSelectionInput = { readonly catalog: ReadonlyArray<Scenario>; readonly shard: SmokeShard };

export function scenarioNeedsContainer(scenario: Scenario): boolean {
  return CONTAINER_SCENARIO_NAMES.has(scenario.run.name);
}

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
    case 'lifecycle-context':
      return catalog.filter(({ family }) => family === 'context');
    case 'lifecycle-core':
      return catalog.filter(({ run }) => LIFECYCLE_CORE_NAMES.has(run.name));
    case 'lifecycle-recovery':
      return catalog.filter(({ family }) => family === 'recovery');
    case 'console':
      return catalog.filter(({ family }) => family === 'console');
    case 'compute-core':
      return catalog.filter(({ run }) => COMPUTE_CORE_NAMES.has(run.name));
    case 'compute-capacity':
      return catalog.filter(({ run }) => COMPUTE_CAPACITY_NAMES.has(run.name));
    case 'compute-browser':
      return catalog.filter(({ run }) => COMPUTE_BROWSER_NAMES.has(run.name));
    case 'compute-drain':
      return catalog.filter(({ run }) => COMPUTE_DRAIN_NAMES.has(run.name));
    case 'compute-recovery':
      return catalog.filter(({ run }) => COMPUTE_RECOVERY_NAMES.has(run.name));
    case 'compute-restore':
      return catalog.filter(({ run }) => COMPUTE_RESTORE_NAMES.has(run.name));
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
