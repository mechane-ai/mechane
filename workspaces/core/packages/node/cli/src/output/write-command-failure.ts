import type { WriteFailureInput } from '@mechane/cli-kernel';
import { OutputMode, PROGRAM } from '@mechane/commands';
import { writeDiagnostic, writeResult } from '@mechane/program';
import { Option } from 'effect';
import { RecordKind } from './constants.ts';
import { renderDocument } from './render-document.ts';
import { renderLine } from './render-line.ts';

/** Writes the diagnostic to standard error and, for a program reading standard output, the error record there. */
export function writeCommandFailure({ output, command, report }: WriteFailureInput): void {
  writeDiagnostic({ program: PROGRAM, line: report.diagnostic });

  for (const line of failureLines({ output, command, report })) {
    writeResult({ line });
  }
}

/** The lines that write a failure's error record in its output mode: none for a person, who reads the diagnostic. */
function failureLines({ output, command, report }: WriteFailureInput): ReadonlyArray<string> {
  const { record } = report;

  switch (output) {
    case OutputMode.Human:
      return [];
    case OutputMode.Json:
      return [renderDocument({ command, result: Option.none(), errors: [record] })];
    case OutputMode.Jsonl:
      return [renderLine({ line: { record: RecordKind.Error, command, error: record } })];
  }
}
