import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import { evidenceOwnerKey, MachineStatus } from '@mechane/sandbox-store';
import {
  GuestSegment,
  MANAGED_WORK_FINGERPRINT_HEADER,
  SandboxStopOrigin,
  SandboxStopPhase,
} from '@mechane/sandbox-wire';
import type { ManagedWorkerClaimWire, SandboxOwner } from '@mechane/sandbox-wire';
import { waitFor } from '@mechane/utilities';
import { Array, DateTime, Duration, Option } from 'effect';
import { createHash } from 'node:crypto';
import { readyInteractiveMachine } from '../machines/ready-interactive-machine.ts';
import type { GuestConnection, MachineIdInput, ProviderStepInput, WorkspaceProviderStepInput } from '../types.ts';
import { advanceSandboxStop } from './advance-sandbox-stop.ts';
import { requestSandboxStop } from './request-sandbox-stop.ts';
import { workspaceOwnerKey } from './workspace-part-key.ts';

type ClaimInput = WorkspaceProviderStepInput & { readonly claim: ManagedWorkerClaimWire };
type LaunchInput = ClaimInput & { readonly beforeHandoff: () => Promise<void> };
type ConnectedMachine = MachineIdInput & { readonly guest: GuestConnection };
type GuestWorkInput = ConnectedMachine & { readonly init: RequestInit };
type StopPhysicalInput = MachineIdInput & Pick<ProviderStepInput, 'provider'>;
type DestroyInput = WorkspaceProviderStepInput & { readonly owner: SandboxOwner };

const START_SLICE = Duration.seconds(8);
const START_RETRY = Duration.millis(250);
const DELETE_MAX_KEYS = 1000;
const DELETE_MAX_PAGES = 8;
type PrefixInput = Pick<WorkspaceProviderStepInput, 'workspace'> & { readonly prefix: string };

function guestWorkPath({ machineId }: MachineIdInput): string {
  return `/${GuestSegment.Machines}/${machineId}/${GuestSegment.ManagedWork}`;
}

async function requestWorker({ guest, machineId, init }: GuestWorkInput): Promise<number> {
  const path = guestWorkPath({ machineId });
  const response = await guest.fetch({ path, init });
  const body = Option.fromNullOr(response.body);

  if (Option.isSome(body)) {
    await body.value.cancel();
  }

  return response.status;
}

export async function startInstalledWorkspace({ claim, beforeHandoff, ...input }: LaunchInput): Promise<number> {
  const started = DateTime.nowUnsafe();
  const deadline = DateTime.addDuration(started, START_SLICE);
  let machine = await readyInteractiveMachine(input);

  while (Option.isNone(machine)) {
    const now = DateTime.nowUnsafe();
    const { recovery } = input.store.workspace();

    if (DateTime.isGreaterThanOrEqualTo(now, deadline) || Option.isSome(recovery)) {
      return HttpStatusCode.Unavailable;
    }

    await waitFor({ span: START_RETRY });

    machine = await readyInteractiveMachine(input);
  }

  const machineId = machine.value.id;
  const guest = await input.provider.connect({ machineId });

  if (Option.isNone(guest)) {
    return HttpStatusCode.Unavailable;
  }

  const now = DateTime.nowUnsafe();

  input.store.noteWorkspaceActivity({ now });

  const body = JSON.stringify(claim);

  await beforeHandoff();

  return await requestWorker({
    guest: guest.value,
    machineId,
    init: { method: HttpMethod.Post, headers: { [HttpHeader.ContentType]: MediaType.Json }, body },
  });
}

async function liveInstalledGuest({ store, provider }: ProviderStepInput): Promise<Option.Option<ConnectedMachine>> {
  const live = store.liveMachine();

  if (Option.isNone(live)) {
    return Option.none();
  }

  const machineId = live.value.id;
  const connection = await provider.connect({ machineId });

  return Option.map(connection, (guest) => ({ machineId, guest }));
}

export async function observeInstalledWorkspace({ claim, ...input }: ClaimInput): Promise<boolean> {
  const live = await liveInstalledGuest(input);

  if (Option.isNone(live)) {
    return false;
  }

  const fingerprint = createHash('sha256').update(claim.workSecret).digest('hex');

  const status = await requestWorker({
    ...live.value,
    init: { method: HttpMethod.Head, headers: { [MANAGED_WORK_FINGERPRINT_HEADER]: fingerprint } },
  });

  return status === HttpStatusCode.NoContent;
}

export async function touchInstalledWorkspace({ store, provider }: WorkspaceProviderStepInput): Promise<boolean> {
  const live = await liveInstalledGuest({ store, provider });

  if (Option.isNone(live)) {
    return false;
  }

  const { machineId, guest } = live.value;

  return await guest.health({ machineId });
}

async function stopPhysicalMachine({ provider, machineId }: StopPhysicalInput): Promise<boolean> {
  const checkpoint = Option.none();

  await provider.stop({ machineId, checkpoint });

  return await provider.isAbsent({ machineId });
}

export async function releaseInstalledWorkspace({
  store,
  provider,
  workspace,
}: WorkspaceProviderStepInput): Promise<boolean> {
  const latest = store.latestMachine();

  if (Option.isNone(latest)) {
    return true;
  }

  const machineId = latest.value.id;
  const live = store.liveMachine();

  if (Option.exists(live, (machine) => machine.id === machineId && machine.status === MachineStatus.Starting)) {
    if (!(await stopPhysicalMachine({ provider, machineId }))) {
      return false;
    }

    const now = DateTime.nowUnsafe();

    store.failMachine({ machineId, startupDeadline: now, now });

    return true;
  }

  const guest = await provider.connect({ machineId });

  if (Option.isSome(guest)) {
    const quiet = await requestWorker({ guest: guest.value, machineId, init: { method: HttpMethod.Delete } });

    if (quiet !== HttpStatusCode.NoContent) {
      return false;
    }
  } else if (!(await provider.isAbsent({ machineId }))) {
    return false;
  }

  // Even a lost guest gets an observable stop/file outcome. Only positive physical absence releases capacity.
  requestSandboxStop({ store, origin: SandboxStopOrigin.Explicit });

  const stopped = await advanceSandboxStop({ store, provider, workspace, machineId });

  if (stopped.phase === SandboxStopPhase.Failed && (await provider.isAbsent({ machineId }))) {
    const now = DateTime.nowUnsafe();

    store.loseMachine({ machineId, now });

    const checkpoint = Option.none();

    await provider.stop({ machineId, checkpoint });

    return true;
  }

  return stopped.phase === SandboxStopPhase.Completed && (await provider.isAbsent({ machineId }));
}

async function deletePrefix({ workspace, prefix }: PrefixInput): Promise<boolean> {
  const { bucket } = workspace;

  // Successful deletes are strongly consistent. Restarting at the prefix also resumes a lost response.
  const pages = Array.range(1, DELETE_MAX_PAGES).values();

  while (pages.next().done !== true) {
    const page = await bucket.list({ prefix, limit: DELETE_MAX_KEYS });
    const keys = page.objects.map((object) => object.key);

    if (keys.length > 0) {
      await bucket.delete(keys);
    }

    if (!page.truncated) {
      return true;
    }
  }

  return false;
}

export async function destroyInstalledWorkspace({ store, provider, workspace, owner }: DestroyInput): Promise<boolean> {
  const bound = store.capacity();
  const reservation = Option.flatMap(bound, (binding) => binding.reservation);
  const reservedMachine = Option.map(reservation, (held) => held.machineId);
  const latest = store.latestMachine();
  const physical = Option.orElse(reservedMachine, () => Option.map(latest, (record) => record.id));

  if (Option.isSome(physical)) {
    const machineId = physical.value;

    if (!(await stopPhysicalMachine({ provider, machineId }))) {
      return false;
    }

    const now = DateTime.nowUnsafe();

    store.loseMachine({ machineId, now });
  }

  const fileKey = workspaceOwnerKey(workspace);
  const evidenceKey = evidenceOwnerKey(owner);

  for (const prefix of [fileKey, evidenceKey]) {
    if (!(await deletePrefix({ workspace, prefix }))) {
      return false;
    }
  }

  store.purgeInstalledSession();

  return true;
}
