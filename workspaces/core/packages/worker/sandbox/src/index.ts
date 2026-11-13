/**
 * Cloudflare loads this class through the application Worker's SANDBOXES Durable Object binding.
 *
 * @public
 */
export { SandboxObject } from './sandbox-object.ts';
/** Physical containers use their own replaceable namespace. @public */
export { MachineObject } from './providers/machine-object.ts';
/**
 * The Cloudflare container provider calls this entrypoint through state.exports.EgressGateway.
 *
 * @public
 */
export { EgressGateway } from './egress/egress-gateway.ts';
export { serveSandbox } from './service/serve-sandbox.ts';
export type { SandboxServiceEnvironment } from './service/settings.ts';
