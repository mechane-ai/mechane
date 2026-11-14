import { DispatchStatus, SettlementBasis, UnknownDispatch } from '@mechane/protocol';
import type { TracedDispatch } from '@mechane/protocol';
import { Micros, Tokens } from '@mechane/records';
import { Number, Option, Schema } from 'effect';
import type { RoleIntent, RoleReceipt, RoleRecord } from '../application-schemas.ts';
import type { RoleSpend } from './inspection-schemas.ts';

type InspectRoleSpendInput = {
  readonly intent: Option.Option<RoleIntent>;
  readonly receipt: Option.Option<RoleReceipt>;
  readonly record: Option.Option<RoleRecord>;
};

type DispatchSpendInput = { readonly dispatch: TracedDispatch };
type CombineRoleSpendInput = { readonly spends: ReadonlyArray<RoleSpend> };
type UnknownRoleSpendInput = { readonly identity: string };

const EMPTY_SPEND: Readonly<RoleSpend> = {
  knownChargedMicros: Micros.make(0),
  isComplete: true,
  unknownAttempts: [],
  knownInputTokens: Tokens.make(0),
  knownOutputTokens: Tokens.make(0),
  knownCacheReadTokens: Tokens.make(0),
  knownCacheWriteTokens: Tokens.make(0),
  unknownUsageAttempts: [],
};

export function inspectRoleSpend({ intent, receipt, record }: InspectRoleSpendInput): RoleSpend {
  if (Option.isNone(record)) {
    if (Option.isNone(intent) && Option.isNone(receipt)) {
      return EMPTY_SPEND;
    }

    const notificationId = Option.match(intent, {
      onNone: () => Option.map(receipt, (saved) => saved.notificationId),
      onSome: (saved) => Option.some(saved.notificationId),
    });

    const identity = Option.getOrElse(notificationId, () => 'unresolved role');

    return unknownRoleSpend({ identity });
  }

  if (record.value.dispatches.length === 0) {
    return unknownRoleSpend({ identity: record.value.notificationId });
  }

  const spends = record.value.dispatches.map((dispatch) => dispatchSpend({ dispatch }));
  const spend = combineRoleSpend({ spends });

  if (!record.value.isEvidenceComplete) {
    return {
      ...spend,
      isComplete: false,
      unknownAttempts: [...spend.unknownAttempts, record.value.notificationId],
      unknownUsageAttempts: [...spend.unknownUsageAttempts, record.value.notificationId],
    };
  }

  return spend;
}

export function combineRoleSpend({ spends }: CombineRoleSpendInput): RoleSpend {
  const knownCharges = spends.map((spend) => spend.knownChargedMicros);
  const inputTokens = spends.map((spend) => spend.knownInputTokens);
  const outputTokens = spends.map((spend) => spend.knownOutputTokens);
  const cacheReadTokens = spends.map((spend) => spend.knownCacheReadTokens);
  const cacheWriteTokens = spends.map((spend) => spend.knownCacheWriteTokens);
  const chargedTotal = Number.sumAll(knownCharges);
  const inputTotal = Number.sumAll(inputTokens);
  const outputTotal = Number.sumAll(outputTokens);
  const cacheReadTotal = Number.sumAll(cacheReadTokens);
  const cacheWriteTotal = Number.sumAll(cacheWriteTokens);

  return {
    knownChargedMicros: Micros.make(chargedTotal),
    isComplete: spends.every((spend) => spend.isComplete),
    unknownAttempts: spends.flatMap((spend) => spend.unknownAttempts),
    knownInputTokens: Tokens.make(inputTotal),
    knownOutputTokens: Tokens.make(outputTotal),
    knownCacheReadTokens: Tokens.make(cacheReadTotal),
    knownCacheWriteTokens: Tokens.make(cacheWriteTotal),
    unknownUsageAttempts: spends.flatMap((spend) => spend.unknownUsageAttempts),
  };
}

function dispatchSpend({ dispatch }: DispatchSpendInput): RoleSpend {
  if (Schema.is(UnknownDispatch)(dispatch)) {
    return unknownRoleSpend({ identity: dispatch.id });
  }

  switch (dispatch.status) {
    case DispatchStatus.Reserved:
      return unknownRoleSpend({ identity: dispatch.id });
    case DispatchStatus.Refused:
      return EMPTY_SPEND;
    case DispatchStatus.Settled:
      if (dispatch.basis === SettlementBasis.Reservation) {
        return { ...EMPTY_SPEND, knownChargedMicros: dispatch.settledMicros, unknownUsageAttempts: [dispatch.id] };
      }

      return {
        ...EMPTY_SPEND,
        knownChargedMicros: dispatch.settledMicros,
        knownInputTokens: dispatch.inputTokens,
        knownOutputTokens: dispatch.outputTokens,
        knownCacheReadTokens: dispatch.cacheReadTokens,
        knownCacheWriteTokens: dispatch.cacheWriteTokens,
      };
  }
}

function unknownRoleSpend({ identity }: UnknownRoleSpendInput): RoleSpend {
  return { ...EMPTY_SPEND, isComplete: false, unknownAttempts: [identity], unknownUsageAttempts: [identity] };
}
