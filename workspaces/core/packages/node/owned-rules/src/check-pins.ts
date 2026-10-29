import { decodeFile, FACTORY_FOLDER, readText } from '@mechane/checks-kernel';
import type { Finding, InputUnreadable } from '@mechane/checks-kernel';
import { wireStruct } from '@mechane/records';
import { Effect, Option, Schema } from 'effect';
import { join } from 'node:path';

/** The factory files that pin a tool which another file pins too, relative to the factory root. */
const PIN_FILES = { mise: 'mise.toml', bootstrap: '.config/bootstrap.sh' } as const;

/** The sandbox image's build file, whose base repeats mise.toml's Node release, relative to the product. */
const IMAGE_FILE = 'packages/node/guest/image/Dockerfile';

/** The workspace manifest, whose package manager repeats mise.toml's pnpm release, relative to the product. */
const MANIFEST_FILE = 'package.json';

/** The Node release of the image's base, such as `24.22.1` in `FROM node:24.22.1-bookworm-slim@sha256:...`. */
const IMAGE_NODE_PATTERN = /^FROM (?:mirror\.gcr\.io\/library\/)?node:([^-@\s]+)/m;

/** The mise release `.config/bootstrap.sh` assigns at the start of a line, such as `mise_version=2026.10.17`. */
const BOOTSTRAP_MISE_PATTERN = /^mise_version=(\S+)$/m;

/** The pins of the factory's mise.toml that another file repeats. */
const MisePins = wireStruct({
  fields: { minVersion: Schema.String, tools: Schema.Struct({ node: Schema.String, pnpm: Schema.String }) },
});

/** The pnpm release the workspace manifest names, as `pnpm@<version>`. */
const PackageManager = Schema.Struct({ packageManager: Schema.String });

type MisePins = typeof MisePins.Type;

/** The pins of mise.toml, and the texts and manifest that repeat them. */
type PinPairsInput = {
  readonly mise: MisePins;
  readonly bootstrap: string;
  readonly packageManager: string;
  readonly image: string;
};

/** One tool's pin in the file that owns it and the copy another file must keep equal to it. */
type PinPair = {
  readonly tool: string;
  readonly pinned: string;
  /** Absent when the file holds no copy the pattern finds. */
  readonly copy: Option.Option<string>;
  readonly location: string;
};

/** Each tool's pin in mise.toml, and its copy in `.config/bootstrap.sh`, the workspace manifest or the image. */
function pinPairs({ mise, bootstrap, packageManager, image }: PinPairsInput): ReadonlyArray<PinPair> {
  const bootstrapMise = Option.fromNullishOr(BOOTSTRAP_MISE_PATTERN.exec(bootstrap));
  const imageNode = Option.fromNullishOr(IMAGE_NODE_PATTERN.exec(image));

  return [
    {
      tool: 'mise',
      pinned: mise.minVersion,
      copy: Option.flatMapNullishOr(bootstrapMise, (match) => match[1]),
      location: PIN_FILES.bootstrap,
    },
    { tool: 'pnpm', pinned: `pnpm@${mise.tools.pnpm}`, copy: Option.some(packageManager), location: MANIFEST_FILE },
    {
      tool: 'node',
      pinned: mise.tools.node,
      copy: Option.flatMapNullishOr(imageNode, (match) => match[1]),
      location: IMAGE_FILE,
    },
  ];
}

/**
 * Checks that each copy of a tool's pin, in `.config/bootstrap.sh`, the workspace manifest or the sandbox image, names
 * mise.toml's version.
 */
export const checkPins = Effect.fn('checkPins')(function* (): Effect.fn.Return<
  ReadonlyArray<Finding>,
  InputUnreadable
> {
  const mise = yield* decodeFile({ path: join(FACTORY_FOLDER, PIN_FILES.mise), schema: MisePins });
  const bootstrap = yield* readText({ path: join(FACTORY_FOLDER, PIN_FILES.bootstrap) });
  const { packageManager } = yield* decodeFile({ path: MANIFEST_FILE, schema: PackageManager });
  const image = yield* readText({ path: IMAGE_FILE });

  /** Whether the copy differs from the pin, or the file holds none. */
  const isUnequal: (pair: PinPair) => boolean = ({ copy, pinned }) => !Option.contains(copy, pinned);

  /** The finding of a copy that differs from its pin. */
  const pinFinding: (pair: PinPair) => Finding = ({ tool, pinned, copy, location }) => ({
    check: 'pins',
    location,
    message: `Pin ${tool} as ${PIN_FILES.mise} does, such as \`${pinned}\`, since this copy pins ${Option.getOrElse(copy, () => 'nothing')}`,
  });

  return pinPairs({ mise, bootstrap, packageManager, image }).filter(isUnequal).map(pinFinding);
});
