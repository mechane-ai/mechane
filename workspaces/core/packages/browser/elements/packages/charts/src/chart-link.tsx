import { dispatch } from '@ui-sdk/core';
import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { ChartInspectDetails, ChartInspectReason } from './chart.tsx';

type Link = {
  readonly inspected: string | null;
  readonly onInspectedChange: (id: string | null, details: ChartInspectDetails) => void;
};

const LinkedInspection = createContext<Link | undefined>(undefined);

export type ChartLinkProps = {
  /** The record every figure inside shows as inspected, when the application holds it. */
  readonly inspected?: string | null | undefined;
  readonly defaultInspected?: string | null | undefined;
  /** Hears each change with its details: which figure's hover, press or key, or an agent's step. */
  readonly onInspectedChange?: ((id: string | null, details: ChartInspectDetails) => void) | undefined;
  readonly children: ReactNode;
};

/**
 * Links the figures inside it: inspecting a record in one highlights the record with the same id in the others. Give a
 * model, a run or a token one id everywhere and the page reads as one instrument.
 */
export function ChartLink({
  inspected,
  defaultInspected = null,
  onInspectedChange,
  children,
}: ChartLinkProps): ReactNode {
  const [own, setOwn] = useState(defaultInspected);

  const link: Link = {
    inspected: inspected === undefined ? own : inspected,
    onInspectedChange: (id, details) => {
      onInspectedChange?.(id, details);

      if (!details.canceled) {
        setOwn(id);
      }
    },
  };

  return <LinkedInspection value={link}>{children}</LinkedInspection>;
}

/**
 * The inspection a chart shares with its linked siblings: spread the result into `Chart`. Outside a link it is empty,
 * and the chart keeps its own inspection. An id the chart does not draw reads as nothing inspected.
 */
export function useLinkedInspection(): Partial<Link> {
  return useContext(LinkedInspection) ?? {};
}

export type LinkedHighlightInput = {
  /** The ids a figure could highlight, such as its series. */
  readonly ids: ReadonlyArray<string>;
  /** The caller's own choice. Null highlights nothing; left out, the link decides. */
  readonly highlighted?: string | null | undefined;
};

/**
 * The record a figure draws at full strength while the others fade. That is the one the caller names, or else the
 * record the enclosing link inspects when it is one of the figure's own. So a table row or a term in the prose that
 * inspects a model lights up that model in every linked figure.
 */
export function useLinkedHighlight({ ids, highlighted }: LinkedHighlightInput): string | null {
  const inspected = useContext(LinkedInspection)?.inspected ?? null;

  if (highlighted !== undefined) {
    return highlighted;
  }

  return inspected !== null && ids.includes(inspected) ? inspected : null;
}

/** Why something outside the charts points them at a record: a hover, a press, focus arriving or leaving, or a call. */
export type ChartLinkInspectChange = {
  readonly reason: ChartInspectReason;
  /** The DOM event behind it, so the details say whether a pointer, a key or a screen reader caused it. */
  readonly event?: Event | undefined;
};

/** The linked inspection as a control outside the charts reads and sets it. */
export type ChartLinkControl = {
  /** The record every linked figure shows as inspected, or null. */
  readonly inspected: string | null;
  /** Points every linked figure at a record, or at nothing. Returns false when a listener canceled the change. */
  readonly inspect: (id: string | null, change: ChartLinkInspectChange) => boolean;
};

/**
 * Lets prose or a diagram point the linked figures at a record, such as a highlighted term that marks its series in
 * every chart. The change reaches the link's listener with the same details a chart's own inspection sends. Outside a
 * link it is undefined.
 */
export function useChartLinkControl(): ChartLinkControl | undefined {
  const link = useContext(LinkedInspection);

  if (link === undefined) {
    return undefined;
  }

  return {
    inspected: link.inspected,
    inspect: (id, { reason, event }) =>
      !dispatch(
        { options: () => ({ onInspectedChange: link.onInspectedChange }) },
        'onInspectedChange',
        id,
        event === undefined ? { reason } : { reason, event },
      ),
  };
}
