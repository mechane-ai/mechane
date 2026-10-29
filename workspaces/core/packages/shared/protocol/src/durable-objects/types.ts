import type { KeyPurpose } from '../operations/auth/constants.ts';
import type { SettlementBasis } from '../operations/turns/constants.ts';
import type { TokenUsage } from '../operations/turns/schemas.ts';
import type { KeyAccess } from './schemas.ts';

/** A key the directory resolved by its token's hash, with its principal. */
export type FillKeyInput = { readonly tokenHash: string; readonly access: KeyAccess };

/** What a started device approval asks for: the key's purpose, name and lifetime, under its codes. */
export type DeviceApprovalRequest = {
  readonly id: string;
  readonly userCode: string;
  readonly pollTokenHash: string;
  readonly purpose: KeyPurpose;
  readonly keyName: string;
  readonly keyLifetimeMs: number;
  /** The address of the client that started it, null where the platform reported none. */
  readonly peerAddress: string | null;
  /** The country of the client that started it, null where the platform reported none. */
  readonly peerCountry: string | null;
};

/** A dispatch charged its whole reservation, because no usage was reported. */
type ReservationSettlement = { readonly basis: typeof SettlementBasis.Reservation; readonly settledMicros: number };

/** What a dispatch is charged, and from what. */
export type Settlement = UsageSettlement | ReservationSettlement;

/** A dispatch priced from the usage the upstream reported. */
type UsageSettlement = {
  readonly basis: typeof SettlementBasis.Usage;
  readonly settledMicros: number;
  readonly usage: TokenUsage;
};
