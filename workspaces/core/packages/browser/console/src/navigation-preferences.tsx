import type { Mech } from '@mechane/protocol';
import { MechId } from '@mechane/records';
import { Schema } from 'effect';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';

const RECENT_LIMIT = 5;
const preferencesSchema = Schema.Struct({ pinned: Schema.Array(MechId), recent: Schema.Array(MechId) });

type NavigationPreferences = { readonly pinned: ReadonlyArray<Mech['id']>; readonly recent: ReadonlyArray<Mech['id']> };

type PreferenceSnapshot = { readonly preferences: NavigationPreferences; readonly error: boolean };

type NavigationPreferenceState = NavigationPreferences & {
  readonly visit: (id: Mech['id']) => void;
  readonly togglePin: (id: Mech['id']) => void;
  readonly forget: (id: Mech['id']) => void;
  readonly persistenceError: boolean;
};

const NavigationPreferenceContext = createContext<NavigationPreferenceState | undefined>(undefined);

function readPreferences(key: string): PreferenceSnapshot {
  try {
    const stored = localStorage.getItem(key);

    if (stored === null) {
      return { preferences: { pinned: [], recent: [] }, error: false };
    }

    const decoded: unknown = JSON.parse(stored);

    if (Schema.is(preferencesSchema)(decoded)) {
      return {
        preferences: {
          pinned: [...new Set(decoded.pinned)],
          recent: [...new Set(decoded.recent)].slice(0, RECENT_LIMIT),
        },
        error: false,
      };
    }
  } catch {
    // Navigation remains available when the browser blocks preference storage.
  }

  return { preferences: { pinned: [], recent: [] }, error: true };
}

function writePreferences(key: string, preferences: NavigationPreferences): PreferenceSnapshot {
  try {
    localStorage.setItem(key, JSON.stringify(preferences));

    return { preferences, error: false };
  } catch {
    return { preferences, error: true };
  }
}

export function NavigationPreferenceProvider({
  principalId,
  workspaceId,
  children,
}: {
  readonly principalId: string;
  readonly workspaceId: string;
  readonly children: ReactNode;
}): ReactNode {
  const storageKey = `mechane:navigation:${principalId}:${workspaceId}`;

  return (
    <NavigationPreferenceOwner key={storageKey} storageKey={storageKey}>
      {children}
    </NavigationPreferenceOwner>
  );
}

function NavigationPreferenceOwner({
  storageKey,
  children,
}: {
  readonly storageKey: string;
  readonly children: ReactNode;
}): ReactNode {
  const [snapshot, setSnapshot] = useState(() => readPreferences(storageKey));
  const latest = useRef(snapshot);

  const { preferences, error: persistenceError } = snapshot;

  const save = useCallback(
    (next: NavigationPreferences): void => {
      const saved = writePreferences(storageKey, next);

      latest.current = saved;

      setSnapshot(saved);
    },
    [storageKey],
  );

  const visit = useCallback(
    (id: Mech['id']): void => {
      const previous = latest.current.preferences;

      if (previous.recent[0] === id || previous.pinned.includes(id)) {
        return;
      }

      save({
        ...previous,
        recent: [id, ...previous.recent.filter((candidate) => candidate !== id)].slice(0, RECENT_LIMIT),
      });
    },
    [save],
  );

  const togglePin = useCallback(
    (id: Mech['id']): void => {
      const previous = latest.current.preferences;
      const wasPinned = previous.pinned.includes(id);

      save({
        pinned: wasPinned ? previous.pinned.filter((candidate) => candidate !== id) : [...previous.pinned, id],
        recent: wasPinned
          ? [id, ...previous.recent.filter((candidate) => candidate !== id)].slice(0, RECENT_LIMIT)
          : previous.recent.filter((candidate) => candidate !== id),
      });
    },
    [save],
  );

  const forget = useCallback(
    (id: Mech['id']): void => {
      const previous = latest.current.preferences;

      if (!previous.pinned.includes(id) && !previous.recent.includes(id)) {
        return;
      }

      save({
        pinned: previous.pinned.filter((candidate) => candidate !== id),
        recent: previous.recent.filter((candidate) => candidate !== id),
      });
    },
    [save],
  );

  return (
    <NavigationPreferenceContext.Provider value={{ ...preferences, visit, togglePin, forget, persistenceError }}>
      {children}
    </NavigationPreferenceContext.Provider>
  );
}

export function useNavigationPreferences(): NavigationPreferenceState {
  const value = useContext(NavigationPreferenceContext);

  if (value === undefined) {
    throw new Error('Navigation preferences require an authenticated workspace.');
  }

  return value;
}
