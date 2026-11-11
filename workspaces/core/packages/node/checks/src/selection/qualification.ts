import {
  CACHE_FOLDER,
  CHECKS_PROGRAM,
  decodeFile,
  InputUnreadable,
  readModuleGraph,
  removePath,
  workspaceMembers,
  writeTextFile,
} from '@mechane/checks-kernel';
import type { ChecksFailure, Finding, InheritedInput, ReadInput } from '@mechane/checks-kernel';
import { writeDiagnostic } from '@mechane/program';
import { Effect, Option, Schema } from 'effect';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { bundleEntries } from '../fingerprint/bundle-entries.ts';
import { checkTargets } from './check-targets.ts';
import { CheckTask, SMOKE_TASK_PREFIX } from './constants.ts';
import { runTargetCommand } from './run-target-command.ts';
import { smokeCatalog } from './smoke-catalog.ts';
import { smokeDependencies } from './smoke-dependencies.ts';
import { selectionFiles, targetArtifacts, targetInputs } from './target-inputs.ts';
import type { TargetInputsInput } from './target-inputs.ts';
import { qualificationEnvironment, toolchain } from './toolchain.ts';

const QUALIFICATION_FOLDER = join(CACHE_FOLDER, 'successful-targets');

const Qualification = Schema.Struct({
  task: Schema.String,
  guarantees: Schema.Array(Schema.String),
  inputs: Schema.String,
  artifacts: Schema.String,
  isComplete: Schema.Boolean,
  environment: Schema.String,
  toolchain: Schema.String,
});

type Qualification = typeof Qualification.Type;

const ABSENT_QUALIFICATION = Option.none<Qualification>();

type RunTargetInput = InheritedInput & { readonly task: Option.Option<string>; readonly args: ReadonlyArray<string> };

type RecordedQualificationsInput = { readonly current: ReadonlyArray<Qualification> };

type TargetQualificationInput = TargetInputsInput & { readonly environment: string; readonly tools: string };

type QualificationPathInput = { readonly task: string };

type RecordQualificationInput = { readonly qualification: Qualification };

type SelectedQualificationsInput = {
  readonly current: ReadonlyArray<Qualification>;
  readonly recorded: ReadonlyArray<Qualification>;
};

type SameQualificationInput = { readonly left: Qualification; readonly right: Qualification };

/** Planning reads inputs and existing artifacts; it never builds an executable merely to select a check. */
export const affectedChecks = Effect.fn('affectedChecks')(function* ({
  inherited,
}: InheritedInput): Effect.fn.Return<ReadonlyArray<string>, InputUnreadable> {
  const current = yield* currentQualifications({ inherited });
  const recorded = yield* recordedQualifications({ current });
  const selected = selectedQualifications({ current, recorded });

  return selected.map(({ task }) => task);
});

export const runAffectedChecks = Effect.fn('runAffectedChecks')(function* ({
  inherited,
}: InheritedInput): Effect.fn.Return<ReadonlyArray<Finding>, ChecksFailure> {
  const current = yield* currentQualifications({ inherited });
  const recorded = yield* recordedQualifications({ current });
  const selected = selectedQualifications({ current, recorded });
  const smoke = selected.filter(({ task }) => task.startsWith(SMOKE_TASK_PREFIX));
  const families = current.filter(({ task }) => task.startsWith(SMOKE_TASK_PREFIX));
  const independent = selected.filter(({ task }) => !task.startsWith(SMOKE_TASK_PREFIX)).map(({ task }) => task);

  const smokeTasks: ReadonlyArray<string> = (() => {
    if (smoke.length === families.length && smoke.length > 0) {
      return [CheckTask.Smoke];
    }

    return smoke.map(({ task }) => task);
  })();

  for (const task of [...independent, ...smokeTasks]) {
    yield* runTargetCommand({ command: 'mise', args: ['run', task], inherited });
  }

  return [];
});

/** Target tasks call this after preparation; filtered runs cannot qualify a whole family. */
export const runQualifiedTarget = Effect.fn('runQualifiedTarget')(function* ({
  task,
  args,
  inherited,
}: RunTargetInput): Effect.fn.Return<ReadonlyArray<Finding>, ChecksFailure> {
  if (Option.isNone(task)) {
    return yield* new InputUnreadable({ path: 'the check target', reason: 'name a declared check target' });
  }

  const selectedTask = task.value;
  const before = yield* currentQualifications({ inherited });

  const selected = before.filter((qualification) => {
    if (selectedTask === CheckTask.Smoke) {
      return qualification.task.startsWith(SMOKE_TASK_PREFIX);
    }

    return qualification.task === selectedTask;
  });

  if (selected.length === 0) {
    return yield* new InputUnreadable({ path: selectedTask, reason: 'name a declared check target' });
  }

  if (selectedTask === CheckTask.Infrastructure && args.length > 0) {
    return yield* new InputUnreadable({
      path: selectedTask,
      reason: 'the infrastructure target accepts no scenario filter',
    });
  }

  for (const qualification of selected) {
    const path = qualificationPath({ task: qualification.task });

    yield* removePath({ path });
  }

  if (selectedTask === CheckTask.Infrastructure) {
    yield* runTargetCommand({ command: 'mise', args: ['run', 'infrastructure:verify'], inherited });
  } else {
    const smokeArguments = ['packages/node/smoke/src/main.ts'];

    if (selectedTask !== CheckTask.Smoke) {
      const family = selectedTask.slice(SMOKE_TASK_PREFIX.length);

      smokeArguments.push('--family', family);
    }

    yield* runTargetCommand({ command: 'node', args: [...smokeArguments, ...args], inherited });
  }

  if (args.length > 0) {
    writeDiagnostic({ program: CHECKS_PROGRAM, line: `leave filtered ${selectedTask} unqualified` });

    return [];
  }

  const after = yield* currentQualifications({ inherited });

  for (const qualification of selected) {
    const found = after.find(({ task: currentTask }) => currentTask === qualification.task);
    const current = Option.fromNullishOr(found);

    if (Option.isNone(current)) {
      return yield* changedQualification({ qualification });
    }

    if (!current.value.isComplete || !sameQualification({ left: qualification, right: current.value })) {
      return yield* changedQualification({ qualification });
    }
  }

  for (const qualification of selected) {
    yield* recordQualification({ qualification });
  }

  return [];
});

const currentQualifications = Effect.fn('currentQualifications')(function* ({
  inherited,
}: InheritedInput): Effect.fn.Return<ReadonlyArray<Qualification>, InputUnreadable> {
  const files = yield* selectionFiles({ inherited });
  const members = yield* workspaceMembers();
  const cruised = yield* readModuleGraph();
  const graph = yield* smokeDependencies({ files, graph: cruised });
  const workspaceFiles = files.filter((path) => !path.startsWith('../'));
  const bundles = yield* bundleEntries({ files: workspaceFiles, members });
  const catalog = yield* smokeCatalog();
  const targets = checkTargets({ bundles, catalog });
  const environment = qualificationEnvironment({ inherited });
  const tools = yield* toolchain({ inherited });

  return yield* Effect.forEach(
    targets,
    (target) => {
      const targetTools: string = (() => {
        if (Option.isSome(target.family)) {
          return tools.source;
        }

        return tools.infrastructure;
      })();

      return targetQualification({ target, files, members, graph, environment, tools: targetTools });
    },
    { concurrency: 1 },
  );
});

const targetQualification = Effect.fn('targetQualification')(function* ({
  target,
  files,
  members,
  graph,
  environment,
  tools,
}: TargetQualificationInput): Effect.fn.Return<Qualification, InputUnreadable> {
  const inputs = yield* targetInputs({ target, files, members, graph });
  const { hash: artifacts, isComplete } = yield* targetArtifacts({ target });

  return {
    task: target.task,
    guarantees: target.guarantees,
    inputs,
    artifacts,
    isComplete,
    environment,
    toolchain: tools,
  };
});

const recordedQualifications = Effect.fn('recordedQualifications')(function* ({
  current,
}: RecordedQualificationsInput): Effect.fn.Return<ReadonlyArray<Qualification>, InputUnreadable> {
  const recorded = yield* Effect.forEach(current, ({ task }) => recordedQualification({ task }), { concurrency: 1 });

  return recorded.flat();
});

const recordedQualification = Effect.fn('recordedQualification')(function* ({
  task,
}: QualificationPathInput): Effect.fn.Return<ReadonlyArray<Qualification>, InputUnreadable> {
  const path = qualificationPath({ task });

  if (!existsSync(path)) {
    return [];
  }

  const qualification = yield* readQualification({ path }).pipe(
    Effect.catchTags({ InputUnreadable: () => Effect.succeed(ABSENT_QUALIFICATION) }),
  );

  if (Option.isNone(qualification)) {
    return [];
  }

  return [qualification.value];
});

const readQualification = Effect.fn('readQualification')(function* ({
  path,
}: ReadInput): Effect.fn.Return<Option.Option<Qualification>, InputUnreadable> {
  const qualification = yield* decodeFile({ path, schema: Qualification });

  return Option.some(qualification);
});

const recordQualification = Effect.fn('recordQualification')(function* ({
  qualification,
}: RecordQualificationInput): Effect.fn.Return<void, ChecksFailure> {
  const path = qualificationPath({ task: qualification.task });
  const text = JSON.stringify(qualification);

  yield* writeTextFile({ path, text: `${text}\n` });
  writeDiagnostic({ program: CHECKS_PROGRAM, line: `record successful ${qualification.task}` });
});

function qualificationPath({ task }: QualificationPathInput): string {
  const name = encodeURIComponent(task);

  return join(QUALIFICATION_FOLDER, `${name}.json`);
}

function changedQualification({ qualification }: RecordQualificationInput): InputUnreadable {
  return new InputUnreadable({
    path: qualification.task,
    reason: 'check inputs or artifacts changed during execution or remain incomplete',
  });
}

function sameQualification({ left, right }: SameQualificationInput): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function selectedQualifications({ current, recorded }: SelectedQualificationsInput): ReadonlyArray<Qualification> {
  const selected = current.filter(
    (qualification) =>
      !qualification.isComplete || !recorded.some((green) => sameQualification({ left: green, right: qualification })),
  );

  for (const qualification of current) {
    const action: string = (() => {
      if (selected.includes(qualification)) {
        return 'run';
      }

      return 'reuse successful target evidence for';
    })();

    writeDiagnostic({ program: CHECKS_PROGRAM, line: `${action} ${qualification.task}` });
  }

  return selected;
}
