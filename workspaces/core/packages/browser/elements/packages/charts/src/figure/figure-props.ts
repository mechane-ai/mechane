import type { ReactNode } from 'react';
import type { ChartReport, ChartSeriesReport } from '../chart-frame.tsx';
import type { ChartSelectDetails } from '../chart.tsx';

/** How much of the full data a figure draws, when it draws a sample or a window. */
export type FigureCoverage = {
  readonly shown: number;
  readonly total: number;
  /** What is counted, in the plural: "points", "runs", "tokens". */
  readonly unit: string;
};

/**
 * Where a figure's data stands. `loading` holds the final geometry before the first read. `refreshing` keeps the drawn
 * data while a newer read is under way.
 */
export type FigureStatus = 'ready' | 'loading' | 'refreshing';

/**
 * What every figure accepts, whichever chart it is: its title, the words around the plot, the locale its numbers and
 * dates are written in, and where its data stands.
 */
export type FigureProps = {
  readonly title: string;
  /** One or two sentences under the title: what is measured and how to read it. */
  readonly description?: string | undefined;
  /** Sets the figure in a bordered report with its own heading, metadata and summary. */
  readonly report?: ChartReport | undefined;
  /** Controls beside the title, such as a download or a period switch. */
  readonly actions?: ReactNode;
  /** The locale of every number and date in the figure. It is an input, so a server and a browser render alike. */
  readonly locale: string;
  /** Where the data came from, for the footnote: a dataset, a run or a query. */
  readonly source?: string | undefined;
  /** Set when the figure draws part of the data. The figure then says so beside its title and in its footnote. */
  readonly coverage?: FigureCoverage | undefined;
  /** What the application did to the data before drawing, in the reader's words: "Smoothed over 5 steps". */
  readonly transforms?: ReadonlyArray<string> | undefined;
  readonly status?: FigureStatus | undefined;
  /** The sentence shown in place of the plot when there is nothing to draw. */
  readonly emptyLabel?: string | undefined;
};

/**
 * The record an application has selected in a figure, and its request to select another. Selection is the application's
 * state: the figure reports a press or a key and draws what it is given.
 */
export type FigureSelectionProps = {
  readonly selected?: string | null | undefined;
  /** The details say why and how: a press, a key or an agent's step. */
  readonly onSelectedChange?: ((id: string, details: ChartSelectDetails) => void) | undefined;
};

/** `FigureProps` for a chart of named series, whose report can show one period value per series. */
export type SeriesFigureProps = Omit<FigureProps, 'report'> & { readonly report?: ChartSeriesReport | undefined };

/** What a chart passes on to its frame: every shared prop but the empty label, which the chart shows itself. */
export type FigureFrameInput = Omit<SeriesFigureProps, 'emptyLabel'>;
