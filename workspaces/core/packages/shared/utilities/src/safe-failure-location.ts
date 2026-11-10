import { Array, Option, Predicate, Result } from 'effect';

const FAILURE_STACK_MAX_FRAMES = 4;
const FAILURE_STACK_MAX_CHARACTERS = 8192;
const FAILURE_NAME_MAX_CHARACTERS = 64;
const STACK_LINE_CAPTURE = 2;
const STACK_COLUMN_CAPTURE = 3;
const STACK_FRAME = /^\s+at /u;
const STACK_LOCATION = /(?:^|[/\\\s(])([A-Za-z0-9_.-]+):([0-9]{1,7}):([0-9]{1,7})\)?\s*$/u;

type FailureLocation = { readonly name: string; readonly frames: ReadonlyArray<string> };

type FailureLocationInput = {
  readonly cause: unknown;
  readonly allowedNames: ReadonlySet<string>;
  readonly allowedFiles: ReadonlySet<string>;
};

type FailureNameInput = { readonly cause: Error; readonly allowedNames: ReadonlySet<string> };
type FailureFramesInput = { readonly stack: unknown; readonly allowedFiles: ReadonlySet<string> };
type FailureFrameInput = { readonly line: string; readonly allowedFiles: ReadonlySet<string> };
type FrameNameInput = { readonly file: string; readonly line: string; readonly column: string };

/** Error properties can throw, so diagnostics must remain safe even when inspecting an unfamiliar failure. */
export function safeFailureLocation({ cause, allowedNames, allowedFiles }: FailureLocationInput): FailureLocation {
  const location = Result.try(() => inspectFailureLocation({ cause, allowedNames, allowedFiles }));

  return Result.getOrElse(location, () => ({ name: 'UnknownFailure', frames: [] }));
}

function inspectFailureLocation({ cause, allowedNames, allowedFiles }: FailureLocationInput): FailureLocation {
  if (!Predicate.isError(cause)) {
    return { name: 'UnknownFailure', frames: [] };
  }

  const name = failureName({ cause, allowedNames });
  const frames = failureFrames({ stack: cause.stack, allowedFiles });

  return { name, frames };
}

function failureName({ cause, allowedNames }: FailureNameInput): string {
  const name: unknown = cause.name;

  if (typeof name === 'string' && name.length <= FAILURE_NAME_MAX_CHARACTERS && allowedNames.has(name)) {
    return name;
  }

  return 'Error';
}

function failureFrames({ stack, allowedFiles }: FailureFramesInput): ReadonlyArray<string> {
  if (typeof stack !== 'string') {
    return [];
  }

  const bounded = stack.slice(0, FAILURE_STACK_MAX_CHARACTERS);
  const lines = bounded.split('\n');
  const locations = Array.map(lines, (line) => failureFrame({ line, allowedFiles }));
  const frames = Array.getSomes(locations);

  return frames.slice(0, FAILURE_STACK_MAX_FRAMES);
}

function failureFrame({ line, allowedFiles }: FailureFrameInput): Option.Option<string> {
  if (!STACK_FRAME.test(line)) {
    return Option.none();
  }

  const fields = STACK_LOCATION.exec(line);
  const matched = Option.fromNullishOr(fields);

  return Option.flatMap(matched, (captures) => {
    const file = Option.fromNullishOr(captures[1]);
    const position = Option.fromNullishOr(captures[STACK_LINE_CAPTURE]);
    const column = Option.fromNullishOr(captures[STACK_COLUMN_CAPTURE]);
    const location = Option.all({ file, line: position, column });

    return Option.flatMap(location, (parts) => {
      if (!allowedFiles.has(parts.file)) {
        return Option.none();
      }

      const frame = failureFrameName(parts);

      return Option.some(frame);
    });
  });
}

function failureFrameName({ file, line, column }: FrameNameInput): string {
  const position = Number(line);
  const offset = Number(column);

  return `${file}:${position}:${offset}`;
}
