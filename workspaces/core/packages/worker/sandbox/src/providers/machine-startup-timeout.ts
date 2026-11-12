import { IMAGE_STARTUP_SECONDS, SANDBOX_TOOL_LIMITS } from '@mechane/sandbox-wire';
import type { SandboxTools } from '@mechane/sandbox-wire';
import { Duration } from 'effect';

type MachineStartupTimeoutInput = { readonly tools: SandboxTools };

/** Gives configured tool verification its bounded startup window before declaring a guest unhealthy. */
export function machineStartupTimeout({ tools }: MachineStartupTimeoutInput): Duration.Duration {
  if (tools.length === 0) {
    return Duration.seconds(IMAGE_STARTUP_SECONDS);
  }

  const startupSeconds = IMAGE_STARTUP_SECONDS + SANDBOX_TOOL_LIMITS.startupSeconds;

  return Duration.seconds(startupSeconds);
}
