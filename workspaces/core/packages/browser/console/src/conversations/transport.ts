import type { WorkflowChatTransport } from '@ai-sdk/workflow/client';
import type { ChatTransport, UIMessage } from 'ai';

/** Public Workflow resumes replay from zero; native Chat must replace its partial reply before replay. */
export function chatTransport(transport: WorkflowChatTransport<UIMessage>): ChatTransport<UIMessage> {
  return {
    resumeStreamIsReplay: true,
    async sendMessages({ messageId, abortSignal, ...options }) {
      return await transport.sendMessages({
        ...options,
        ...(messageId === undefined ? {} : { messageId }),
        ...(abortSignal === undefined ? {} : { abortSignal }),
      });
    },
    async reconnectToStream(options) {
      return await transport.reconnectToStream(options);
    },
  };
}
