import { gitLines, InputUnreadable, mergeBase } from '@mechane/checks-kernel';
import type { Finding } from '@mechane/checks-kernel';
import { Lock, lostEntries, SHIPPED_WIRE_LOCK } from '@mechane/program';
import { Effect, Record, Schema } from 'effect';

type ShippedWireFindingsInput = {
  readonly current: Lock;
  readonly shipped: Lock;
  readonly baseBranch: string;
  readonly inherited: Readonly<Record<string, string>>;
};

type ShippedWireRevisionNameInput = { readonly base: string };

/** Git resolves this object path relative to the product workspace, in both private and exported repositories. */
function shippedWireRevisionName({ base }: ShippedWireRevisionNameInput): string {
  return `${base}:./${SHIPPED_WIRE_LOCK}`;
}

/** Active names must be shipped, and previously committed history must survive API retirement. */
export const shippedWireFindings = Effect.fn('shippedWireFindings')(function* ({
  current,
  shipped,
  baseBranch,
  inherited,
}: ShippedWireFindingsInput): Effect.fn.Return<ReadonlyArray<Finding>, InputUnreadable> {
  const findings: ReadonlyArray<Finding> = lostEntries({ locked: current, current: shipped }).map(({ key, entry }) => ({
    check: 'locks',
    location: SHIPPED_WIRE_LOCK,
    message: `Append ${key}'s ${entry} to shipped history with \`mise -C workspaces/core run locks\``,
  }));

  const base = yield* mergeBase({ baseBranch, inherited });
  const paths = yield* gitLines({ args: ['ls-tree', '--name-only', base, SHIPPED_WIRE_LOCK], inherited });

  if (!paths.includes(SHIPPED_WIRE_LOCK)) {
    return findings;
  }

  const name = shippedWireRevisionName({ base });
  const lines = yield* gitLines({ args: ['show', name], inherited });
  const text = lines.join('\n');
  const codec = Schema.fromJsonString(Lock);
  const decode = Schema.decodeUnknownEffect(codec);

  const previous = yield* decode(text).pipe(
    Effect.mapError((error) => new InputUnreadable({ path: name, reason: error.message })),
  );

  const categories = Record.keys(previous);
  const missingCategories = categories.filter((key) => !Record.has(shipped, key));

  const lostCategories: ReadonlyArray<Finding> = missingCategories.map((key) => ({
    check: 'locks',
    location: SHIPPED_WIRE_LOCK,
    message: `Restore shipped category ${key}, including categories with no entries`,
  }));

  const missingEntries = lostEntries({ locked: previous, current: shipped });

  const lostNames: ReadonlyArray<Finding> = missingEntries.map(({ key, entry }) => ({
    check: 'locks',
    location: SHIPPED_WIRE_LOCK,
    message: `Restore ${key}'s ${entry}; shipped history is append-only even after its API is retired`,
  }));

  return [...findings, ...lostCategories, ...lostNames];
});
