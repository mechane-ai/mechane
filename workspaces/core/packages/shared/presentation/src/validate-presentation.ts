import { CardSpecError } from '@json-render/chat';
import { Record } from 'effect';
import type { z } from 'zod';
import type { StaticPresentationSpecification } from './elements.ts';
import { PRESENTATION_LIMITS } from './limits.ts';
import { renderPresentationCard } from './render-presentation-card.ts';

type Visit = { readonly key: string; readonly depth: number };
type ValidatePresentationInput = { readonly spec: StaticPresentationSpecification; readonly context: z.RefinementCtx };
const FIELD_MARKUP_CHARS = 3;

export function validatePresentation({ spec, context }: ValidatePresentationInput): void {
  const entries = Record.toEntries(spec.elements);
  const elements = new Map(entries);

  if (elements.size > PRESENTATION_LIMITS.elements) {
    context.addIssue({ code: 'custom', message: `Use at most ${PRESENTATION_LIMITS.elements} elements.` });

    return;
  }

  const serialized = JSON.stringify(spec);
  const bytes = new TextEncoder().encode(serialized);

  if (bytes.byteLength > PRESENTATION_LIMITS.serializedBytes) {
    context.addIssue({ code: 'custom', message: 'The presentation is too large for one message.' });

    return;
  }

  // The native card renderer prunes repeated references.
  // Reject them before rendering so every surface shows the same tree.
  const visited = new Set<string>();
  const pending: Array<Visit> = [{ key: spec.root, depth: 1 }];

  while (pending.length > 0) {
    const visit = pending.pop();

    if (visit === undefined) {
      break;
    }

    const element = elements.get(visit.key);

    if (element === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['elements', visit.key],
        message: 'The referenced element is missing.',
      });

      return;
    }

    if (visited.has(visit.key)) {
      context.addIssue({
        code: 'custom',
        path: ['elements', visit.key],
        message: 'Each element must have exactly one parent; cycles are not allowed.',
      });

      return;
    }

    if (visit.depth > PRESENTATION_LIMITS.depth) {
      context.addIssue({
        code: 'custom',
        path: ['elements', visit.key],
        message: `Use at most ${PRESENTATION_LIMITS.depth} levels of nesting.`,
      });

      return;
    }

    if (element.type === 'Card' && visit.key !== spec.root) {
      context.addIssue({
        code: 'custom',
        path: ['elements', visit.key],
        message: 'Only the root may be a Card; use Section to group content.',
      });

      return;
    }

    if (element.type === 'Actions' && element.children.length > PRESENTATION_LIMITS.actions) {
      context.addIssue({
        code: 'custom',
        path: ['elements', visit.key],
        message: `Use at most ${PRESENTATION_LIMITS.actions} links per Actions element.`,
      });

      return;
    }

    if (element.type === 'Table' && Array.isArray(element.props.align)) {
      if (element.props.align.length !== element.props.headers.length) {
        context.addIssue({
          code: 'custom',
          path: ['elements', visit.key, 'props', 'align'],
          message: 'Provide one alignment per column.',
        });

        return;
      }
    }

    if (element.type === 'Table') {
      const cells = [element.props.headers, ...element.props.rows].flat();
      const characters = cells.reduce((total, cell) => total + cell.length, 0);

      if (characters > PRESENTATION_LIMITS.tableChars) {
        context.addIssue({
          code: 'custom',
          path: ['elements', visit.key],
          message: 'The table has too much text for one message.',
        });

        return;
      }
    }

    if (element.type === 'Field') {
      const characters = element.props.label.length + element.props.value.length + FIELD_MARKUP_CHARS;

      if (characters > PRESENTATION_LIMITS.fieldChars) {
        context.addIssue({
          code: 'custom',
          path: ['elements', visit.key],
          message: 'The field has too much text for one message.',
        });

        return;
      }
    }

    if (element.type === 'Chart' && element.props.chart.type !== 'pie') {
      const chart = element.props.chart;
      const categories = new Set(chart.categories);
      const names = chart.series.map((series) => series.name);
      const uniqueNames = new Set(names);

      if (categories.size !== chart.categories.length || uniqueNames.size !== names.length) {
        context.addIssue({
          code: 'custom',
          path: ['elements', visit.key],
          message: 'Chart categories and series names must be unique.',
        });

        return;
      }
    }

    visited.add(visit.key);

    const children = element.children.map((key) => ({ key, depth: visit.depth + 1 }));

    pending.push(...children);
  }

  if (visited.size !== elements.size) {
    context.addIssue({ code: 'custom', message: 'Every element must be reachable from the root.' });

    return;
  }

  try {
    renderPresentationCard({ spec });
  } catch (error) {
    if (!(error instanceof CardSpecError)) {
      throw error;
    }

    for (const message of error.issues) {
      context.addIssue({ code: 'custom', message });
    }
  }
}
