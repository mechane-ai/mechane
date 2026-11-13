import { ADOPTED, AST_GREP_DEFAULTS } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** Catalog review compares each public component with its source guidance. */
export const uiComponentUsageGuidance = {
  values: {},
  rules: [
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'ui-chart-caption-role',
      standard: '074',
      violation: [
        "import { SectionHeading } from '../../core/src/index.ts';",
        "import { SectionHeading as Caption } from '../../core/src/index.ts';",
        'const caption = <Core.SectionHeading title={title} />;',
      ],
      allowed: [
        "import { ChartHeading } from './chart-heading.tsx';",
        'const caption = <ChartHeading title={title} actions={actions} />;',
        'const caption = <Core.Subheading>{title}</Core.Subheading>;',
      ],
    },
  ],
} as const satisfies ContractEnforcement;
