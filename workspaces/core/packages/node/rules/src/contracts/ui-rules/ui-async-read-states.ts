import { ADOPTED, AST_GREP_DEFAULTS } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

const LOADING_BOUNDARY = {
  ...AST_GREP_DEFAULTS,
  ...ADOPTED,
  standard: '071',
  violation: [
    "import { AsyncRegion } from '@mechane-ai/elements/feedback';",
    "import { ContentReveal as Reveal } from '@mechane-ai/elements/feedback';",
    "import * as feedback from '@mechane-ai/elements/feedback';",
  ],
  allowed: [
    "import { ResourceView } from '../resource.tsx';",
    "import { Notice, SkeletonText } from '@mechane-ai/elements/feedback';",
    "import type { AsyncRegionState } from '@mechane-ai/elements/feedback';",
  ],
} as const;

const LOADING_SCOPE = {
  ...AST_GREP_DEFAULTS,
  ...ADOPTED,
  standard: '071',
  violation: [
    "import { LoadingScope } from '@mechane-ai/elements/feedback';",
    "import { LoadingScope as Scope } from '@mechane-ai/elements/feedback';",
    "import * as feedback from '@mechane-ai/elements/feedback';",
  ],
  allowed: [
    "import { Notice } from '@mechane-ai/elements/feedback';",
    "import type { LoadingScopeProps } from '@mechane-ai/elements/feedback';",
  ],
} as const;

/** Import ownership is static; coordinated timing and retained reader state need packaged-browser review. */
export const uiAsyncReadStates = {
  values: {},
  rules: [
    { ...LOADING_BOUNDARY, name: 'console-loading-boundary' },
    { ...LOADING_BOUNDARY, name: 'console-loading-boundary-typescript' },
    { ...LOADING_SCOPE, name: 'console-loading-scope' },
    { ...LOADING_SCOPE, name: 'console-loading-scope-typescript' },
  ],
} as const satisfies ContractEnforcement;
