import { Duration } from 'effect';

/** The deadline for a complete workspace checkpoint or restoration. */
export const WORKSPACE_OPERATION_TIMEOUT = Duration.minutes(5);

/** How long past a request's wait the sandbox waits for the guest's answer before it counts the request as failed. */
export const ANSWER_SLACK = Duration.seconds(5);
