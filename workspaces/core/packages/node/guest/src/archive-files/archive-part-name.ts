const ARCHIVE_PART_DIGITS = 6;

type ArchivePartNameInput = { readonly part: number };

/** The fixed-width part filename used by both archive splitting and restoration. */
export function archivePartName({ part }: ArchivePartNameInput): string {
  const index = part.toString().padStart(ARCHIVE_PART_DIGITS, '0');

  return `part-${index}`;
}
