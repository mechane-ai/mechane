import type {
  BrowserArtifactPart,
  BrowserArtifactPartRequest,
  BrowserReceipt,
  BrowserRequest,
  BrowserRequestId,
  BrowserResponse,
} from '@mechane/sandbox-wire';
import type { Effect, Option } from 'effect';
import type { BrowserFailed } from './errors.ts';

type BrowserActivity = { readonly admit: () => boolean; readonly finish: () => void };

/** Supplies private guest paths, installed executables, and the shared checkpoint admission gate. */
export type BrowserSettings = {
  readonly home: string;
  readonly scratchDirectory: string;
  readonly path: string;
  readonly chromiumExecutable: string;
  readonly displayExecutable: string;
  readonly encoderExecutable: string;
  readonly mediaProbeExecutable: string;
  readonly isSandboxDisabled: boolean;
  readonly activity: BrowserActivity;
  /** Absent when Chromium should use only its installed trust roots. */
  readonly certificateFile: Option.Option<string>;
};

type BrowserRequestInput = { readonly request: BrowserRequest };
type BrowserReceiptInput = { readonly requestId: BrowserRequestId };

/** Exposes ordered actions, read-only receipts, and captures while keeping native process ownership in one scope. */
export type BrowserRuntime = {
  readonly perform: (input: BrowserRequestInput) => Effect.Effect<BrowserResponse, BrowserFailed>;
  readonly readReceipt: (input: BrowserReceiptInput) => Effect.Effect<BrowserReceipt, BrowserFailed>;
  readonly readArtifactPart: (input: BrowserArtifactPartRequest) => Effect.Effect<BrowserArtifactPart, BrowserFailed>;
  readonly ownedProcessGroups: () => ReadonlyArray<number>;
  readonly isBusy: () => boolean;
};
