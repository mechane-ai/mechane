import type { PresentationElement } from './elements.ts';
import type { PresentationSpecification } from './schemas.ts';

type RenderPresentationTextInput = { readonly spec: PresentationSpecification };
type RenderElementTextInput = { readonly element: PresentationElement };

/**
 * Renders the complete fallback for an already validated specification, preserving child order. It does not validate
 * arbitrary input.
 */
export function renderPresentationText({ spec }: RenderPresentationTextInput): string {
  const pending = [spec.root];
  const lines: Array<string> = [];

  while (pending.length > 0) {
    const key = pending.pop();

    if (key === undefined) {
      break;
    }

    const element = spec.elements[key];

    if (element === undefined) {
      throw new Error('The presentation contains a missing element.');
    }

    const content = renderElementText({ element });

    if (content !== '') {
      lines.push(content);
    }

    const children = element.children.toReversed();

    pending.push(...children);
  }

  return lines.join('\n\n');
}

function renderElementText({ element }: RenderElementTextInput): string {
  switch (element.type) {
    case 'Card':
      return [element.props.title, element.props.subtitle].filter(Boolean).join('\n');
    case 'Text':
      return element.props.content;
    case 'Field':
      return `${element.props.label}: ${element.props.value}`;
    case 'Table': {
      const rows = element.props.rows.map((row) => row.join(' | '));
      const lines = [element.props.headers.join(' | '), ...rows];

      if (typeof element.props.caption === 'string') {
        lines.push(element.props.caption);
      }

      return lines.join('\n');
    }
    case 'Chart': {
      const lines = [element.props.title];
      const chart = element.props.chart;

      if (chart.type === 'pie') {
        const segments = chart.segments.map((segment) => `${segment.label}: ${segment.value}`);

        return [element.props.title, ...segments].join('\n');
      }

      if (typeof chart.xLabel === 'string') {
        lines.push(`Categories: ${chart.xLabel}`);
      }

      if (typeof chart.yLabel === 'string') {
        lines.push(`Values: ${chart.yLabel}`);
      }

      const seriesLines = chart.series.map((series) => {
        const values = chart.categories.map((label, index) => `${label}: ${series.values[index]}`);

        return `${series.name}: ${values.join(', ')}`;
      });

      return [...lines, ...seriesLines].join('\n');
    }
    case 'LinkButton':
      return `${element.props.label}: ${element.props.url}`;
    case 'Section':
    case 'Fields':
    case 'Actions':
    case 'Divider':
      return '';
  }
}
