import type { WriteFailureInput } from '@mechane/cli-kernel';
import type { ExitStatus } from '@mechane/commands';
import { writeCommandFailure } from '../output/write-command-failure.ts';

/** Writes a failed run's diagnostic and error record, and answers the exit status its report calls for. */
export function reportFailure({ output, command, report }: WriteFailureInput): ExitStatus {
  writeCommandFailure({ output, command, report });

  return report.status;
}
