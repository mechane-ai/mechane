import type { ConsoleData, ReadRequest } from '@mechane/console-data';
import { EvidenceArtifactId, TurnId } from '@mechane/records';
import { Result, Schema } from 'effect';
import { usePageRead } from './page-read.tsx';
import type { PageRead } from './page-read.tsx';
import { useArchivedMessages, useEnvironment, useEvents, useEvidenceArtifact, useTrace, useTurns } from './reads.ts';
import type { ConsoleLocation } from './types.ts';

type DiagnosticPage =
  | { readonly view: 'conversation'; readonly pageRead: PageRead<'archive', ReadRequest<'archive'>> }
  | { readonly view: 'runs'; readonly pageRead: PageRead<'turns', ReadRequest<'turns'>> }
  | { readonly view: 'environment'; readonly request: ReadRequest<'environment'> }
  | { readonly view: 'activity'; readonly pageRead: PageRead<'activity', ReadRequest<'events'>> };

function diagnosticView(requested: ConsoleLocation['view']): DiagnosticPage['view'] {
  switch (requested) {
    case 'activity':
    case 'conversation':
    case 'environment':
      return requested;
    case undefined:
    case 'definition':
    case 'events':
    case 'requests':
    case 'tools':
    case 'runs':
      return 'runs';
  }
}

export function useMechPageReads(data: ConsoleData, mechId: string, location: ConsoleLocation) {
  const view = diagnosticView(location.view);
  const hasDetail = location.turn !== undefined || location.artifact !== undefined;

  const archive = usePageRead({
    data,
    key: 'archive',
    scope: mechId,
    isEnabled: !hasDetail && view === 'conversation',
    create: (cursors) => data.reads.archive(mechId, cursors.at(-1) ?? null),
  });

  const turns = usePageRead({
    data,
    key: 'turns',
    scope: mechId,
    isEnabled: !hasDetail && view === 'runs',
    create: (cursors) => data.reads.turns(mechId, cursors.at(-1) ?? null),
  });

  const activity = usePageRead({
    data,
    key: 'activity',
    scope: mechId,
    isEnabled: !hasDetail && view === 'activity',
    create: (cursors) => data.reads.events(mechId, cursors.at(-1) ?? null),
  });

  const environment = !hasDetail && view === 'environment' ? data.reads.environment(mechId) : undefined;
  const turnId = Schema.decodeUnknownResult(TurnId)(location.turn);

  const trace =
    location.artifact === undefined && Result.isSuccess(turnId) ? data.reads.trace(mechId, turnId.success) : undefined;

  const artifactId = Schema.decodeUnknownResult(EvidenceArtifactId)(location.artifact);
  const artifact = Result.isSuccess(artifactId) ? data.reads.evidenceArtifact(mechId, artifactId.success) : undefined;

  const archiveState = useArchivedMessages(data, archive?.request);
  const turnsState = useTurns(data, turns?.request);
  const activityState = useEvents(data, activity?.request);
  const environmentState = useEnvironment(data, environment);
  const traceState = useTrace(data, trace);
  const evidenceState = useEvidenceArtifact(data, artifact);

  function diagnosticPage(): DiagnosticPage | undefined {
    if (archive !== undefined) {
      return { view: 'conversation', pageRead: archive };
    }

    if (turns !== undefined) {
      return { view: 'runs', pageRead: turns };
    }

    if (activity !== undefined) {
      return { view: 'activity', pageRead: activity };
    }

    if (environment !== undefined) {
      return { view: 'environment', request: environment };
    }

    return undefined;
  }

  function primaryState() {
    if (location.artifact !== undefined) {
      return artifact === undefined ? undefined : evidenceState;
    }

    if (location.turn !== undefined) {
      return trace === undefined ? undefined : traceState;
    }

    switch (view) {
      case 'conversation':
        return archiveState;
      case 'runs':
        return turnsState;
      case 'activity':
        return activityState;
      case 'environment':
        return environmentState;
    }
  }

  return {
    view,
    page: diagnosticPage(),
    trace,
    evidence: artifact === undefined ? undefined : evidenceState,
    primary: primaryState(),
  } as const;
}

export type MechPageReads = ReturnType<typeof useMechPageReads>;
