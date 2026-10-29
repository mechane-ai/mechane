import { siteKey } from '@mechane/checks-kernel';
import type { Finding, TextFile } from '@mechane/checks-kernel';

/** An action reference pinned to an immutable commit, such as `actions/checkout@<40 hex digits>`. */
const PINNED_ACTION = /^\s*-?\s*uses:\s*[\w.-]+\/[\w./-]+@[0-9a-f]{40}(\s|$)/;

/** A step that uses an action. */
const ACTION_STEP = /^\s*-?\s*uses:/;

/** The key that declares a workflow's permissions at the start of a line. */
const PERMISSIONS_KEY = 'permissions:';

/** Checks that a workflow declares its permissions and pins every action to a full commit. */
export function workflowFindings({ path, text }: TextFile): ReadonlyArray<Finding> {
  const lines = text.split('\n');

  /** The finding of a step whose action is not pinned to a full commit, by its place among the lines. */
  const unpinnedFindings: (line: string, index: number) => ReadonlyArray<Finding> = (line, index) => {
    if (!ACTION_STEP.test(line) || PINNED_ACTION.test(line)) {
      return [];
    }

    return [
      {
        check: 'workflows',
        location: siteKey({ file: path, line: index + 1 }),
        message:
          'Pin the action to a full commit hash, such as `actions/checkout@08eba0b27e820071cde6df949e0beb9ba4906955`',
      },
    ];
  };

  const unpinned = lines.flatMap(unpinnedFindings);

  if (lines.some((line) => line.startsWith(PERMISSIONS_KEY))) {
    return unpinned;
  }

  return [
    ...unpinned,
    {
      check: 'workflows',
      location: path,
      message: 'Declare the permissions the workflow needs, such as `permissions: { contents: read }`',
    },
  ];
}
