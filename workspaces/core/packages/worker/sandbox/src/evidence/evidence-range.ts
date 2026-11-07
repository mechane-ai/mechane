import type { Bytes } from '@mechane/records';
import type { EvidenceRange } from '@mechane/sandbox-store';
import { Option } from 'effect';

type RangeInput = {
  /** Absent when the caller requests the complete artifact. */
  readonly header: Option.Option<string>;
  readonly sizeBytes: Bytes;
};

type ParsedRange = { readonly range: EvidenceRange; readonly isPartial: boolean };

/** One finite byte range supports video seeking without multi-range amplification. */
export function evidenceRange({ header, sizeBytes }: RangeInput): Option.Option<ParsedRange> {
  if (Option.isNone(header)) {
    return Option.some({ range: { offset: 0, length: sizeBytes }, isPartial: false });
  }

  const parts = /^bytes=(\d*)-(\d*)$/u.exec(header.value);
  const matched = Option.fromNullishOr(parts);

  if (Option.isNone(matched)) {
    return Option.none();
  }

  const [, startText, endText] = matched.value;
  const start = Option.fromUndefinedOr(startText);
  const end = Option.fromUndefinedOr(endText);

  if (Option.isNone(start) || Option.isNone(end)) {
    return Option.none();
  }

  if (start.value === '' && end.value === '') {
    return Option.none();
  }

  if (start.value === '') {
    const suffixBytes = Number(end.value);

    if (!Number.isSafeInteger(suffixBytes) || suffixBytes <= 0) {
      return Option.none();
    }

    const length = Math.min(suffixBytes, sizeBytes);

    return Option.some({ range: { offset: sizeBytes - length, length }, isPartial: true });
  }

  const offset = Number(start.value);

  const lastByte: number = (() => {
    if (end.value === '') {
      return sizeBytes - 1;
    }

    return Number(end.value);
  })();

  const isIntegerInterval = Number.isSafeInteger(offset) && Number.isSafeInteger(lastByte);

  if (!isIntegerInterval || offset >= sizeBytes || lastByte < offset) {
    return Option.none();
  }

  const length = Math.min(lastByte, sizeBytes - 1) - offset + 1;

  return Option.some({ range: { offset, length }, isPartial: true });
}

type ContentRangeInput = { readonly range: EvidenceRange; readonly sizeBytes: Bytes };

/** Formats the inclusive byte bounds required by an HTTP partial-content response. */
export function evidenceContentRangeHeader({ range, sizeBytes }: ContentRangeInput): string {
  return `bytes ${range.offset}-${range.offset + range.length - 1}/${sizeBytes}`;
}

/** Reports the artifact's complete size when an HTTP range cannot be satisfied. */
export function evidenceUnsatisfiedRangeHeader({ sizeBytes }: Pick<ContentRangeInput, 'sizeBytes'>): string {
  return `bytes */${sizeBytes}`;
}
