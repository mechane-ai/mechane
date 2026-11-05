import type { ConsoleView, Thread, Turn } from '@mechane/protocol';

/** Only shareable record selections go in the URL. */
export type ConsoleLocation = {
  /** Absent selects the remembered workspace or opens the workspace chooser. */
  readonly workspace?: string;
  /** Absent opens the workspace mech list. */
  readonly mech?: string;
  /** Absent opens the mech, before selecting one of its turns. */
  readonly turn?: string;
  /** Absent opens the mech's conversation. */
  readonly view?: ConsoleView;
  /** Absent opens the overview or the inspector section selected by an existing view link. */
  readonly inspect?: ConsoleView;
  /** Absent selects the first recorded request. */
  readonly request?: string;
  /** Absent starts the event history at its beginning. */
  readonly event?: number;
};

/** The current shareable selection and its router transition. */
export type ConsoleNavigation = {
  readonly location: ConsoleLocation;
  readonly navigate: (location: ConsoleLocation) => void;
};

/** Cursor trails retained by one browser history entry. */
export type PageCursors = {
  readonly mechs: ReadonlyArray<string>;
  readonly turns: ReadonlyArray<Turn['id']>;
  readonly activity: ReadonlyArray<number>;
  readonly events: ReadonlyArray<number>;
  readonly conversation: ReadonlyArray<number>;
  readonly work: ReadonlyArray<Thread['id']>;
};
