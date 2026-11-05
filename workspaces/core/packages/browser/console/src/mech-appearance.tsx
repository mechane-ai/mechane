import { agentAvatarColors, agentAvatarShapes } from '@mechane-ai/elements';
import type { AgentAppearance } from '@mechane-ai/elements';
import { Schema } from 'effect';
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

const appearanceSchema = Schema.Struct({
  shape: Schema.Literals(agentAvatarShapes),
  color: Schema.Literals(agentAvatarColors),
});

const preferencesSchema = Schema.Struct({
  version: Schema.Literal(1),
  appearances: Schema.Record(Schema.String, appearanceSchema),
});

type AppearancePreferences = typeof preferencesSchema.Type;
type AppearanceState = { readonly preferences: AppearancePreferences; readonly error: string | undefined };

type AppearanceContextValue = {
  readonly appearances: Readonly<Record<string, AgentAppearance>>;
  readonly setAppearance: (mechId: string, appearance: AgentAppearance | undefined) => void;
  readonly persistenceError: string | undefined;
};

const AppearanceContext = createContext<AppearanceContextValue | undefined>(undefined);

function decodePreferences(value: string | null): AppearanceState {
  const empty: AppearancePreferences = { version: 1, appearances: {} };

  if (value === null) {
    return { preferences: empty, error: undefined };
  }

  const invalid: AppearanceState = {
    preferences: empty,
    error: 'Saved icon choices could not be read. Choose an icon to replace them.',
  };

  try {
    const parsed: unknown = JSON.parse(value);

    return Schema.is(preferencesSchema)(parsed) ? { preferences: parsed, error: undefined } : invalid;
  } catch {
    return invalid;
  }
}

function readPreferences(key: string): AppearanceState {
  try {
    return decodePreferences(localStorage.getItem(key));
  } catch {
    return { preferences: { version: 1, appearances: {} }, error: 'This browser cannot save icon choices.' };
  }
}

export function MechAppearanceProvider({
  principalId,
  workspaceId,
  children,
}: {
  readonly principalId: string;
  readonly workspaceId: string;
  readonly children: ReactNode;
}): ReactNode {
  const preferenceKey = `mechane:appearance:${principalId}:${workspaceId}`;

  return (
    <AppearanceOwner key={preferenceKey} preferenceKey={preferenceKey}>
      {children}
    </AppearanceOwner>
  );
}

function AppearanceOwner({
  preferenceKey,
  children,
}: {
  readonly preferenceKey: string;
  readonly children: ReactNode;
}): ReactNode {
  const [state, setState] = useState(() => readPreferences(preferenceKey));

  useEffect(() => {
    function onStorage(event: StorageEvent): void {
      if (event.storageArea === localStorage && event.key === preferenceKey) {
        setState(readPreferences(preferenceKey));
      }
    }

    globalThis.addEventListener('storage', onStorage);

    return () => globalThis.removeEventListener('storage', onStorage);
  }, [preferenceKey]);

  function setAppearance(mechId: string, appearance: AgentAppearance | undefined): void {
    const appearances =
      appearance === undefined
        ? Object.fromEntries(Object.entries(state.preferences.appearances).filter(([id]) => id !== mechId))
        : { ...state.preferences.appearances, [mechId]: appearance };

    const preferences: AppearancePreferences = { version: 1, appearances };

    try {
      localStorage.setItem(preferenceKey, JSON.stringify(preferences));
      setState({ preferences, error: undefined });
    } catch {
      setState({ preferences, error: 'This icon is changed for now, but this browser could not save it.' });
    }
  }

  return (
    <AppearanceContext.Provider
      value={{ appearances: state.preferences.appearances, setAppearance, persistenceError: state.error }}
    >
      {children}
    </AppearanceContext.Provider>
  );
}

function useAppearanceContext(): AppearanceContextValue {
  const context = useContext(AppearanceContext);

  if (context === undefined) {
    throw new Error('Mech appearance requires a workspace provider.');
  }

  return context;
}

export function useMechAppearances(): Readonly<Record<string, AgentAppearance>> {
  return useAppearanceContext().appearances;
}

export function useMechAppearance(mechId: string): {
  readonly appearance: AgentAppearance | undefined;
  readonly setAppearance: (appearance: AgentAppearance | undefined) => void;
  readonly persistenceError: string | undefined;
} {
  const context = useAppearanceContext();

  return {
    appearance: context.appearances[mechId],
    setAppearance: (appearance) => context.setAppearance(mechId, appearance),
    persistenceError: context.persistenceError,
  };
}
