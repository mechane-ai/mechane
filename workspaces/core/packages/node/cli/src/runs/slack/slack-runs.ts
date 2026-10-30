import { documentRun } from '../document-run.ts';
import { runSlackBind } from './run-slack-bind.ts';
import { runSlackBindings } from './run-slack-bindings.ts';
import { runSlackConnect } from './run-slack-connect.ts';
import { runSlackConnections } from './run-slack-connections.ts';
import { runSlackDeliveries } from './run-slack-deliveries.ts';
import { runSlackDisconnect } from './run-slack-disconnect.ts';

/** Slack commands return complete documents through the shared formatting and error lifecycle. */
export const SLACK_RUNS = {
  'slack bind': documentRun({ run: runSlackBind }),
  'slack connect': documentRun({ run: runSlackConnect }),
  'slack connections': documentRun({ run: runSlackConnections }),
  'slack disconnect': documentRun({ run: runSlackDisconnect }),
  'slack bindings': documentRun({ run: runSlackBindings }),
  'slack deliveries': documentRun({ run: runSlackDeliveries }),
} as const;
