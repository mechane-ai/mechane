import { z } from 'zod';
import type { RequestKind, RequestWait } from '../domain.ts';
import type { RunIdentity } from '../execution/types.ts';

const MAXIMUM_REASON_LENGTH = 500;
const MAXIMUM_GRANT_MINUTES = 1440;
const MAXIMUM_TOKEN_USD = 500;
const MINIMUM_TOKEN_MINUTES = 5;
const MAXIMUM_TOKEN_MINUTES = 10_080;
const CENTS_PER_DOLLAR = 100;
const MAXIMUM_SERVICE_ID_LENGTH = 200;

export const AccessInput = z.strictObject({
  capability: z.enum(['home-links', 'tokens']),
  reason: z.string().trim().min(1).max(MAXIMUM_REASON_LENGTH),
  minutes: z.number().int().min(1).max(MAXIMUM_GRANT_MINUTES).optional(),
});

export const TokenInput = z.strictObject({
  connectionId: z.uuid(),
  reason: z.string().trim().min(1).max(MAXIMUM_REASON_LENGTH),
  limitUsd: z
    .number()
    .positive()
    .max(MAXIMUM_TOKEN_USD)
    .refine((value) => Math.round(value * CENTS_PER_DOLLAR) / CENTS_PER_DOLLAR === value, 'Use whole cents'),
  ttlMinutes: z.number().int().min(MINIMUM_TOKEN_MINUTES).max(MAXIMUM_TOKEN_MINUTES).optional(),
});

export const WaitInput = z.strictObject({ kind: z.enum(['access', 'vend']), requestId: z.uuid() });

export const ExternalStatus = z.object({
  id: z.uuid(),
  kind: z.enum(['access', 'vend']),
  status: z.enum(['pending', 'ready', 'denied', 'expired', 'cancelled', 'revoked', 'failed']),
  approval: z.object({ id: z.uuid(), url: z.url(), status: z.string() }).nullable(),
  error: z.string().nullable(),
  authorization: z.enum(['standing', 'automatic', 'approval']).optional(),
  expiresAt: z.iso.datetime({ offset: true }).optional(),
});

export const NexusRequestEvent = z.strictObject({
  id: z.uuid(),
  type: z.literal('nexus.request.resolved'),
  occurredAt: z.iso.datetime({ offset: true }),
  serviceId: z.string().min(1).max(MAXIMUM_SERVICE_ID_LENGTH),
  request: z.strictObject({
    id: z.uuid(),
    kind: z.enum(['access', 'vend']),
    status: z.enum(['ready', 'denied', 'expired', 'cancelled']),
    approvalId: z.uuid().nullable(),
  }),
});

export type AccessInput = z.infer<typeof AccessInput>;
export type TokenInput = z.infer<typeof TokenInput>;
export type WaitInput = z.infer<typeof WaitInput>;
export type ExternalStatus = z.infer<typeof ExternalStatus>;
export type RequestCall = RunIdentity & { readonly toolCallId: string };

export type RequestPreparation = {
  readonly context: RequestCall;
  readonly kind: RequestKind;
  readonly requestId?: string;
};

export type PreparedRequest = { readonly context: RunIdentity; readonly wait: RequestWait };
export type AccessSubmission = PreparedRequest & { readonly input: AccessInput };
export type TokenSubmission = PreparedRequest & { readonly input: TokenInput };

export type RequestResult = {
  readonly id: string;
  readonly kind: RequestKind;
  readonly status: ExternalStatus['status'];
  readonly approvalUrl: string | null;
  readonly authorization: ExternalStatus['authorization'] | null;
  readonly error: string | null;
  readonly collection: 'nexus-cli' | null;
};

export type DecisionSignal = {
  readonly eventId: string;
  readonly status: 'ready' | 'denied' | 'expired' | 'cancelled';
};
