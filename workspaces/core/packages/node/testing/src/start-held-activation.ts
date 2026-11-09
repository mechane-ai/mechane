import { requireFixtures } from './fixtures.ts';
import { sendNotification, waitForActiveTurn } from './mechs.ts';
import type { MechContext } from './types.ts';

type StartHeldActivationInput = MechContext & { readonly marker: string };

export async function startHeldActivation(input: StartHeldActivationInput) {
  const notification = await sendNotification({ ...input, text: input.marker });

  await requireFixtures(input.stack).model.waitForCall({ marker: input.marker, index: 0 });

  const turn = await waitForActiveTurn({ ...input, notificationId: notification.id });

  return { notification, turn };
}
