import { Option } from 'effect';

const ARCHIVE_PART_DIGITS = 6;

type ArchivePathInput = {
  /** None selects the archive prefix. */
  readonly part: Option.Option<number>;
};

/** One archive per VM bounds scratch disk use; the maintenance journal gates access by operation id. */
export function archivePath({ part }: ArchivePathInput): string {
  const root = '/tmp/.foundry-workspace';

  if (Option.isNone(part)) {
    return root;
  }

  return `${root}.part-${part.value.toString().padStart(ARCHIVE_PART_DIGITS, '0')}`;
}
