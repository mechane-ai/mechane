import { GIT_OBJECT_ID_PATTERN, HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';

const ZERO_ID = /^0+$/u;
const FORBIDDEN_BRANCH_CHARACTERS: ReadonlySet<string> = new Set(['~', '^', ':', '?', '*', '[', '\\']);
const COMMAND_FIELDS = 3;
const CAPABILITY_FIELDS = 2;
const SHALLOW = /^shallow (?:[a-f0-9]{40}|[a-f0-9]{64})$/u;

type CommandInput = {
  readonly payload: Uint8Array;
  readonly allowedRefs: ReadonlyArray<string>;
  readonly isFirst: boolean;
};

export class GitPushRejected extends Schema.TaggedError<GitPushRejected>()('GitPushRejected', {
  status: Schema.Int,
  reason: Schema.String,
}) {}

export function invalidGitPush(): GitPushRejected {
  return new GitPushRejected({ status: HttpStatusCode.BadRequest, reason: 'Invalid Git receive-pack command' });
}

export function oversizedGitPush(): GitPushRejected {
  return new GitPushRejected({ status: HttpStatusCode.PayloadTooLarge, reason: 'Git push exceeds the transfer limit' });
}

function validBranch(reference: string): boolean {
  if (!reference.startsWith('refs/heads/') || reference.endsWith('.') || reference.includes('..')) {
    return false;
  }

  const forbidden = Array.from(reference).some(
    (char) => char <= ' ' || char === '\u007F' || FORBIDDEN_BRANCH_CHARACTERS.has(char),
  );

  if (reference.includes('@{') || forbidden) {
    return false;
  }

  return reference.split('/').every((part) => part.length > 0 && !part.startsWith('.') && !part.endsWith('.lock'));
}

function readCommandText(payload: Uint8Array): string {
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

  try {
    return decoder.decode(payload).replace(/\n$/u, '');
  } catch {
    throw invalidGitPush();
  }
}

export function validatePushCommand({ payload, allowedRefs, isFirst }: CommandInput): boolean {
  const line = readCommandText(payload);

  if (isFirst && SHALLOW.test(line)) {
    return false;
  }

  const parts = line.split('\0');

  if (parts.length > CAPABILITY_FIELDS || (!isFirst && parts.length > 1)) {
    throw invalidGitPush();
  }

  const [command, capabilities] = parts;

  if (command === undefined || (capabilities !== undefined && /[^ -~]/u.test(capabilities))) {
    throw invalidGitPush();
  }

  const fields = command.split(' ');
  const [expectedId, targetId, reference] = fields;

  if (fields.length !== COMMAND_FIELDS) {
    throw invalidGitPush();
  }

  if (expectedId === undefined || targetId === undefined || reference === undefined) {
    throw invalidGitPush();
  }

  if (
    !GIT_OBJECT_ID_PATTERN.test(expectedId) ||
    !GIT_OBJECT_ID_PATTERN.test(targetId) ||
    expectedId.length !== targetId.length
  ) {
    throw invalidGitPush();
  }

  const permitted = allowedRefs.some((entry) => {
    if (entry.endsWith('/')) {
      return reference.startsWith(entry);
    }

    return reference === entry;
  });

  if (ZERO_ID.test(targetId) || !validBranch(reference) || !permitted) {
    throw new GitPushRejected({ status: HttpStatusCode.Forbidden, reason: 'Git branch update is not permitted' });
  }

  return true;
}
