import { AgentAvatar, Button } from '@mechane-ai/elements';
import { MessageAction } from '@mechane-ai/elements/ai';
import type { ConsoleData } from '@mechane/console-data';
import { ConversationPlaceholder, MechConversation } from '@mechane/console-views';
import type { Mech } from '@mechane/protocol';
import { ScanLine } from 'lucide-react';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import type { ConversationEntry, ConversationValue } from '../conversations/entry.ts';
import { useConversationState } from '../conversations/provider.tsx';
import { useMechAppearance } from '../mech-appearance.tsx';
import { ConsoleLink, useReaderPosition } from '../navigation.tsx';
import { ResourceView } from '../resource.tsx';

type ConversationScreenProps = { readonly data: ConsoleData; readonly mech: Mech; readonly entry: ConversationEntry };

export function ConversationScreen(props: ConversationScreenProps): ReactNode {
  const state = useConversationState(props.entry);

  return (
    <ResourceView state={state} placeholder={<ConversationPlaceholder />} label="Loading conversation">
      {(value, notice) => <ConversationPage {...props} value={value} notice={notice} />}
    </ResourceView>
  );
}

function ConversationPage({
  data,
  mech,
  entry,
  value,
  notice,
}: ConversationScreenProps & { readonly value: ConversationValue; readonly notice: ReactNode }): ReactNode {
  const { appearance } = useMechAppearance(mech.id);
  const viewport = useRef<HTMLDivElement>(null);
  const reader = useReaderPosition(data.scope, `${mech.id}:conversation`);

  return (
    <MechConversation
      name={mech.name}
      avatar={<AgentAvatar seed={mech.id} appearance={appearance} />}
      messages={value.messages}
      viewportRef={viewport}
      scrollRestorationId={reader.id}
      initialPosition={reader.position}
      inspect={(turn) => (
        <MessageAction
          label="Open run"
          kind="link"
          render={<ConsoleLink to={{ workspace: data.workspace.id, mech: mech.id, turn }} row={turn} />}
        >
          <ScanLine size={16} aria-hidden />
        </MessageAction>
      )}
      controls={
        <>
          {notice}
          {value.hasMore && (
            <Button
              variant="ghost"
              isPending={value.isLoadingEarlier}
              pendingLabel="Loading earlier messages…"
              onClick={() => {
                void entry.earlier();
              }}
            >
              Earlier messages
            </Button>
          )}
        </>
      }
    />
  );
}
