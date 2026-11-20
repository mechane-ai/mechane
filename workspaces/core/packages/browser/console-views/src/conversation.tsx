import { Conversation, Message } from '@mechane-ai/elements/ai';
import { SkeletonText } from '@mechane-ai/elements/feedback';
import type { ReactNode } from 'react';

export function ConversationPlaceholder(): ReactNode {
  return (
    <Conversation.Root shouldFollow={false}>
      <Conversation.Viewport label="Conversation">
        <Conversation.Content>
          <Message author="" kind="user" avatar={<SkeletonText width="8ch" />}>
            <SkeletonText lines={2} width="70%" />
          </Message>
          <Message author="" avatar={<SkeletonText width="12ch" />}>
            <SkeletonText lines={4} />
          </Message>
        </Conversation.Content>
      </Conversation.Viewport>
    </Conversation.Root>
  );
}
