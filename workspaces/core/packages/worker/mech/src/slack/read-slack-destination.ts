import type { SlackBinding } from '@mechane/protocol';
import type { SlackDestination } from '@mechane/records';
import { SlackBindingAnswer, workspaceStub } from '@mechane/rpc';
import { capturePromise } from '@mechane/utilities';
import { Option, Result, Schema } from 'effect';
import { blockSlackDelivery } from './block-slack-delivery.ts';
import { deferSlackBindingLookup } from './defer-slack-binding-lookup.ts';
import type { RunSlackDeliveryInput } from './types.ts';

type MatchSlackDestinationInput = RunSlackDeliveryInput & {
  /** Absent when no binding is configured. */
  readonly binding: Option.Option<SlackBinding>;
};

/** Validates the current binding against the durable audience before any outbound request. */
export async function readSlackDestination({
  store,
  settings,
  mech,
  delivery,
}: RunSlackDeliveryInput): Promise<Option.Option<SlackDestination>> {
  if (settings.suspendedWorkspaces.includes(mech.workspaceId)) {
    await blockSlackDelivery({ store, delivery, reason: 'workspace_suspended' });

    return Option.none();
  }

  const workspace = workspaceStub({ bindings: settings, workspaceId: mech.workspaceId });
  const promise = workspace.slackBinding({ bindingId: delivery.bindingId });
  const response = await capturePromise({ promise });
  const decode = Schema.decodeUnknownResult(SlackBindingAnswer);
  const decoded = Result.flatMap(response, decode);

  if (Result.isFailure(decoded)) {
    await deferSlackBindingLookup({ store, delivery });

    return Option.none();
  }

  const destination = matchSlackDestination({ store, settings, mech, delivery, binding: decoded.success });

  if (Option.isNone(destination)) {
    await blockSlackDelivery({ store, delivery, reason: 'binding_disabled' });
  }

  return destination;
}

function matchSlackDestination({
  mech,
  delivery,
  binding,
}: MatchSlackDestinationInput): Option.Option<SlackDestination> {
  if (Option.isNone(binding)) {
    return Option.none();
  }

  const current = binding.value;

  if (current.mechId !== mech.id || !current.isReplyEnabled) {
    return Option.none();
  }

  const fallback: SlackDestination = {
    bindingId: current.id,
    connectionId: current.connectionId,
    teamId: current.teamId,
    channelId: current.channelId,
    threadTimestamp: Option.none(),
  };

  const destination = Option.getOrElse(delivery.destination, () => fallback);

  const matches =
    destination.connectionId === current.connectionId &&
    destination.teamId === current.teamId &&
    destination.channelId === current.channelId;

  return Option.liftPredicate(destination, () => matches);
}
