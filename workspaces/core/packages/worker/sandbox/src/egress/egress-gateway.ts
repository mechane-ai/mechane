import type { WorkerEnvironment } from '@mechane/rpc';
import { WorkerEntrypoint } from 'cloudflare:workers';
import { egressSettings } from './egress-settings.ts';
import { passEgress } from './pass-egress.ts';

/** The container binding is the only caller; no public route reaches this entrypoint. */
export class EgressGateway extends WorkerEntrypoint<WorkerEnvironment> {
  override async fetch(request: Request): Promise<Response> {
    const settings = egressSettings({ environment: this.env });

    return await passEgress({ request, settings });
  }
}
