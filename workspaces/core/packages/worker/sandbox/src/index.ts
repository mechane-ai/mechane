/**
 * Cloudflare loads this class through the application Worker's SANDBOXES Durable Object binding.
 *
 * @public
 */
export { SandboxObject } from './sandbox-object.ts';
/** Physical containers use their own replaceable namespace. @public */
export { MachineObject } from './providers/machine-object.ts';
export { serveSandbox } from './service/serve-sandbox.ts';
export type { SandboxServiceEnvironment } from './service/settings.ts';
