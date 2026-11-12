import { WORKSPACE_RESTORE_SECONDS } from '@mechane/sandbox-wire';
import { Duration } from 'effect';

/** The deadline for a complete workspace checkpoint or restoration. */
export const WORKSPACE_OPERATION_TIMEOUT = Duration.seconds(WORKSPACE_RESTORE_SECONDS);
export const WORKSPACE_TRANSFER_BATCH_PARTS = 32;
export const WORKSPACE_TRANSFER_CONCURRENT_PARTS = 4;
export const AUTOMATIC_CHECKPOINT_QUIET = Duration.seconds(5);
export const AUTOMATIC_CHECKPOINT_RETRY = Duration.seconds(30);
export const WORKSPACE_TRANSFER_BATCH_DURATION = Duration.seconds(2);

/** How long past a request's wait the sandbox waits for the guest's answer before it counts the request as failed. */
export const ANSWER_SLACK = Duration.seconds(5);

export const SANDBOX_IDLE = Duration.minutes(15);
export const STOP_RETRY = Duration.minutes(1);
export const MAINTENANCE_RETRY = Duration.millis(500);
export const BACKGROUND_OBSERVE_INTERVAL = Duration.seconds(5);
export const CONTAINER_INACTIVITY = Duration.sum(SANDBOX_IDLE, STOP_RETRY);
