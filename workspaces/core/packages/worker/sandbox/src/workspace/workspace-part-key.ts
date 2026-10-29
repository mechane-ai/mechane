import { Option } from 'effect';

/** The fixed width of archive part numbers in object keys. */
const WORKSPACE_PART_DIGITS = 6;

type WorkspacePartKeyInput = {
  readonly owner: string;
  readonly generation: string;
  /** Absent when the operation addresses the complete generation. */
  readonly part: Option.Option<number>;
};

/** Builds the portable R2 key or generation prefix for one sandbox archive. */
export function workspacePartKey({ owner, generation, part }: WorkspacePartKeyInput): string {
  const index = workspacePartIndex({ part });

  return `sandboxes/${owner}/${generation}/${index}`;
}

function workspacePartIndex({ part }: Pick<WorkspacePartKeyInput, 'part'>): string {
  if (Option.isNone(part)) {
    return '';
  }

  return part.value.toString().padStart(WORKSPACE_PART_DIGITS, '0');
}
