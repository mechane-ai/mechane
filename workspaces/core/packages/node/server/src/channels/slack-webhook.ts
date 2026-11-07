import { receiveSlack } from '@mechane/runtime/channels';

type SlackWebhookInput = {
  readonly request: Request;
  readonly connectionId: string;
  readonly workspaceId: string;
  readonly startAdmission: (input: { readonly runId: string }) => Promise<unknown>;
};

export async function slackWebhook(input: SlackWebhookInput): Promise<Response> {
  return await receiveSlack({
    request: input.request,
    installationId: input.connectionId,
    workspaceId: input.workspaceId,
    startAdmission: input.startAdmission,
  });
}
