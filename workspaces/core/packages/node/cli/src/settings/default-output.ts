import { DEFAULT_OUTPUT } from '@mechane/commands';
import type { CommandShape, OutputMode } from '@mechane/commands';

type DefaultOutputInput = { readonly isTerminal: boolean; readonly shape: CommandShape };

/**
 * The output mode for where standard output goes and the command's shape, when neither `--output` nor its variable
 * names one.
 */
export function defaultOutput({ isTerminal, shape }: DefaultOutputInput): OutputMode {
  if (isTerminal) {
    return DEFAULT_OUTPUT.onTerminal;
  }

  return DEFAULT_OUTPUT.elsewhere[shape];
}
