import { configureSlackBinding } from './configure-slack-binding.ts';
import { listSlackBindings } from './list-slack-bindings.ts';
import { listSlackDeliveries } from './list-slack-deliveries.ts';

/** Trusted channel bindings and outbound delivery records. */
export const SLACK_OPERATIONS = { configureSlackBinding, listSlackBindings, listSlackDeliveries } as const;
