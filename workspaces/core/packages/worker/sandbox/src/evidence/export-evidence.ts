import { EvidenceStatus } from '@mechane/protocol';
import { Bytes, HttpHeader, HttpMethod, HttpStatusCode, MachineId, MediaType } from '@mechane/records';
import type { EvidenceArtifactId } from '@mechane/records';
import { EvidenceExportFile, EvidenceExportResult, guestEvidenceExportPath } from '@mechane/sandbox-wire';
import type { SandboxOwner } from '@mechane/sandbox-wire';
import { capturePromise } from '@mechane/utilities';
import { Duration, Option, Result, Schema } from 'effect';
import { boundGuestResponse } from '../files/bound-guest-response.ts';
import { connectLiveMachine } from '../machines/connect-live-machine.ts';
import { readyInteractiveMachine } from '../machines/ready-interactive-machine.ts';
import type { WorkspaceProviderStepInput } from '../types.ts';
import { releaseWorkspace } from '../workspace/release-workspace.ts';
import { readEvidenceContent } from './evidence-content.ts';
import { readEvidenceArtifact } from './read-evidence.ts';

const EXPORT_RESPONSE_MAX_BYTES = Bytes.make(16_384);
const EXPORT_TIMEOUT = Duration.minutes(2);

type ExportEvidenceInput = WorkspaceProviderStepInput & SandboxOwner & { readonly artifactId: EvidenceArtifactId };

/** The durable capture is immutable; another copy after machine loss is safe and never recaptures a page. */
export async function exportEvidence({
  store,
  provider,
  workspace,
  ...identity
}: ExportEvidenceInput): Promise<EvidenceExportResult> {
  const found = readEvidenceArtifact({ store, ...identity });

  if (Option.isNone(found) || found.value.status !== EvidenceStatus.Ready || Option.isNone(found.value.descriptor)) {
    return EvidenceExportResult.cases.Failed.make({
      reason: 'No ready capture belongs to this mech and artifact identity',
    });
  }

  const descriptor = found.value.descriptor.value;

  const metadata = {
    artifactId: identity.artifactId,
    sha256: descriptor.sha256,
    sizeBytes: descriptor.sizeBytes,
    mediaType: descriptor.mediaType,
  };

  const input = { store, provider, workspace };
  const machine = await readyInteractiveMachine(input);

  if (Option.isNone(machine)) {
    return EvidenceExportResult.cases.Pending.make({
      reason: 'The environment is starting or restoring its home files',
    });
  }

  const machineIdentity = Schema.decodeUnknownResult(MachineId)(machine.value.id);

  if (Result.isFailure(machineIdentity)) {
    return EvidenceExportResult.cases.Failed.make({ reason: 'The environment has an invalid machine identity' });
  }

  const machineId = machineIdentity.success;
  const guest = await connectLiveMachine({ store, provider, machineId });
  const drain = store.machineDrain({ machineId });

  if (Option.isNone(guest) || Option.isSome(drain)) {
    return EvidenceExportResult.cases.Pending.make({ reason: 'The environment is not ready for a capture copy' });
  }

  const released = await releaseWorkspace({ ...input, machineId, guest: guest.value });

  if (!released) {
    return EvidenceExportResult.cases.Pending.make({ reason: 'The environment is releasing its completed checkpoint' });
  }

  const rangeHeader = Option.none<string>();

  const content = await readEvidenceContent({ store, bucket: workspace.bucket, ...identity, rangeHeader });

  const body = Option.fromNullOr(content.body);

  if (!content.ok || Option.isNone(body)) {
    if (Option.isSome(body)) {
      await body.value.cancel();
    }

    return EvidenceExportResult.cases.Pending.make({
      reason: 'The saved capture could not be read from durable storage',
    });
  }

  const path = guestEvidenceExportPath({ machineId, metadata });
  const timeout = Duration.toMillis(EXPORT_TIMEOUT);
  const signal = AbortSignal.timeout(timeout);
  const sizeBytes = String(metadata.sizeBytes);

  const sending = guest.value.fetch({
    path,
    init: {
      method: HttpMethod.Post,
      headers: { [HttpHeader.ContentType]: MediaType.OctetStream, [HttpHeader.ContentLength]: sizeBytes },
      body: body.value,
      signal,
    },
  });

  const sent = await capturePromise({ promise: sending });

  if (Result.isFailure(sent)) {
    return EvidenceExportResult.cases.Pending.make({
      reason: 'The capture copy response was interrupted; copying it again is safe',
    });
  }

  const response = boundGuestResponse({ response: sent.success, maximumBytes: EXPORT_RESPONSE_MAX_BYTES });

  if (response.status !== HttpStatusCode.Ok) {
    const responseBody = Option.fromNullOr(response.body);

    if (Option.isSome(responseBody)) {
      await responseBody.value.cancel();
    }

    if (response.status === HttpStatusCode.NotFound) {
      return EvidenceExportResult.cases.Failed.make({
        reason: 'This guest does not support evidence export; restart its environment after upgrading',
      });
    }

    if (response.status === HttpStatusCode.BadRequest) {
      return EvidenceExportResult.cases.Failed.make({
        reason: 'The guest refused the capture copy; verify its integrity and home storage before retrying',
      });
    }

    return EvidenceExportResult.cases.Pending.make({ reason: 'The guest has not confirmed the verified capture copy' });
  }

  const reading = response.text();
  const received = await capturePromise({ promise: reading });

  if (Result.isFailure(received)) {
    return EvidenceExportResult.cases.Pending.make({
      reason: 'The capture copy response could not be read within its bound',
    });
  }

  const schema = Schema.fromJsonString(EvidenceExportFile);
  const decoded = Schema.decodeUnknownResult(schema)(received.success);

  if (Result.isFailure(decoded)) {
    return EvidenceExportResult.cases.Pending.make({ reason: 'The guest returned an invalid capture copy result' });
  }

  const file = decoded.success;

  const isIdentityMatching = file.artifactId === metadata.artifactId && file.sha256 === metadata.sha256;
  const isMediaMatching = file.sizeBytes === metadata.sizeBytes && file.mediaType === metadata.mediaType;

  if (!isIdentityMatching || !isMediaMatching) {
    return EvidenceExportResult.cases.Failed.make({ reason: 'The guest copy differs from the selected capture' });
  }

  return EvidenceExportResult.cases.Ready.make({ machineId, file });
}
