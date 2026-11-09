import type { ConsoleData } from '@mechane/console-data';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';
import { createConversationEntry } from './entry.ts';
import type { ConversationEntry } from './entry.ts';

const RETAINED_CONVERSATIONS = 5;

function createConversations(conversations: ConsoleData['conversations'], getData: () => ConsoleData) {
  const entries = new Map<string, ConversationEntry>();
  const recency = new Set<ConversationEntry>();

  function remove(entry: ConversationEntry): void {
    for (const [key, candidate] of entries) {
      if (candidate === entry) {
        entries.delete(key);
      }
    }

    recency.delete(entry);
    entry.dispose();
  }

  function prune(): void {
    for (const entry of recency) {
      if (recency.size <= RETAINED_CONVERSATIONS) {
        return;
      }

      if (!entry.isRetained()) {
        remove(entry);
      }
    }
  }

  return {
    entry(mechId: string): ConversationEntry {
      const key = mechId;
      const existing = entries.get(key);

      if (existing !== undefined) {
        recency.delete(existing);
        recency.add(existing);

        return existing;
      }

      const entry = createConversationEntry({ getData, conversations, mechId });

      entries.set(key, entry);
      recency.add(entry);
      prune();

      return entry;
    },
    dispose: () => {
      for (const entry of recency) {
        remove(entry);
      }
    },
  };
}

const ConversationContext = createContext<ReturnType<typeof createConversations> | undefined>(undefined);

export function ConversationProvider({
  data,
  children,
}: {
  readonly data: ConsoleData;
  readonly children: ReactNode;
}): ReactNode {
  const current = useRef(data);
  const getData = useCallback(() => current.current, []);
  const conversationApi = data.conversations;

  const conversations = useMemo(() => createConversations(conversationApi, getData), [getData, conversationApi]);

  useLayoutEffect(() => {
    current.current = data;
  }, [data]);

  useEffect(() => {
    const signal = conversationApi.signal;

    signal.addEventListener('abort', conversations.dispose, { once: true });

    return () => {
      signal.removeEventListener('abort', conversations.dispose);
      conversations.dispose();
    };
  }, [conversations, conversationApi]);

  return <ConversationContext value={conversations}>{children}</ConversationContext>;
}

export function useConversationEntry(mechId: string, isEnabled = true): ConversationEntry {
  const conversations = useContext(ConversationContext);

  if (conversations === undefined) {
    throw new Error('Conversations need an admitted workspace.');
  }

  const entry = useMemo(() => conversations.entry(mechId), [conversations, mechId]);

  useEffect(() => (isEnabled ? entry.retain() : undefined), [entry, isEnabled]);

  return entry;
}

export function useConversationState(entry: ConversationEntry) {
  return useSyncExternalStore(entry.subscribe, entry.read, entry.read);
}
