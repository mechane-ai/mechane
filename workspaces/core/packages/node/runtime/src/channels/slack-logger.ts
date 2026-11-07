import type { Logger } from 'chat';

export function slackLogger(): Logger {
  return {
    child: slackLogger,
    debug: ignoreLog,
    info: ignoreLog,
    warn: () => writeLog('slack_sdk_warning'),
    error: () => writeLog('slack_sdk_error'),
  };
}

function ignoreLog(): void {
  // Routine SDK logs can contain message data; inputs and deliveries have durable receipts instead.
}

function writeLog(event: 'slack_sdk_warning' | 'slack_sdk_error'): void {
  process.stderr.write(`${JSON.stringify({ source: 'slack', event })}\n`);
}
