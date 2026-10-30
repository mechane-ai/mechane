import { configureSlackBinding } from './configure-slack-binding.ts';
import { configureSlackInstallation } from './configure-slack-installation.ts';
import { deleteSlackInstallation } from './delete-slack-installation.ts';
import { listSlackBindings } from './list-slack-bindings.ts';
import { listSlackDeliveries } from './list-slack-deliveries.ts';
import { listSlackInstallations } from './list-slack-installations.ts';

/** Trusted channel bindings and outbound delivery records. */
export const SLACK_OPERATIONS = {
  configureSlackBinding,
  listSlackBindings,
  listSlackDeliveries,
  configureSlackInstallation,
  listSlackInstallations,
  deleteSlackInstallation,
} as const;
