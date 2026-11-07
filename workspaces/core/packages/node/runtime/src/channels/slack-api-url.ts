const SLACK_API_PATH = '/api/';

export function slackApiUrl(origin: string): string {
  return new URL(SLACK_API_PATH, origin).href;
}
