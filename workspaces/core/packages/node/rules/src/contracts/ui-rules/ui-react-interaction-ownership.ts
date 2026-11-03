import { ADOPTED, InstalledAsset, OXLINT_DEFAULTS, Severity } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** The installed asset pins these values, which the registry also uses in its scoped browser override. */
const REACT_INTERACTION = {
  ...OXLINT_DEFAULTS,
  ...ADOPTED,
  asset: InstalledAsset.Oxlint,
  value: Severity.Error,
  standard: '069',
} as const;

/** These examples qualify the pinned linter; cleanup and stale callbacks still need browser review. */
export const uiReactInteractionOwnership = {
  values: { plugins: ['react'] },
  rules: [
    {
      ...REACT_INTERACTION,
      name: 'react/no-array-index-key',
      violation: ['const rows = items.map((item, index) => <div key={index}>{item.label}</div>);'],
      allowed: ['const rows = items.map((item) => <div key={item.id}>{item.label}</div>);'],
    },
    {
      ...REACT_INTERACTION,
      name: 'react/rules-of-hooks',
      violation: [
        "import { useState } from 'react'; function Control({ active }: { active: boolean }) { if (active) { useState(false); } return null; }",
      ],
      allowed: [
        "import { useState } from 'react'; function Control() { const [active] = useState(false); return <button aria-pressed={active} />; }",
      ],
    },
    {
      ...REACT_INTERACTION,
      name: 'react/set-state-in-effect',
      violation: [
        "import { useEffect, useState } from 'react'; function Editor({ title }: { title: string }) { const [draft, setDraft] = useState(title); useEffect(() => { setDraft(title); }, [title]); return <span>{draft}</span>; }",
      ],
      allowed: [
        "import { useState } from 'react'; function Editor({ title }: { title: string }) { const [draft] = useState(title); return <span>{draft}</span>; }",
      ],
    },
  ],
} as const satisfies ContractEnforcement;
