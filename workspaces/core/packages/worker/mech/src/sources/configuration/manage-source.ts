import type { MechRow, MechTables, SourceTask } from '@mechane/mech-store';
import { SourceAction, SourceReport } from '@mechane/protocol';
import type { SourceRequest } from '@mechane/protocol';
import type { PrincipalId } from '@mechane/records';
import { sandboxStub, SourceAnswer } from '@mechane/rpc';
import { Option } from 'effect';
import type { OpenedMech } from '../../types.ts';
import { advanceSource } from './advance-source.ts';
import { createSourceCheckout } from './create-source-checkout.ts';
import { sourceIsBusy } from './source-is-busy.ts';

type ManageSourceInput = {
  readonly mech: OpenedMech;
  readonly request: SourceRequest;
  readonly principalId: PrincipalId;
};

type ConfigureAction = { readonly action: typeof SourceAction.Configure };

type ConfigureSourceInput = Omit<ManageSourceInput, 'request'> & {
  readonly request: Extract<SourceRequest, ConfigureAction>;
};

/** Owner operations configure grants, advance checkout, inspect state or explicitly publish a draft. */
export async function manageSource({ mech, request, principalId }: ManageSourceInput): Promise<SourceAnswer> {
  const readOwner: (store: MechTables) => Option.Option<MechRow> = (store) => store.mech();
  const owner = await mech.store.atomic({ run: readOwner });

  if (Option.isNone(owner)) {
    return SourceAnswer.cases.MechMissing.make({});
  }

  if (request.action === SourceAction.Configure) {
    return await configureSource({ mech, request, principalId });
  }

  if (request.action !== SourceAction.Show && (await sourceIsBusy({ mech }))) {
    return SourceAnswer.cases.Busy.make({});
  }

  const droneId = Option.none();

  const sandbox = sandboxStub({
    bindings: mech.settings,
    workspaceId: owner.value.workspaceId,
    mechId: owner.value.id,
    droneId,
  });

  const context = { mech, owner: owner.value, sandbox, request, principalId };

  const read: (store: MechTables) => Option.Option<SourceTask> = (store) =>
    store.sourceTask({ sourceId: request.sourceId });

  const existing = await mech.store.atomic({ run: read });

  if (Option.isNone(existing)) {
    return await createSourceCheckout(context);
  }

  return await advanceSource({ ...context, source: existing.value });
}

async function configureSource({ mech, request, principalId }: ConfigureSourceInput): Promise<SourceAnswer> {
  const run: (store: MechTables) => void = (store) => store.saveSourceGrant({ grant: request.grant, principalId });

  await mech.store.atomic({ run });

  const report = SourceReport.cases.Configured.make({ grant: request.grant });

  return SourceAnswer.cases.Found.make({ report });
}
