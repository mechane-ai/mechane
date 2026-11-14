import { jsonFileText, replaceFile } from '@mechane/program';
import { NotificationReceipt } from '@mechane/protocol';
import { Sequence } from '@mechane/records';
import { Array, Effect, Option, Schema } from 'effect';
import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  CleanupRecord,
  ConnectionRecord,
  EvalAuditManifest,
  EvalManifest,
  EvalStageFailure,
  EvidenceRecord,
  GradeSubmission,
  Observation,
  RoleIntent,
  RoleReceipt,
  RoleRecord,
  StructuredGradeRecord,
} from '../application-schemas.ts';
import type { EvalTrial, EvalTrialId } from '../application-schemas.ts';
import type { ApplicationTrialFiles, EvalTrialSnapshot, SavedEval } from '../application-types.ts';
import { EvalAuditKind, EvalFileStep, EvalRole, EvalScope } from '../constants.ts';
import { validateEvidenceRecord } from '../create-evidence-record.ts';
import { EvalAdapterFailed, EvalAdapterOperation, EvalFileFailed, EvalManifestMissing } from '../errors.ts';
import { EvalInspection } from '../report/inspection-schemas.ts';
import type { EvalId } from '../schemas.ts';
import type { EvalRunFailure, OnceFile } from '../types.ts';
import { ApplicationFile, ApplicationFolder, RECORD_MODE, WRITER_FILES } from './constants.ts';
import { digestManifest } from './encode-eval-records.ts';
import { onceFile } from './once-file.ts';
import { readJudgeRecords } from './read-judge-records.ts';

type ApplicationStoreInput = { readonly outFolder: string };
type TrialFilesInput = { readonly folder: string };
type TrialInput = { readonly trialId: EvalTrialId };
type AuditManifestInput = { readonly auditId: EvalId };
type AuditInput = TrialInput & AuditManifestInput;
type SaveProjectionInput = { readonly projection: EvalInspection };
type NumberedRecordsInput<S extends Schema.Codec<unknown, unknown>> = { readonly folder: string; readonly schema: S };
type StoredRecordInput<S extends Schema.Codec<unknown, unknown>> = NumberedRecordsInput<S> & { readonly name: string };

type SaveNumberedRecordInput<S extends Schema.Codec<unknown, unknown>> = NumberedRecordsInput<S> & {
  readonly sequence: Sequence;
  readonly record: S['Type'];
};

type ReadTrialsInput = { readonly store: ApplicationStore; readonly manifest: EvalManifest };
type ReadTrialInput = { readonly store: ApplicationStore; readonly trial: EvalTrial };

type ReadAuditInput = ApplicationStoreInput & {
  readonly envelope: EvalAuditManifest;
  readonly trials: ReadonlyArray<EvalTrialSnapshot>;
};

type ValidateManifestInput = { readonly manifest: EvalManifest };

export type ApplicationStore = {
  readonly outFolder: string;
  readonly manifest: OnceFile<EvalManifest>;
  readonly trial: (input: TrialInput) => ApplicationTrialFiles;
  readonly audit: (input: AuditInput) => ApplicationTrialFiles;
  readonly auditManifest: (input: AuditManifestInput) => OnceFile<EvalAuditManifest>;
  readonly saveProjection: (input: SaveProjectionInput) => Effect.Effect<void, EvalFileFailed>;
};

const SEQUENCE_DIGITS = 6;
const RECORD_NAME_PATTERN = /^\d{6}\.json$/u;
const MISSING_FOLDER_CODE = 'ENOENT';
const MissingFolder = Schema.Struct({ code: Schema.Literal(MISSING_FOLDER_CODE) });
const ManifestEnvelope = Schema.Union([EvalManifest, EvalAuditManifest]);

const ConnectionFile = {
  [EvalRole.Subject]: ApplicationFile.SubjectConnection,
  [EvalRole.Judge]: ApplicationFile.JudgeConnection,
} as const;

class RecordFolderUnreadable extends Schema.TaggedError<RecordFolderUnreadable>()('RecordFolderUnreadable', {
  path: Schema.String,
  error: Schema.Unknown,
}) {}

export function applicationStore({ outFolder }: ApplicationStoreInput): ApplicationStore {
  const manifest = storedRecord({ folder: outFolder, name: ApplicationFile.Manifest, schema: EvalManifest });
  const reportPath = join(outFolder, ApplicationFile.Report);
  const accept = Option.none();

  const trial: ApplicationStore['trial'] = ({ trialId }) => {
    const folder = join(outFolder, ApplicationFolder.Trials, trialId);

    return applicationTrialFiles({ folder });
  };

  const audit: ApplicationStore['audit'] = ({ auditId, trialId }) => {
    const folder = join(outFolder, ApplicationFolder.Audits, auditId, ApplicationFolder.Trials, trialId);

    return applicationTrialFiles({ folder });
  };

  const auditManifest: ApplicationStore['auditManifest'] = ({ auditId }) => {
    const folder = join(outFolder, ApplicationFolder.Audits, auditId);

    return storedRecord({ folder, name: ApplicationFile.Manifest, schema: EvalAuditManifest });
  };

  const saveProjection: ApplicationStore['saveProjection'] = ({ projection }) => {
    const contents = jsonFileText({ schema: EvalInspection, value: projection });

    return replaceFile({ path: reportPath, contents, mode: RECORD_MODE, accept }).pipe(
      Effect.mapError(({ step, path, reason }) => new EvalFileFailed({ step, path, reason })),
    );
  };

  return { outFolder, manifest, trial, audit, auditManifest, saveProjection };
}

export const ensureFreshApplicationStore = Effect.fn('ensureFreshApplicationStore')(function* ({
  outFolder,
}: ApplicationStoreInput): Effect.fn.Return<void, EvalRunFailure> {
  const names = yield* Effect.tryPromise({
    try: () => readdir(outFolder),
    catch: (cause) => new EvalFileFailed({ step: EvalFileStep.Read, path: outFolder, reason: String(cause) }),
  });

  if (names.some((name) => !WRITER_FILES.has(name))) {
    return yield* new EvalAdapterFailed({
      operation: EvalAdapterOperation.StartEval,
      reason: 'The output directory contains existing records; inspect them or choose a new directory',
    });
  }
});

function storedRecord<S extends Schema.Codec<unknown, unknown>>({
  folder,
  name,
  schema,
}: StoredRecordInput<S>): OnceFile<S['Type']> {
  const path = join(folder, name);

  return onceFile({ path, schema });
}

function applicationTrialFiles({ folder }: TrialFilesInput): ApplicationTrialFiles {
  const observationsFolder = join(folder, ApplicationFolder.Observations);
  const judgeObservationsFolder = join(folder, ApplicationFolder.JudgeObservations);
  const cleanupFolder = join(folder, ApplicationFolder.Cleanup);
  const failuresFolder = join(folder, ApplicationFolder.Failures);

  return {
    folder,
    subjectIntent: storedRecord({ folder, name: ApplicationFile.SubjectIntent, schema: RoleIntent }),
    subjectReceipt: storedRecord({ folder, name: ApplicationFile.SubjectReceipt, schema: RoleReceipt }),
    subjectNotification: storedRecord({
      folder,
      name: ApplicationFile.SubjectNotification,
      schema: NotificationReceipt,
    }),
    subject: storedRecord({ folder, name: ApplicationFile.Subject, schema: RoleRecord }),
    evidence: storedRecord({ folder, name: ApplicationFile.Evidence, schema: EvidenceRecord }),
    judgeIntent: storedRecord({ folder, name: ApplicationFile.JudgeIntent, schema: RoleIntent }),
    judgeReceipt: storedRecord({ folder, name: ApplicationFile.JudgeReceipt, schema: RoleReceipt }),
    judgeNotification: storedRecord({ folder, name: ApplicationFile.JudgeNotification, schema: NotificationReceipt }),
    judge: storedRecord({ folder, name: ApplicationFile.Judge, schema: RoleRecord }),
    submission: storedRecord({ folder, name: ApplicationFile.Submission, schema: GradeSubmission }),
    grade: storedRecord({ folder, name: ApplicationFile.Grade, schema: StructuredGradeRecord }),
    connection: ({ role }) => storedRecord({ folder, name: ConnectionFile[role], schema: ConnectionRecord }),
    readObservations: () => readNumberedRecords({ folder: observationsFolder, schema: Observation }),
    saveObservation: ({ observation }) =>
      saveNumberedRecord({
        folder: observationsFolder,
        schema: Observation,
        sequence: observation.sequence,
        record: observation,
      }),
    readJudgeObservations: () => readNumberedRecords({ folder: judgeObservationsFolder, schema: Observation }),
    saveJudgeObservation: ({ observation }) =>
      saveNumberedRecord({
        folder: judgeObservationsFolder,
        schema: Observation,
        sequence: observation.sequence,
        record: observation,
      }),
    readCleanup: () => readNumberedRecords({ folder: cleanupFolder, schema: CleanupRecord }),
    saveCleanup: ({ cleanup }) => {
      const sequence = Sequence.make(cleanup.attempt);

      return saveNumberedRecord({ folder: cleanupFolder, schema: CleanupRecord, sequence, record: cleanup });
    },
    readFailures: () => readNumberedRecords({ folder: failuresFolder, schema: EvalStageFailure }),
    saveFailure: ({ failure }) =>
      saveNumberedRecord({
        folder: failuresFolder,
        schema: EvalStageFailure,
        sequence: failure.sequence,
        record: failure,
      }),
  };
}

const saveNumberedRecord = Effect.fn('saveNumberedRecord')(function* <S extends Schema.Codec<unknown, unknown>>({
  folder,
  schema,
  sequence,
  record,
}: SaveNumberedRecordInput<S>): Effect.fn.Return<void, EvalRunFailure> {
  const digits = String(sequence);
  const name = `${digits.padStart(SEQUENCE_DIGITS, '0')}.json`;
  const file = storedRecord({ folder, name, schema });

  yield* file.create({ record });
});

const readNumberedRecords = Effect.fn('readNumberedRecords')(function* <S extends Schema.Codec<unknown, unknown>>({
  folder,
  schema,
}: NumberedRecordsInput<S>): Effect.fn.Return<ReadonlyArray<S['Type']>, EvalRunFailure> {
  const names = yield* Effect.tryPromise({
    try: () => readdir(folder),
    catch: (cause) => new RecordFolderUnreadable({ path: folder, error: cause }),
  }).pipe(
    Effect.catchTags({
      RecordFolderUnreadable: ({ error, path }) => {
        if (Schema.is(MissingFolder)(error)) {
          return Effect.succeed<ReadonlyArray<string>>([]);
        }

        const reason = String(error);

        return new EvalFileFailed({ step: EvalFileStep.Read, path, reason });
      },
    }),
  );

  const sorted = names
    .filter((name) => RECORD_NAME_PATTERN.test(name))
    .toSorted((left, right) => left.localeCompare(right));

  const records = yield* Effect.forEach(
    sorted,
    (name) => {
      const file = storedRecord({ folder, name, schema });

      return file.read();
    },
    { concurrency: 1 },
  );

  return Array.getSomes(records);
});

/** Reads canonical saved stages and verifies their frozen manifest before inspection or resume. */
export const readEval = Effect.fn('readEval')(function* ({
  outFolder,
}: ApplicationStoreInput): Effect.fn.Return<SavedEval, EvalRunFailure> {
  const store = applicationStore({ outFolder });
  const manifestFile = onceFile({ path: store.manifest.path, schema: ManifestEnvelope });
  const saved = yield* manifestFile.read();

  if (Option.isNone(saved)) {
    return yield* new EvalManifestMissing({ outFolder });
  }

  const envelope = saved.value;

  const manifest: EvalManifest = (() => {
    if ('version' in envelope) {
      return envelope;
    }

    return envelope.manifest;
  })();

  yield* validateManifestDigest({ manifest });

  const trials = yield* readTrials({ store, manifest });

  if ('version' in envelope) {
    return { manifest, trials, scope: EvalScope.Full, isAudit: false };
  }

  return yield* readAuditEval({ outFolder, envelope, trials });
});

const validateManifestDigest = Effect.fn('validateManifestDigest')(function* ({
  manifest,
}: ValidateManifestInput): Effect.fn.Return<void, EvalAdapterFailed> {
  const actualDigest = digestManifest({ manifest });

  if (actualDigest !== manifest.digest) {
    return yield* new EvalAdapterFailed({
      operation: EvalAdapterOperation.ReadManifest,
      reason: 'The manifest contents do not match their recorded digest',
    });
  }
});

const readAuditEval = Effect.fn('readAuditEval')(function* ({
  outFolder,
  envelope,
  trials,
}: ReadAuditInput): Effect.fn.Return<SavedEval, EvalRunFailure> {
  const { manifest, sourceDigest } = envelope;
  const saved = { manifest, trials, scope: EvalScope.JudgeOnly, isAudit: true };

  if (envelope.kind !== EvalAuditKind.Regrade || Option.isNone(sourceDigest)) {
    return saved;
  }

  const sourceFolder = resolve(outFolder, '../..');
  const sourceStore = applicationStore({ outFolder: sourceFolder });
  const sourceManifest = yield* sourceStore.manifest.read();

  if (Option.isNone(sourceManifest) || sourceManifest.value.digest !== sourceDigest.value) {
    return saved;
  }

  yield* validateManifestDigest({ manifest: sourceManifest.value });

  const sourceTrials = yield* readTrials({ store: sourceStore, manifest: sourceManifest.value });

  const merged = trials.map((trial) => {
    const source = Array.findFirst(sourceTrials, (candidate) => candidate.trial.id === trial.trial.id);

    if (Option.isNone(source)) {
      return trial;
    }

    return {
      ...trial,
      subjectIntent: source.value.subjectIntent,
      subjectReceipt: source.value.subjectReceipt,
      subject: source.value.subject,
      observations: source.value.observations,
    };
  });

  return { manifest, trials: merged, scope: EvalScope.Full, isAudit: true };
});

const readTrials = Effect.fn('readTrials')(function* ({
  store,
  manifest,
}: ReadTrialsInput): Effect.fn.Return<ReadonlyArray<EvalTrialSnapshot>, EvalRunFailure> {
  return yield* Effect.forEach(manifest.trials, (trial) => readTrialSnapshot({ store, trial }), { concurrency: 1 });
});

const readTrialSnapshot = Effect.fn('readTrialSnapshot')(function* ({
  store,
  trial,
}: ReadTrialInput): Effect.fn.Return<EvalTrialSnapshot, EvalRunFailure> {
  const files = store.trial({ trialId: trial.id });
  const evidence = yield* files.evidence.read();

  if (Option.isSome(evidence)) {
    yield* validateEvidenceRecord({ evidence: evidence.value });
  }

  const subjectIntent = yield* files.subjectIntent.read();
  const subjectReceipt = yield* files.subjectReceipt.read();
  const subject = yield* files.subject.read();
  const observations = yield* files.readObservations();
  const judgeRecords = yield* readJudgeRecords({ files });

  return { trial, subjectIntent, subjectReceipt, subject, observations, evidence, ...judgeRecords };
});
