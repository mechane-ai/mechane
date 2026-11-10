import {
  CACHE_FOLDER,
  CHECKS_PROGRAM,
  decodeFile,
  InputUnreadable,
  readModuleGraph,
  workspaceMembers,
  writeTextFile,
} from '@mechane/checks-kernel';
import type { ChecksFailure, InheritedInput } from '@mechane/checks-kernel';
import { writeDiagnostic } from '@mechane/program';
import { Effect, Schema } from 'effect';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { bundleEntries } from '../fingerprint/bundle-entries.ts';
import { checkTargets } from './check-targets.ts';
import { selectionFiles, targetArtifacts, targetInputs } from './target-inputs.ts';
import type { TargetInputsInput } from './target-inputs.ts';

const GREEN_QUALIFICATION = join(CACHE_FOLDER, 'green-qualification.json');

const Qualification = Schema.Struct({
  task: Schema.String,
  guarantees: Schema.Array(Schema.String),
  inputs: Schema.String,
  artifacts: Schema.String,
  isComplete: Schema.Boolean,
});

type Qualification = typeof Qualification.Type;

const Qualifications = Schema.Array(Qualification);

/** Planning reads inputs and existing artifacts; it never builds an executable merely to select a check. */
export const affectedChecks = Effect.fn('affectedChecks')(function* ({
  inherited,
}: InheritedInput): Effect.fn.Return<ReadonlyArray<string>, InputUnreadable> {
  const current = yield* currentQualifications({ inherited });
  const recorded = yield* recordedQualifications();

  const selected = current.filter(
    (qualification) =>
      !qualification.isComplete || !recorded.some((green) => JSON.stringify(green) === JSON.stringify(qualification)),
  );

  for (const qualification of current) {
    const isSelected = selected.includes(qualification);

    const action: string = (() => {
      if (isSelected) {
        return 'run';
      }

      return 'reuse the last green full check for';
    })();

    writeDiagnostic({ program: CHECKS_PROGRAM, line: `${action} ${qualification.task}` });
  }

  const tasks = selected.map(({ task }) => task);

  if (tasks.length === 0) {
    return [];
  }

  return [tasks.join(' ::: ')];
});

/** Only the complete check graph records evidence; a fast check never promotes itself to the publication gate. */
export const recordQualification = Effect.fn('recordQualification')(function* ({
  inherited,
}: InheritedInput): Effect.fn.Return<void, ChecksFailure> {
  const qualifications = yield* currentQualifications({ inherited });
  const missing = qualifications.filter(({ isComplete }) => !isComplete).map(({ task }) => task);

  if (missing.length > 0) {
    const tasks = missing.join(', ');

    return yield* new InputUnreadable({
      path: GREEN_QUALIFICATION,
      reason: `required artifacts are absent for ${tasks}`,
    });
  }

  const text = JSON.stringify(qualifications);

  yield* writeTextFile({ path: GREEN_QUALIFICATION, text: `${text}\n` });
});

const currentQualifications = Effect.fn('currentQualifications')(function* ({
  inherited,
}: InheritedInput): Effect.fn.Return<ReadonlyArray<Qualification>, InputUnreadable> {
  const files = yield* selectionFiles({ inherited });
  const members = yield* workspaceMembers();
  const graph = yield* readModuleGraph();
  const workspaceFiles = files.filter((path) => !path.startsWith('../'));
  const bundles = yield* bundleEntries({ files: workspaceFiles, members });
  const targets = checkTargets({ bundles });

  return yield* Effect.forEach(targets, (target) => targetQualification({ target, files, members, graph }), {
    concurrency: 1,
  });
});

const targetQualification = Effect.fn('targetQualification')(function* ({
  target,
  files,
  members,
  graph,
}: TargetInputsInput): Effect.fn.Return<Qualification, InputUnreadable> {
  const inputs = yield* targetInputs({ target, files, members, graph });
  const { hash: artifacts, isComplete } = yield* targetArtifacts({ target });

  return { task: target.task, guarantees: target.guarantees, inputs, artifacts, isComplete };
});

const recordedQualifications = Effect.fn('recordedQualifications')(function* (): Effect.fn.Return<
  ReadonlyArray<Qualification>,
  InputUnreadable
> {
  if (!existsSync(GREEN_QUALIFICATION)) {
    return [];
  }

  return yield* decodeFile({ path: GREEN_QUALIFICATION, schema: Qualifications });
});
