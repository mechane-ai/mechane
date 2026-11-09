import { HttpMethod } from '@mechane/records';
import type { SandboxExecutionResult } from '@mechane/sandbox-wire';
import { Record } from 'effect';
import { sleep } from 'workflow';
import { executionId } from '../execution-id.ts';
import type { RuntimeStore } from '../store/database.ts';
import { withRuntimeStore } from '../store/runtime-store.ts';
import { ToolUnavailableError } from './errors.ts';
import { requestSandboxExecution } from './sandbox-client.ts';

const IMPORT_PURPOSE = 'note_import';
const IMPORT_POLL_MS = 1000;
const IMPORT_MAX_POLLS = 300;
const IMPORT_TIMEOUT_MS = 60_000;
const PAYLOAD_CHUNK_CHARACTERS = 49_152;
const PAYLOAD_MAX_CHARACTERS = 786_432;
const JSON_INDENT_SPACES = 2;
const UNRESOLVED_RECEIPT_STATES: ReadonlySet<string> = new Set(['failed', 'uncertain']);

const NEEDS_ENVIRONMENT: ReadonlySet<SandboxExecutionResult['_tag']> = new Set([
  'ExecutionNotFound',
  'ExecutionEnvironmentRequired',
]);

type ImportInput = { readonly runId: string };

type ImportState = ImportInput & {
  readonly index: number;
  readonly manifest: string | null;
  readonly polls: number;
  readonly isComplete: boolean;
};

type StoredNotes = NonNullable<Awaited<ReturnType<RuntimeStore['getStoredNoteImport']>>>;
type SourceNote = { readonly kind: 'memory' | 'work'; readonly text: string };
type ImportedNote = SourceNote & { readonly digest: string };

type NoteExecution = {
  readonly store: RuntimeStore;
  readonly workspaceId: string;
  readonly mechId: string;
  readonly runId: string;
  readonly executionId: string;
  readonly note: ImportedNote;
};

/** Source text stays inside trusted steps; Workflow checkpoints contain only its digest and cursor. */
export async function importExistingNotes({ runId }: ImportInput): Promise<void> {
  let progress: ImportState = { runId, index: 0, manifest: null, polls: 0, isComplete: false };

  while (!progress.isComplete) {
    progress = await advanceNoteImport(progress);

    if (!progress.isComplete && progress.polls > 0) {
      await sleep(IMPORT_POLL_MS);
    }
  }
}

async function advanceNoteImport(input: ImportState): Promise<ImportState> {
  'use step';

  const { createHash } = await import('node:crypto');

  return await withRuntimeStore(async (store) => {
    const source = await store.getStoredNoteImport(input);

    if (source === null) {
      return { ...input, isComplete: true };
    }

    const manifest = createHash('sha256').update(JSON.stringify(source)).digest('hex');

    if (input.manifest !== null && input.manifest !== manifest) {
      throw new ToolUnavailableError('The preserved notes changed during import. Their SQL originals remain intact.');
    }

    const note = sourceNotes(source)[input.index];

    if (note === undefined) {
      await store.markNotesImported(input);

      return { ...input, manifest, isComplete: true };
    }

    if (input.polls >= IMPORT_MAX_POLLS) {
      throw new ToolUnavailableError('The preserved notes could not be committed before the import deadline.');
    }

    const run = await store.getRun(input);

    if (run === null) {
      throw new ToolUnavailableError('The activation no longer exists.');
    }

    const digest = createHash('sha256').update(note.kind).update('\n').update(note.text).digest('hex');
    const id = await executionId({ runId: input.runId, toolCallId: noteImportKey({ digest }) });

    const isCommitted = await importNoteToHome({
      store,
      workspaceId: run.workspaceId,
      mechId: run.mechId,
      runId: run.id,
      executionId: id,
      note: { ...note, digest },
    });

    if (isCommitted) {
      return { ...input, manifest, index: input.index + 1, polls: 0 };
    }

    return { ...input, manifest, polls: input.polls + 1 };
  });
}

function sourceNotes({ memories, workItems }: StoredNotes): ReadonlyArray<SourceNote> {
  const memory = memories.map((record) => ({
    kind: 'memory' as const,
    text: `${JSON.stringify(record, null, JSON_INDENT_SPACES)}\n`,
  }));

  const work = workItems.map((record) => ({
    kind: 'work' as const,
    text: `${JSON.stringify(record, null, JSON_INDENT_SPACES)}\n`,
  }));

  return [...memory, ...work];
}

async function importNoteToHome(input: NoteExecution): Promise<boolean> {
  const { store, executionId: id } = input;
  const begun = await store.beginExecution({ id, runId: input.runId, kind: 'sandbox' });

  if (begun.receipt.status === 'completed') {
    if (
      begun.receipt.result?.['purpose'] !== IMPORT_PURPOSE ||
      begun.receipt.result['digest'] !== input.note.digest ||
      begun.receipt.result['status'] !== 'imported'
    ) {
      throw new ToolUnavailableError('The note import receipt does not match its source.');
    }

    return true;
  }

  if (UNRESOLVED_RECEIPT_STATES.has(begun.receipt.status)) {
    throw new ToolUnavailableError('The note import has an unresolved execution. Its source remains intact.');
  }

  const progress = await requestSandboxExecution({ ...input, method: HttpMethod.Get });

  if (!NEEDS_ENVIRONMENT.has(progress._tag)) {
    return await recordImportProgress({ ...input, progress });
  }

  await requireImportAuthority(input);
  await store.finishExecution({
    id,
    status: 'running',
    providerId: id,
    result: { purpose: IMPORT_PURPOSE, digest: input.note.digest },
  });

  const environment = { variables: noteEnvironment(input.note), secrets: {} };

  const body = JSON.stringify({
    command: IMPORT_NOTE_COMMAND,
    timeoutMs: IMPORT_TIMEOUT_MS,
    waitMs: 5000,
    environment,
  });

  const observed = await requestSandboxExecution({ ...input, method: HttpMethod.Post, body });

  return await recordImportProgress({ ...input, progress: observed });
}

async function requireImportAuthority({ store, workspaceId, mechId, runId }: NoteExecution): Promise<void> {
  const run = await store.getRun({ runId, workspaceId });
  const mech = await store.getMech({ workspaceId, mechId });
  const policy = await store.getRuntimePolicy({ workspaceId });

  const isRunActive = run !== null && run.status === 'running' && run.cancelRequestedAt === null;

  if (!isRunActive || mech.status !== 'active') {
    throw new ToolUnavailableError('The activation no longer owns its note import.');
  }

  const isPolicyActive = policy !== null && !policy.isSuspended;
  const hasSandboxCapacity = policy !== null && policy.hasSandboxes && policy.machines > 0;

  if (!isPolicyActive || !hasSandboxCapacity) {
    throw new ToolUnavailableError('Importing preserved notes requires the mech’s existing sandbox permission.');
  }
}

type RecordImportProgress = NoteExecution & { readonly progress: SandboxExecutionResult };

async function recordImportProgress({
  store,
  executionId: id,
  note,
  progress,
}: RecordImportProgress): Promise<boolean> {
  if (progress._tag === 'Running') {
    return false;
  }

  if (
    progress._tag === 'Exited' &&
    progress.exitCode === 0 &&
    progress.output.text.trim() === JSON.stringify({ digest: note.digest })
  ) {
    await store.finishExecution({
      id,
      status: 'completed',
      providerId: id,
      result: { purpose: IMPORT_PURPOSE, digest: note.digest, status: 'imported' },
    });

    return true;
  }

  if (progress._tag === 'ExecutionEnvironmentRequired') {
    return false;
  }

  await store.finishExecution({
    id,
    status: importFailureStatus({ progress }),
    providerId: id,
    result: { purpose: IMPORT_PURPOSE, digest: note.digest, status: progress._tag },
  });

  throw new ToolUnavailableError('A preserved note was not committed. Existing files and SQL originals were retained.');
}

function importFailureStatus({ progress }: { readonly progress: SandboxExecutionResult }): 'uncertain' | 'failed' {
  if (progress._tag === 'Uncertain') {
    return 'uncertain';
  }

  return 'failed';
}

function noteEnvironment(note: ImportedNote): Readonly<Record<string, string>> {
  const encoded = Buffer.from(JSON.stringify(note), 'utf8').toString('base64');

  if (encoded.length > PAYLOAD_MAX_CHARACTERS) {
    throw new ToolUnavailableError('A preserved note exceeds the safe environment transfer limit.');
  }

  const chunks = Array.from(
    { length: Math.ceil(encoded.length / PAYLOAD_CHUNK_CHARACTERS) },
    (_, index) =>
      [
        notePayloadName({ index }),
        encoded.slice(index * PAYLOAD_CHUNK_CHARACTERS, (index + 1) * PAYLOAD_CHUNK_CHARACTERS),
      ] as const,
  );

  return Record.fromEntries([...chunks, ['MECHANE_NOTE_IMPORT_COUNT', String(chunks.length)] as const]);
}

function notePayloadName({ index }: { readonly index: number }): string {
  return `MECHANE_NOTE_IMPORT_${index}`;
}

function noteImportKey({ digest }: { readonly digest: string }): string {
  return `note-import:${digest}`;
}

const IMPORT_NOTE_COMMAND = String.raw`node <<'MECHANE_NOTE_IMPORT_SCRIPT'
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
function directory(parent, name) {
  const target = path.join(parent, name);
  try {
    fs.mkdirSync(target);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('unsafe import directory');
  return target;
}
function importNote() {
  const count = Number(process.env.MECHANE_NOTE_IMPORT_COUNT);
  if (!Number.isInteger(count) || count < 1 || count > 16) throw new Error('invalid transfer size');
  const encoded = Array.from({ length: count }, (_, index) => process.env['MECHANE_NOTE_IMPORT_' + index]).join('');
  const note = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
  if (!['memory', 'work'].includes(note.kind) || !/^[0-9a-f]{64}$/.test(note.digest)) throw new Error('invalid source');
  const digest = crypto.createHash('sha256').update(note.kind).update('\n').update(note.text).digest('hex');
  if (digest !== note.digest) throw new Error('source digest mismatch');
  const notes = directory(os.homedir(), 'notes');
  const imported = directory(notes, 'imported');
  const root = directory(imported, note.kind);
  const target = path.join(root, note.digest + '.json');
  const bytes = Buffer.from(note.text, 'utf8');
  if (alreadyImported(target, bytes)) return note.digest;
  const temporary = fs.mkdtempSync(path.join(root, '.import-'));
  const pending = path.join(temporary, 'note');
  try {
    fs.writeFileSync(pending, bytes, { flag: 'wx', mode: 0o600 });
    try {
      fs.linkSync(pending, target);
    } catch (error) {
      if (error.code !== 'EEXIST' || !alreadyImported(target, bytes)) throw error;
    }
  } finally {
    fs.rmSync(temporary, { recursive: true });
  }
  return note.digest;
}
function alreadyImported(target, bytes) {
  if (!fs.existsSync(target)) return false;
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink() || !stat.isFile() || !fs.readFileSync(target).equals(bytes)) throw new Error('existing file differs');
  return true;
}
try {
  console.log(JSON.stringify({ digest: importNote() }));
} catch {
  console.error('The preserved note could not be saved without replacing an existing file.');
  process.exitCode = 1;
}
MECHANE_NOTE_IMPORT_SCRIPT`;
