import { readRequests } from '@mechane/console-data';
import type { ReadRequest } from '@mechane/console-data';
import { sessionEvidenceRead } from './session-evidence-read.ts';
import type { ConsoleLocation } from './types.ts';

/** Starts the route's heading and primary content demand while local storage opens. */
export function initialReads(location: ConsoleLocation): ReadonlyArray<ReadRequest> {
  if (location.agent !== undefined) {
    const agent = readRequests.agent(location.agent);

    if (location.session === undefined) {
      return [agent, readRequests.sessions(location.agent, location.page ?? null, location)];
    }

    const session = readRequests.session(location.agent, location.session);

    if (location.isSessionEvidence === true) {
      const capture = sessionEvidenceRead({ agentId: location.agent, sessionId: location.session }, location);

      return capture === undefined ? [agent, session] : [agent, session, capture];
    }

    return [
      agent,
      session,
      readRequests.threads(location.agent, location.session),
      readRequests.sessionEvents(
        { agentId: location.agent, sessionId: location.session, threadId: location.thread ?? null },
        location.page ?? null,
        location.through,
      ),
    ];
  }

  if (location.view === 'definition') {
    return [];
  }

  if (location.view === 'files') {
    return [readRequests.managedFiles(location.page ?? null)];
  }

  return [readRequests.agents(location.page ?? null, location)];
}
