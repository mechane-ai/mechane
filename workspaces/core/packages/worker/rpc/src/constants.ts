import { Duration } from 'effect';

/**
 * How long a machine runs without a command before the sandbox's alarm stops it, and its disk with it. It outlasts any
 * command's timeout and grace, so a command that runs keeps its machine.
 */
export const SANDBOX_IDLE = Duration.minutes(15);

/**
 * How long after a machine's stop starts the sandbox's alarm tries it again, unless the stop returned first. The
 * platform retries a failed alarm only six times. A stop that keeps failing is tried each minute until it returns.
 */
export const STOP_RETRY = Duration.minutes(1);

/**
 * The longest a deployment may let one alarm keep pi working. With the drain's three more minutes, it leaves two of the
 * fifteen Cloudflare gives an alarm for closing pi and opening it again.
 */
export const ALARM_WORK_MAX = Duration.minutes(10);

/**
 * How long a machine holds its workspace's lease after an ask: its idle window, and one retry of the stop that ends it.
 * The stop starts only once the window ends.
 */
export const MACHINE_LEASE = Duration.sum(SANDBOX_IDLE, STOP_RETRY);
