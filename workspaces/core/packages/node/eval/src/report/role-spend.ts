import { Micros, Tokens } from '@mechane/records';
import { Array, Number, Option } from 'effect';
import type { RoleIntent, RoleReceipt, RoleRecord } from '../application-schemas.ts';
import type { RoleSpend } from './inspection-schemas.ts';

type InspectRoleSpendInput = {
  readonly intent: Option.Option<RoleIntent>;
  readonly receipt: Option.Option<RoleReceipt>;
  readonly record: Option.Option<RoleRecord>;
};

type CombineRoleSpendInput = { readonly spends: ReadonlyArray<RoleSpend> };

type Counters = Pick<
  RoleSpend,
  'knownInputTokens' | 'knownOutputTokens' | 'knownCacheReadTokens' | 'knownCacheWriteTokens'
>;

const EMPTY_COUNTERS: Readonly<Counters> = {
  knownInputTokens: Tokens.make(0),
  knownOutputTokens: Tokens.make(0),
  knownCacheReadTokens: Tokens.make(0),
  knownCacheWriteTokens: Tokens.make(0),
};

export function inspectRoleSpend({ intent, receipt, record }: InspectRoleSpendInput): RoleSpend {
  if (Option.isNone(record)) {
    if (Option.isNone(intent) && Option.isNone(receipt)) {
      return {
        ...EMPTY_COUNTERS,
        knownListCostUsdCents: '0',
        isComplete: true,
        unknownAttempts: [],
        unknownUsageAttempts: [],
      };
    }

    const sessionId = Option.map(receipt, (value) => value.sessionId);
    const creationId = Option.map(intent, (value) => value.creationRequestId);
    const identity = Option.getOrElse(sessionId, () => Option.getOrElse(creationId, () => 'unresolved role'));

    return { ...EMPTY_COUNTERS, isComplete: false, unknownAttempts: [identity], unknownUsageAttempts: [identity] };
  }

  const { sessionId } = record.value;
  const usage = Option.fromUndefinedOr(record.value.usage);
  const values = Option.getOrElse(usage, (): NonNullable<RoleRecord['usage']> => ({}));
  const input = Option.fromUndefinedOr(values.inputTokens);
  const output = Option.fromUndefinedOr(values.outputTokens);
  const reads = Option.fromUndefinedOr(values.cacheReadInputTokens);
  const hourly = Option.fromUndefinedOr(values.cacheCreation1hInputTokens);
  const ephemeral = Option.fromUndefinedOr(values.cacheCreation5mInputTokens);
  const cost = Option.fromUndefinedOr(values.listCostUsdCents);

  const unknownUsageAttempts: Array<string> = [];

  if ([input, output, reads, hourly, ephemeral].some(Option.isNone)) {
    unknownUsageAttempts.push(sessionId);
  }

  const totalWrite = Option.getOrElse(hourly, () => 0) + Option.getOrElse(ephemeral, () => 0);
  const knownInput = Option.getOrElse(input, () => 0);
  const knownOutput = Option.getOrElse(output, () => 0);
  const knownReads = Option.getOrElse(reads, () => 0);

  const counters: Counters = {
    knownInputTokens: Tokens.make(knownInput),
    knownOutputTokens: Tokens.make(knownOutput),
    knownCacheReadTokens: Tokens.make(knownReads),
    knownCacheWriteTokens: Tokens.make(totalWrite),
  };

  if (Option.isNone(cost)) {
    return { ...counters, unknownUsageAttempts, isComplete: false, unknownAttempts: [sessionId] };
  }

  return {
    ...counters,
    unknownUsageAttempts,
    knownListCostUsdCents: cost.value,
    isComplete: true,
    unknownAttempts: [],
  };
}

export function combineRoleSpend({ spends }: CombineRoleSpendInput): RoleSpend {
  const optionalPrices = spends.map((spend) => Option.fromUndefinedOr(spend.knownListCostUsdCents));
  const prices = Array.getSomes(optionalPrices);
  const optionalCharges = spends.map((spend) => Option.fromUndefinedOr(spend.knownChargedMicros));
  const charges = Array.getSomes(optionalCharges);
  const inputCounts = spends.map((spend) => spend.knownInputTokens);
  const outputCounts = spends.map((spend) => spend.knownOutputTokens);
  const readCounts = spends.map((spend) => spend.knownCacheReadTokens);
  const writeCounts = spends.map((spend) => spend.knownCacheWriteTokens);
  const inputs = Number.sumAll(inputCounts);
  const outputs = Number.sumAll(outputCounts);
  const reads = Number.sumAll(readCounts);
  const writes = Number.sumAll(writeCounts);
  const charged = Number.sumAll(charges);
  const cents = prices.reduce((sum, price) => sum + BigInt(price), 0n);

  return {
    ...(prices.length > 0 && { knownListCostUsdCents: cents.toString() }),
    ...(charges.length > 0 && { knownChargedMicros: Micros.make(charged) }),
    knownInputTokens: Tokens.make(inputs),
    knownOutputTokens: Tokens.make(outputs),
    knownCacheReadTokens: Tokens.make(reads),
    knownCacheWriteTokens: Tokens.make(writes),
    isComplete: spends.every((spend) => spend.isComplete),
    unknownAttempts: spends.flatMap((spend) => spend.unknownAttempts),
    unknownUsageAttempts: spends.flatMap((spend) => spend.unknownUsageAttempts),
  };
}
