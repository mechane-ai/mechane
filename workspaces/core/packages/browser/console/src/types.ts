import type { ListQuery, ManagedEvent } from '@mechane/console-data';

/** Only shareable record selections go in the URL. */
export type ConsoleLocation = ListQuery & {
  /** Absent selects the remembered workspace or opens the workspace chooser. */
  readonly workspace?: string;
  /** Managed resource selections resolve under the selected installation and workspace. */
  readonly agent?: string;
  readonly session?: string;
  readonly isSessionEvidence?: true;
  readonly thread?: string;
  /** Links to a processed session event retain its timestamp cutoff when later pages arrive. */
  readonly through?: string;
  readonly eventId?: ManagedEvent['id'];
  /** Service-issued opaque cursor; omission selects the first page. */
  readonly page?: string;
  /** Absent leaves the session gallery visible without opening one capture. */
  readonly artifact?: string;
  /** Absent opens the managed directory; 'definition' opens Workspace Settings; 'files' opens Files. */
  readonly view?: 'definition' | 'files';
};

/** The current shareable selection and its router transition. */
export type ConsoleNavigation = {
  readonly location: ConsoleLocation;
  readonly navigate: (location: ConsoleLocation) => void;
};

/** History restores pixel offsets inside the named scrolling region, independently of the document. */
export type ReaderPosition = { readonly region: string; readonly top: number; readonly left: number };
