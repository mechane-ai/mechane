import { SandboxProvider } from '@mechane/deployment';
import { MachineId } from '@mechane/records';
import { WorkspaceSnapshot } from '@mechane/sandbox-store';
import { GUEST_PORT } from '@mechane/sandbox-wire';
import { serialCalls } from '@mechane/utilities';
import { DurableObject } from 'cloudflare:workers';
import { Option, Result, Schema } from 'effect';
import type { MachineIdInput, MachineProvider } from '../types.ts';
import { containerProvider } from './container-provider.ts';
import { readSandboxSettings } from './read-sandbox-settings.ts';

const MachineConfiguration = Schema.Struct({
  MECHANE_CONTAINER_IMAGE: Schema.OptionFromOptionalKey(Schema.NonEmptyString),
  MECHANE_CONTAINER_INSTANCE_TYPE: Schema.OptionFromOptionalKey(
    Schema.Literals(['lite', 'basic', 'standard-1', 'standard-2', 'standard-3', 'standard-4']),
  ),
});

export const MachineCall = Schema.Struct({
  machineId: MachineId,
  checkpoint: Schema.OptionFromNullOr(WorkspaceSnapshot),
});

export type MachineCallInput = typeof MachineCall.Encoded;
type MachineConnection = { readonly isConnected: boolean; readonly hasExited: boolean };

class MachineConfigurationInvalid extends Schema.TaggedError<MachineConfigurationInvalid>()(
  'MachineConfigurationInvalid',
  {},
) {}

/** Physical compute has a separate namespace; replacing it cannot replace the Sandbox ledger. */
export class MachineObject extends DurableObject<unknown> {
  readonly #provider: MachineProvider;
  readonly #container: Container;
  readonly #calls = serialCalls();
  readonly #exited = new Set<MachineId>();

  constructor(state: DurableObjectState, environment: unknown) {
    super(state, environment);

    const settings = readSandboxSettings({ variables: environment });
    const native = Schema.decodeUnknownSync(MachineConfiguration)(environment);
    const container = Option.fromNullishOr(state.container);

    if (settings.provider !== SandboxProvider.Container || Option.isNone(container)) {
      invalidConfiguration();
    }

    this.#container = Option.match(container, { onSome: (value) => value, onNone: () => invalidConfiguration() });

    this.#provider = containerProvider({
      state,
      container: this.#container,
      gateway: () => state.exports.EgressGateway({ props: {} }),
      ...settings,
      nativeImage: native.MECHANE_CONTAINER_IMAGE,
      instance: Option.getOrElse(native.MECHANE_CONTAINER_INSTANCE_TYPE, () => 'standard-1'),
      onStartupExit: ({ machineId }) => {
        this.#exited.add(machineId);
      },
    });
  }

  async start({ machineId, checkpoint }: MachineCallInput): Promise<void> {
    const decoded = Schema.decodeUnknownSync(MachineCall)({ machineId, checkpoint });

    await this.#calls.run({
      run: async () => {
        this.#exited.delete(decoded.machineId);
        await this.#provider.start(decoded);
      },
    });
  }

  async stop({ machineId, checkpoint }: MachineCallInput): Promise<void> {
    const decoded = Schema.decodeUnknownSync(MachineCall)({ machineId, checkpoint });

    await this.#calls.run({ run: () => this.#provider.stop(decoded) });
  }

  async isAbsent({ machineId }: MachineIdInput): Promise<boolean> {
    return await this.#provider.isAbsent({ machineId });
  }

  async connection({ machineId }: MachineIdInput): Promise<MachineConnection> {
    const connection = await this.#provider.connect({ machineId });

    return { isConnected: Option.isSome(connection), hasExited: this.#exited.has(machineId) };
  }

  async restoredWorkspace({ machineId, checkpoint }: MachineCallInput): Promise<boolean> {
    const decoded = Schema.decodeUnknownSync(MachineCall)({ machineId, checkpoint });

    if (Option.isNone(decoded.checkpoint)) {
      return false;
    }

    return await this.#provider.restoredWorkspace({
      machineId: decoded.machineId,
      checkpoint: decoded.checkpoint.value,
    });
  }

  override async fetch(request: Request): Promise<Response> {
    const port = this.#container.getTcpPort(GUEST_PORT);

    return await port.fetch(request);
  }
}

function invalidConfiguration(): never {
  const cause = new MachineConfigurationInvalid({});
  const failure = Result.fail(cause);

  return Result.getOrThrow(failure);
}
