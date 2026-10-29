import { openMechHarness, shareDatabase } from '@mechane/harness';
import type { AbortObject, ChangesInput } from '@mechane/harness';
import { errorCode, writeLog } from '@mechane/logs';
import { LogEvent } from '@mechane/protocol';
import { workspaceStub } from '@mechane/rpc';
import type { ObjectSettings } from '@mechane/rpc';
import { Option } from 'effect';
import { armedStorageAlarm } from './alarm/armed-storage-alarm.ts';
import { catchUp } from './alarm/catch-up.ts';
import { hostAlarm } from './alarm/host-alarm.ts';
import { isCaughtUp } from './alarm/is-caught-up.ts';
import { openStoreWithoutCutCopy } from './forks/open-store-without-cut-copy.ts';
import { mechPorts } from './mech-ports.ts';
import { projectProgress } from './project-progress.ts';
import { recordedSignal } from './recorded-signal.ts';
import type { OpenedMech } from './types.ts';

/** The object, and its events' signal, which outlives each open, so a list that waits across a reopen still wakes. */
type OpenMechInput = Pick<OpenedMech, 'signal'> & {
  readonly state: DurableObjectState;
  /** The object's settings, which the open decodes only once its fallback alarm is armed. */
  readonly settings: () => ObjectSettings;
};

/** The object a reset aborts, and the id of the mech it holds, none before its creation. */
type ObjectResetInput = {
  readonly state: DurableObjectState;
  /** None before the object holds a mech. */
  readonly mechId: Option.Option<string>;
};

/** The longest part of a failure's cause that a reset's reason quotes; no log line quotes one. */
const CAUSE_MAX_CHARS = 500;

/**
 * Opens a mech's object: a fallback alarm before anything can fail, so a failed open starts again, then its tables,
 * emptied of a copy cut off before its end. It settles every reservation a lost instance left open before this one can
 * reserve, opens pi's Harness paused, and catches up on pi's unprojected progress. Only the alarm lets pi work, so the
 * open arms it for now when pi has work, an item to receive or a turn to close, and clears it otherwise.
 */
export async function openMech({ state, settings: decodeSettings, signal }: OpenMechInput): Promise<OpenedMech> {
  const storageAlarm = await armedStorageAlarm({ storage: state.storage });

  const settings = decodeSettings();
  const database = shareDatabase({ storage: state.storage });
  const store = await openStoreWithoutCutCopy({ storage: state.storage, transaction: database.transaction });
  const alarm = hostAlarm({ alarm: storageAlarm, store });
  const mech = await store.atomic({ run: (tables) => tables.mech() });
  const mechId = Option.map(mech, ({ id }) => id);
  const abortObject = objectReset({ state, mechId });
  const recorded = recordedSignal();

  const project: (input: ChangesInput) => void = ({ changes, droneEnds }) =>
    projectProgress({ store, signal, recorded, abortObject, changes, droneEnds });

  if (Option.isSome(mech)) {
    const { id, workspaceId } = mech.value;

    await workspaceStub({ bindings: settings, workspaceId }).settleOpenDispatches({ mechId: id });
  }

  const ports = mechPorts({ store, settings, signal, recorded, abortObject });

  const harness = await openMechHarness({
    database,
    modelUpstream: { upstream: settings.modelUpstream, apiKey: settings.modelApiKey, offers: settings.modelOffers },
    ...ports,
    alarm,
    mechId,
    abortObject,
    onChanges: project,
  });

  const caught = await catchUp({ store, harness, project });

  await harness.armNext({ isDue: !isCaughtUp({ caught }) });

  return { store, settings, harness, meter: ports.meter, alarm, signal, recorded, project };
}

/**
 * Resets the mech's object, so its next event or alarm opens it again. The reset is logged by the mech's id and the
 * error's code, and its reason names the step and quotes the cause's start.
 */
function objectReset({ state, mechId }: ObjectResetInput): AbortObject {
  const mechSubject: (id: string) => string = (id) => `mech ${id}`;
  const subject = Option.match(mechId, { onNone: () => 'an object without a mech', onSome: mechSubject });

  const reset: AbortObject = ({ operation, cause }) => {
    writeLog({ line: { event: LogEvent.ObjectReset, mechId, error: errorCode({ error: cause }) } });
    state.abort(`${operation} for ${subject}: ${String(cause).slice(0, CAUSE_MAX_CHARS)}`);
  };

  return reset;
}
