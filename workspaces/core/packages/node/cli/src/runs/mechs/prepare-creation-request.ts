import { PROGRAM } from '@mechane/commands';
import type { CommandName } from '@mechane/commands';
import { writeDiagnostic } from '@mechane/program';
import { CreationRequestId } from '@mechane/records';
import { Option } from 'effect';

/** A creation command and the ID to reuse when the caller retries it. */
type PrepareCreationRequestInput = {
  readonly command: CommandName;
  /** None on the first attempt, which creates a fresh ID before sending. */
  readonly requestedId: Option.Option<CreationRequestId>;
};

/** Prints the retry ID before sending so a lost response cannot hide a newly created mech. */
export function prepareCreationRequest({ command, requestedId }: PrepareCreationRequestInput): CreationRequestId {
  const requestId = Option.getOrElse(requestedId, generateCreationRequestId);

  writeDiagnostic({
    program: PROGRAM,
    line: `${command}: request ${requestId}; retry with --request-id ${requestId} and the same arguments`,
  });

  return requestId;
}

function generateCreationRequestId(): CreationRequestId {
  return CreationRequestId.make(crypto.randomUUID());
}
