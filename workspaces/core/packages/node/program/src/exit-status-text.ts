import { Option } from 'effect';

/** What a diagnostic says a process exited with when a signal ended it, where another names its status. */
const SIGNAL_EXIT = 'by a signal';

type ExitStatusTextInput = {
  /** None when a signal ended the process. */
  readonly status: Option.Option<number>;
};

/** How a process exited, as a diagnostic says it after "exited": its status, or that a signal ended it. */
export function exitStatusText({ status }: ExitStatusTextInput): string {
  return Option.match(status, { onNone: () => SIGNAL_EXIT, onSome: String });
}
